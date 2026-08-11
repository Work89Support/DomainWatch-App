import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { minutesBetween } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/incidents/[id]  { action, ...fields }
 * action:
 *  - admin_ack      : แอดมินรับเรื่อง
 *  - admin_update   : แอดมินอัพเดตลิงก์ใหม่ในระบบ (จบหน้าที่แอดมิน)
 *  - admin_use_backup : สลับไปใช้ลิงก์สำรองที่ไอทีเตรียมไว้ (คลิกเดียว)
 *  - it_ack         : IT รับเรื่อง
 *  - it_resolve     : IT ชี้แจงสาเหตุ + ลิงก์สำรอง
 *  - close          : ปิดเคส
 * ผู้กระทำถูกผูกกับผู้ใช้ที่ล็อกอินอยู่ (สำหรับ KPI รายคน)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const action = body.action as string;
  const incident = await prisma.incident.findUnique({
    where: { id: params.id },
    include: { link: true },
  });
  if (!incident) {
    return NextResponse.json({ error: "ไม่พบเหตุการณ์" }, { status: 404 });
  }

  const now = new Date();
  const baseTime = incident.notifiedAt || incident.detectedAt;
  const data: Record<string, unknown> = {};

  switch (action) {
    case "admin_ack":
      data.adminAckAt = incident.adminAckAt || now;
      data.adminUserId = me.id;
      break;

    case "admin_update": {
      data.adminUpdatedAt = now;
      data.status = "ADMIN_UPDATED";
      data.adminResponseMin = minutesBetween(baseTime, now);
      data.adminUserId = me.id;
      if (!incident.adminAckAt) data.adminAckAt = now;
      if (body.newUrl) data.newUrl = String(body.newUrl).trim();
      if (body.newUrl) {
        await prisma.link.update({
          where: { id: incident.linkId },
          data: { url: String(body.newUrl).trim(), lastStatus: "UNKNOWN" },
        });
      }
      break;
    }

    case "admin_use_backup": {
      if (!incident.link.backupUrl) {
        return NextResponse.json(
          { error: "ลิงก์นี้ยังไม่มีลิงก์สำรอง (ให้ไอทีเพิ่มก่อน)" },
          { status: 400 }
        );
      }
      data.adminUpdatedAt = now;
      data.status = "ADMIN_UPDATED";
      data.adminResponseMin = minutesBetween(baseTime, now);
      data.adminUserId = me.id;
      data.newUrl = incident.link.backupUrl;
      if (!incident.adminAckAt) data.adminAckAt = now;
      await prisma.link.update({
        where: { id: incident.linkId },
        data: { url: incident.link.backupUrl, lastStatus: "UNKNOWN" },
      });
      break;
    }

    case "it_ack":
      data.itAckAt = incident.itAckAt || now;
      data.itUserId = me.id;
      break;

    case "it_resolve": {
      data.itResolvedAt = now;
      data.itResponseMin = minutesBetween(baseTime, now);
      data.itUserId = me.id;
      if (!incident.itAckAt) data.itAckAt = now;
      if (incident.status === "OPEN") data.status = "IT_RESOLVED";
      if (body.cause) data.cause = String(body.cause).trim();
      if (body.backupUrl) data.backupUrl = String(body.backupUrl).trim();
      if (body.backupUrl) {
        await prisma.link.update({
          where: { id: incident.linkId },
          data: { backupUrl: String(body.backupUrl).trim() },
        });
      }
      break;
    }

    case "close":
      data.status = "CLOSED";
      data.resolvedAt = incident.resolvedAt || now;
      break;

    default:
      return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
  }

  const updated = await prisma.incident.update({
    where: { id: params.id },
    data: data as unknown as Prisma.IncidentUpdateInput,
    include: { link: { include: { company: true } }, adminUser: true, itUser: true },
  });
  return NextResponse.json(updated);
}
