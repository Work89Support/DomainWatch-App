import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { classifyProbeStatus, probe } from "@/lib/checker";
import { mobileUrlHash, normalizeUrl } from "@/lib/mobileAgent";
import { canAccessCompany, canActAsAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { normalizeReplacementUrl } from "@/lib/replacementLink";
import { minutesBetween } from "@/lib/format";

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
  if (body.action === "mark_updated") {
    if (incident.status === "CLOSED") {
      return NextResponse.json({ error: "เคสนี้ปิดเรียบร้อยแล้ว" }, { status: 409 });
    }
    const markedAt = new Date();
    const updated = await prisma.networkIncident.update({
      where: { id: incident.id },
      data: {
        status: "ADMIN_UPDATED",
        resolvedAt: null,
        adminUpdatedAt: markedAt,
        adminResponseMin: minutesBetween(incident.detectedAt, markedAt),
        adminUserId: me.id,
      },
    });
    return NextResponse.json({ ok: true, incidentStatus: updated.status });
  }
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

  const nextCompanyId = body.companyId ? String(body.companyId) : incident.link.companyId;
  if (!canAccessCompany(me.role, me.companyIds, nextCompanyId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const nextLineGroupId = body.lineGroupId ? String(body.lineGroupId) : null;
  if (nextLineGroupId) {
    const group = await prisma.lineGroup.findFirst({ where: { id: nextLineGroupId, companyId: nextCompanyId } });
    if (!group) return NextResponse.json({ error: "ห้อง LINE ไม่อยู่ในบริษัทที่เลือก" }, { status: 400 });
  }

  const checkedAt = new Date();
  const oldUrl = incident.link.url;
  const urlChanged = normalizeUrl(newUrl) !== normalizeUrl(oldUrl);
  const result = urlChanged ? await probe(newUrl) : null;
  const status = result ? classifyProbeStatus(result) : incident.link.lastStatus;
  if (result && !result.ok) {
    return NextResponse.json(
      { error: `ลิงก์ใหม่ยังเปิดไม่ได้: ${result.error || `HTTP ${result.httpCode || "-"}`}` },
      { status: 422 }
    );
  }

  const linkData: Prisma.LinkUncheckedUpdateInput = {
    companyId: nextCompanyId,
    lineGroupId: nextLineGroupId,
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : incident.link.name,
    url: newUrl,
    category: typeof body.category === "string" ? body.category.trim() || null : incident.link.category,
    backupUrl: typeof body.backupUrl === "string" ? body.backupUrl.trim() || null : body.backupUrl === null ? null : incident.link.backupUrl,
    note: typeof body.note === "string" ? body.note.trim() || null : body.note === null ? null : incident.link.note,
    isActive: typeof body.isActive === "boolean" ? body.isActive : incident.link.isActive,
  };
  const nextIncidentStatus = linkData.isActive === false ? "PAUSED" : "ADMIN_UPDATED";
  const affectedIncidents = await prisma.networkIncident.findMany({
    where: { linkId: incident.linkId, status: { not: "CLOSED" } },
    select: { id: true, detectedAt: true },
  });
  const markAffectedIncidents = () => affectedIncidents.map((item) =>
    prisma.networkIncident.update({
      where: { id: item.id },
      data: {
        status: nextIncidentStatus,
        resolvedAt: null,
        adminUpdatedAt: checkedAt,
        adminResponseMin: minutesBetween(item.detectedAt, checkedAt),
        adminUserId: me.id,
      },
    })
  );
  if (result) {
    Object.assign(linkData, {
      lastStatus: status,
      lastCheckedAt: checkedAt,
      lastHttpCode: result.httpCode,
      lastResponseMs: result.responseMs,
      failureStreak: 0,
      recoveryStreak: 0,
    });
  }

  if (!urlChanged) {
    const operations: Prisma.PrismaPromise<unknown>[] = [
      prisma.link.update({ where: { id: incident.linkId }, data: linkData }),
      ...markAffectedIncidents(),
    ];
    if (nextIncidentStatus === "PAUSED") {
      operations.push(prisma.incident.updateMany({
        where: { linkId: incident.linkId, status: { notIn: ["CLOSED", "PAUSED"] } },
        data: { status: "PAUSED" },
      }));
    }
    const [link] = await prisma.$transaction(operations);
    return NextResponse.json({ ok: true, link, incidentStatus: nextIncidentStatus, urlChanged: false });
  }

  const otherLinks = await prisma.link.findMany({
    where: { id: { not: incident.linkId }, isActive: true },
    select: { url: true },
  });
  const oldUrlStillUsed = otherLinks.some((link) => normalizeUrl(link.url) === normalizeUrl(oldUrl));

  const operations: Prisma.PrismaPromise<unknown>[] = [
    prisma.link.update({
      where: { id: incident.linkId },
      data: linkData,
    }),
    prisma.checkLog.create({
      data: {
        linkId: incident.linkId,
        status,
        httpCode: result?.httpCode ?? null,
        responseMs: result?.responseMs ?? null,
        error: result?.error ?? null,
      },
    }),
    // การเปิดได้จากตัวตรวจส่วนกลางยังไม่ยืนยันว่าเปิดได้ผ่านซิมจริง
    // ให้เครื่องซิมตรวจผ่านอีกครั้งก่อนจึงปิดเคสอัตโนมัติ
    ...markAffectedIncidents(),
  ];
  // ถ้าไม่มี Master Data รายการอื่นใช้ URL เก่าแล้ว ให้เอาผลค้างของ URL เก่าออกจากสรุปเครื่อง
  if (!oldUrlStillUsed) {
    operations.push(prisma.mobileUrlStatus.deleteMany({ where: { urlHash: mobileUrlHash(oldUrl) } }));
  }
  if (nextIncidentStatus === "PAUSED") {
    operations.push(prisma.incident.updateMany({
      where: { linkId: incident.linkId, status: { notIn: ["CLOSED", "PAUSED"] } },
      data: { status: "PAUSED" },
    }));
  }
  await prisma.$transaction(operations);

  return NextResponse.json({
    ok: true,
    linkId: incident.linkId,
    oldUrl,
    newUrl,
    status,
    incidentStatus: nextIncidentStatus,
    checkedAt,
    urlChanged: true,
  });
}
