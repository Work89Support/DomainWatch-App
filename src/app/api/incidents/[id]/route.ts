import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { minutesBetween } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";
import { classifyProbeStatus, probe } from "@/lib/checker";
import { normalizeReplacementUrl } from "@/lib/replacementLink";
import type { Prisma } from "@prisma/client";
import { canAccessCompany, canActAsAdmin, canActAsIt } from "@/lib/permissions";

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
  if (!canAccessCompany(me.role, me.companyIds, incident.link.companyId))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const now = new Date();
  const baseTime = incident.notifiedAt || incident.detectedAt;
  const data: Record<string, unknown> = {};

  switch (action) {
    case "admin_ack":
      if (!canActAsAdmin(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      data.adminAckAt = incident.adminAckAt || now;
      data.adminUserId = me.id;
      break;

    case "admin_update": {
      if (!canActAsAdmin(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      const newUrl = normalizeReplacementUrl(body.newUrl);
      if (!newUrl) {
        return NextResponse.json(
          { error: "กรุณาใส่ URL เต็มที่ขึ้นต้นด้วย http:// หรือ https://" },
          { status: 400 }
        );
      }
      const verification = await verifyReplacementLink(newUrl);
      if (!verification.ok) {
        return NextResponse.json(
          { error: `ลิงก์ใหม่ยังเปิดไม่ได้: ${verification.error}` },
          { status: 422 }
        );
      }
      data.adminUpdatedAt = now;
      data.status = "CLOSED";
      data.resolvedAt = new Date();
      data.adminResponseMin = minutesBetween(baseTime, now);
      data.adminUserId = me.id;
      if (!incident.adminAckAt) data.adminAckAt = now;
      data.newUrl = newUrl;
      await applyVerifiedLink(incident.linkId, newUrl, verification);
      break;
    }

    case "admin_use_backup": {
      if (!canActAsAdmin(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      if (!incident.link.backupUrl) {
        return NextResponse.json(
          { error: "ลิงก์นี้ยังไม่มีลิงก์สำรอง (ให้ไอทีเพิ่มก่อน)" },
          { status: 400 }
        );
      }
      const backupUrl = normalizeReplacementUrl(incident.link.backupUrl);
      if (!backupUrl) {
        return NextResponse.json(
          { error: "ลิงก์สำรองไม่ถูกต้อง ต้องขึ้นต้นด้วย http:// หรือ https://" },
          { status: 400 }
        );
      }
      const verification = await verifyReplacementLink(backupUrl);
      if (!verification.ok) {
        return NextResponse.json(
          { error: `ลิงก์สำรองยังเปิดไม่ได้: ${verification.error}` },
          { status: 422 }
        );
      }
      data.adminUpdatedAt = now;
      data.status = "CLOSED";
      data.resolvedAt = new Date();
      data.adminResponseMin = minutesBetween(baseTime, now);
      data.adminUserId = me.id;
      data.newUrl = backupUrl;
      if (!incident.adminAckAt) data.adminAckAt = now;
      await applyVerifiedLink(incident.linkId, backupUrl, verification);
      break;
    }

    case "it_ack":
      if (!canActAsIt(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      data.itAckAt = incident.itAckAt || now;
      data.itUserId = me.id;
      break;

    case "it_resolve": {
      if (!canActAsIt(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
      if (!canActAsAdmin(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
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

async function verifyReplacementLink(url: string) {
  const result = await probe(url);
  return {
    ...result,
    status: classifyProbeStatus(result),
  };
}

async function applyVerifiedLink(
  linkId: string,
  url: string,
  verification: Awaited<ReturnType<typeof verifyReplacementLink>>
) {
  const checkedAt = new Date();
  await prisma.$transaction([
    prisma.link.update({
      where: { id: linkId },
      data: {
        url,
        lastStatus: verification.status,
        lastCheckedAt: checkedAt,
        lastHttpCode: verification.httpCode,
        lastResponseMs: verification.responseMs,
        failureStreak: 0,
        recoveryStreak: 0,
      },
    }),
    prisma.checkLog.create({
      data: {
        linkId,
        status: verification.status,
        httpCode: verification.httpCode,
        responseMs: verification.responseMs,
        error: verification.error,
      },
    }),
  ]);
}
