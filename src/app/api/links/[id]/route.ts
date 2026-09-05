import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessCompany, canDeleteLinks, canEditBackup, canEditLinks } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";
import { caseActivity } from "@/lib/caseActivity";

export const dynamic = "force-dynamic";

// PATCH /api/links/[id] — แก้ไขลิงก์
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const existing = await prisma.link.findUnique({ where: { id: params.id }, include: { company: true } });
  if (!existing) return NextResponse.json({ error: "ไม่พบลิงก์" }, { status: 404 });
  if (!canAccessCompany(me.role, me.companyIds, existing.companyId))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const keys = Object.keys(body).filter((key) => key !== "id");
  const backupOnly = keys.every((key) => key === "backupUrl");
  if (!canEditLinks(me.role) && !(backupOnly && canEditBackup(me.role)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const data: Record<string, unknown> = {};
  for (const key of [
    "name",
    "url",
    "category",
    "backupUrl",
    "note",
  ] as const) {
    if (key in body) {
      const v = body[key];
      data[key] = typeof v === "string" ? v.trim() || null : v;
    }
  }
  if ("companyId" in body && body.companyId) {
    const nextCompanyId = String(body.companyId);
    if (!canAccessCompany(me.role, me.companyIds, nextCompanyId))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    data.companyId = nextCompanyId;
  }
  if ("lineGroupId" in body) {
    const lineGroupId = body.lineGroupId ? String(body.lineGroupId) : null;
    if (lineGroupId) {
      const targetCompanyId = String(data.companyId || existing.companyId);
      const group = await prisma.lineGroup.findFirst({ where: { id: lineGroupId, companyId: targetCompanyId } });
      if (!group) return NextResponse.json({ error: "ห้อง LINE ไม่อยู่ในบริษัทที่เลือก" }, { status: 400 });
    }
    data.lineGroupId = lineGroupId;
  }
  const isPausing = "isActive" in body && !body.isActive;
  const isResuming = "isActive" in body && !!body.isActive && !existing.isActive;
  if ("isActive" in body) data.isActive = !!body.isActive;
  if (isResuming) {
    data.lastStatus = "UNKNOWN";
    data.lastCheckedAt = null;
    data.lastHttpCode = null;
    data.lastResponseMs = null;
    data.failureStreak = 0;
    data.recoveryStreak = 0;
  }

  try {
    const [systemCases, mobileCases] = await Promise.all([
      prisma.incident.findMany({ where: { linkId: params.id, status: { notIn: ["CLOSED", "PAUSED"] } }, select: { id: true } }),
      prisma.networkIncident.findMany({ where: { linkId: params.id, status: { notIn: ["CLOSED", "PAUSED"] } }, select: { id: true } }),
    ]);
    const audit = [
      ...systemCases.map(i => caseActivity("SYSTEM", i.id, existing, isPausing ? "PAUSED" : "MASTER_UPDATED", isPausing ? "พักการเฝ้าดูจาก Master Data" : "ปรับข้อมูล Master Data", me, { before: { url: existing.url, backupUrl: existing.backupUrl }, after: JSON.parse(JSON.stringify(data)) })),
      ...mobileCases.map(i => caseActivity("MOBILE", i.id, existing, isPausing ? "PAUSED" : "MASTER_UPDATED", isPausing ? "พักการเฝ้าดูจาก Master Data" : "ปรับข้อมูล Master Data", me, { before: { url: existing.url, backupUrl: existing.backupUrl }, after: JSON.parse(JSON.stringify(data)) })),
    ];
    const updateLink = prisma.link.update({
      where: { id: params.id },
      data: data as unknown as Prisma.LinkUpdateInput,
    });
    const link = isPausing
      ? (await prisma.$transaction([
          updateLink,
          ...audit,
          prisma.incident.updateMany({
            where: { linkId: params.id, status: { notIn: ["CLOSED", "PAUSED"] } },
            data: { status: "PAUSED" },
          }),
          prisma.networkIncident.updateMany({
            where: { linkId: params.id, status: { notIn: ["CLOSED", "PAUSED"] } },
            data: { status: "PAUSED" },
          }),
        ]))[0]
      : (await prisma.$transaction([updateLink, ...audit]))[0];
    return NextResponse.json(link);
  } catch (e) {
    return NextResponse.json(
      { error: "แก้ไขไม่สำเร็จ", detail: String(e) },
      { status: 500 }
    );
  }
}

// DELETE /api/links/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canDeleteLinks(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    await prisma.link.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: "ลบไม่สำเร็จ", detail: String(e) },
      { status: 500 }
    );
  }
}
