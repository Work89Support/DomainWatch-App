import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessCompany, canEditLinks } from "@/lib/permissions";
import { sameLinkUrl } from "@/lib/bulkLink";
import { normalizeReplacementUrl } from "@/lib/replacementLink";
import { minutesBetween } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canEditLinks(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const seed = await prisma.link.findUnique({ where: { id: req.nextUrl.searchParams.get("id") || "" } });
  if (!seed || !canAccessCompany(me.role, me.companyIds, seed.companyId)) return NextResponse.json({ error: "ไม่พบรายการหรือไม่มีสิทธิ์" }, { status: 404 });
  const links = await prisma.link.findMany({ where: { companyId: seed.companyId, isActive: true }, include: { lineGroup: true } });
  return NextResponse.json({ companyId: seed.companyId, oldUrl: seed.url, canMain: canEditLinks(me.role),
    links: links.filter(l => sameLinkUrl(l.url, seed.url)).map(l => ({ id: l.id, name: l.name, room: l.lineGroup?.name || "ไม่ระบุห้อง", url: l.url, backupUrl: l.backupUrl, updatedAt: l.updatedAt })) });
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || !["url", "backupUrl"].includes(body.field) || typeof body.companyId !== "string" || typeof body.oldUrl !== "string" || !Array.isArray(body.links) || !body.links.length || body.links.length > 1000) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  if (!canAccessCompany(me.role, me.companyIds, body.companyId) || !canEditLinks(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const value = typeof body.value === "string" ? normalizeReplacementUrl(body.value) : null;
  if (!value || body.links.some((l: {id?: unknown; updatedAt?: unknown}) => !l || typeof l.id !== "string" || typeof l.updatedAt !== "string" || !Number.isFinite(Date.parse(l.updatedAt)))) return NextResponse.json({ error: "กรุณาใส่ URL เต็มและเลือกรายการใหม่" }, { status: 400 });
  const ids = body.links.map((l: {id: string}) => l.id);
  if (new Set(ids).size !== ids.length) return NextResponse.json({ error: "รายการซ้ำ" }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > 2000) return NextResponse.json({ error: "หมายเหตุไม่เกิน 2,000 ตัวอักษร" }, { status: 400 });
  try {
    const count = await prisma.$transaction(async tx => {
      const links = await tx.link.findMany({ where: { id: { in: ids }, companyId: body.companyId, isActive: true }, include: { company: true } });
      if (links.length !== ids.length || links.some(l => !sameLinkUrl(l.url, body.oldUrl) || l.updatedAt.toISOString() !== body.links.find((s: {id: string}) => s.id === l.id).updatedAt)) throw new Error("STALE");
      const now = new Date();
      for (const link of links) {
        if (sameLinkUrl(body.field === "url" ? link.url : link.backupUrl || "", value)) continue;
        const changed = await tx.link.updateMany({ where: { id: link.id, updatedAt: link.updatedAt, isActive: true }, data: {
          [body.field]: value,
          ...(body.field === "url" ? { lastStatus: "UNKNOWN", lastCheckedAt: null, lastHttpCode: null, lastResponseMs: null, failureStreak: 0, recoveryStreak: 0 } : {}),
        } });
        if (changed.count !== 1) throw new Error("STALE");
        const where = { linkId: link.id, status: { notIn: ["CLOSED", "PAUSED"] as ("CLOSED" | "PAUSED")[] } };
        const mobile = await tx.networkIncident.findMany({ where });
        const system = await tx.incident.findMany({ where });
        for (const [source, cases] of [["MOBILE", mobile], ["SYSTEM", system]] as const) {
          for (const c of cases) {
            const data = { status: "ADMIN_UPDATED" as const, resolvedAt: null, adminUpdatedAt: now, adminResponseMin: minutesBetween(c.detectedAt, now), adminUserId: me.id };
            if (source === "MOBILE") await tx.networkIncident.update({ where: { id: c.id }, data });
            else await tx.incident.update({ where: { id: c.id }, data });
            await tx.caseActivity.create({ data: { source, caseId: c.id, companyId: link.companyId, companyName: link.company.name, linkName: link.name, url: link.url,
              action: "BULK_LINK_UPDATED", actorId: me.id, actorName: me.name, note: note || "แก้ลิงก์พร้อมกันหลายห้อง รอตรวจยืนยัน",
              details: { field: body.field, before: body.field === "url" ? link.url : link.backupUrl, after: value, editedAt: now.toISOString(), selectedCount: ids.length } } });
          }
        }
      }
      return links.filter(l => !sameLinkUrl(body.field === "url" ? l.url : l.backupUrl || "", value)).length;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
    return NextResponse.json({ ok: true, count });
  } catch {
    return NextResponse.json({ error: "ยังไม่ได้บันทึก รายการอาจถูกแก้ไขระหว่างทำงาน กรุณาปิดแล้วเปิดตรวจรายการใหม่" }, { status: 409 });
  }
}
