import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { classifyProbeStatus, probe } from "@/lib/checker";
import { mobileUrlHash, normalizeUrl } from "@/lib/mobileAgent";
import { canAccessCompany, canActAsAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { normalizeReplacementUrl } from "@/lib/replacementLink";

export const dynamic = "force-dynamic";

// แก้ลิงก์จากการ์ดเหตุการณ์ซิม โดยตรวจปลายทางก่อนอัปเดต Master Data
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canActAsAdmin(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const incident = await prisma.networkIncident.findUnique({
    where: { id: params.id },
    include: { link: true },
  });
  if (!incident) return NextResponse.json({ error: "ไม่พบเหตุการณ์จากซิม" }, { status: 404 });
  if (!canAccessCompany(me.role, me.companyIds, incident.link.companyId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.action !== "admin_update") {
    return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
  }
  const newUrl = normalizeReplacementUrl(body.newUrl);
  if (!newUrl) {
    return NextResponse.json(
      { error: "กรุณาใส่ URL เต็มที่ขึ้นต้นด้วย http:// หรือ https://" },
      { status: 400 }
    );
  }

  const checkedAt = new Date();
  const result = await probe(newUrl);
  const status = classifyProbeStatus(result);
  if (!result.ok) {
    return NextResponse.json(
      { error: `ลิงก์ใหม่ยังเปิดไม่ได้: ${result.error || `HTTP ${result.httpCode || "-"}`}` },
      { status: 422 }
    );
  }

  const oldUrl = incident.link.url;
  const otherLinks = await prisma.link.findMany({
    where: { id: { not: incident.linkId }, isActive: true },
    select: { url: true },
  });
  const oldUrlStillUsed = otherLinks.some((link) => normalizeUrl(link.url) === normalizeUrl(oldUrl));

  const operations: Prisma.PrismaPromise<unknown>[] = [
    prisma.link.update({
      where: { id: incident.linkId },
      data: {
        url: newUrl,
        lastStatus: status,
        lastCheckedAt: checkedAt,
        lastHttpCode: result.httpCode,
        lastResponseMs: result.responseMs,
        failureStreak: 0,
        recoveryStreak: 0,
      },
    }),
    prisma.checkLog.create({
      data: {
        linkId: incident.linkId,
        status,
        httpCode: result.httpCode,
        responseMs: result.responseMs,
        error: result.error,
      },
    }),
    prisma.networkIncident.updateMany({
      where: { linkId: incident.linkId, status: { not: "CLOSED" } },
      data: { status: "CLOSED", resolvedAt: checkedAt },
    }),
  ];
  // ถ้าไม่มี Master Data รายการอื่นใช้ URL เก่าแล้ว ให้เอาผลค้างของ URL เก่าออกจากสรุปเครื่อง
  if (!oldUrlStillUsed) {
    operations.push(prisma.mobileUrlStatus.deleteMany({ where: { urlHash: mobileUrlHash(oldUrl) } }));
  }
  await prisma.$transaction(operations);

  return NextResponse.json({
    ok: true,
    linkId: incident.linkId,
    oldUrl,
    newUrl,
    status,
    checkedAt,
  });
}
