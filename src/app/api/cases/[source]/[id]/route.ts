import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canActAsAdmin, canActAsIt, canViewIncidents, canAccessCompany } from "@/lib/permissions";
import { caseActivity, isCaseClosed } from "@/lib/caseActivity";
import { Prisma } from "@prisma/client";
import { activeWaiting, waitingInput, forwardingInput, WaitingDetails } from "@/lib/caseWaiting";

export async function POST(req: NextRequest, { params }: { params: { source: string; id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canViewIncidents(me.role) || !(canActAsAdmin(me.role) || canActAsIt(me.role))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!["SYSTEM", "MOBILE"].includes(params.source)) return NextResponse.json({ error: "แหล่งเคสไม่ถูกต้อง" }, { status: 400 });
  const source = params.source as "SYSTEM" | "MOBILE";
  const incident = source === "SYSTEM"
    ? await prisma.incident.findUnique({ where: { id: params.id }, include: { link: { include: { company: true } } } })
    : await prisma.networkIncident.findUnique({ where: { id: params.id }, include: { link: { include: { company: true } } } });
  if (!incident) return NextResponse.json({ error: "ไม่พบเคส" }, { status: 404 });
  if (!canAccessCompany(me.role, me.companyIds, incident.link.companyId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (isCaseClosed(incident.status)) return NextResponse.json({ error: "เคสปิดหรือพักแล้ว ดูประวัติได้แต่รับซ้ำไม่ได้" }, { status: 409 });
  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > 2000) return NextResponse.json({ error: "หมายเหตุต้องไม่เกิน 2,000 ตัวอักษร" }, { status: 400 });
  if (body.action === "WAIT" || body.action === "RESUME" || body.action === "FORWARD") {
    const it = source === "SYSTEM" && me.role === "IT";
    if (source === "MOBILE" && !canActAsAdmin(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const ownerId = it && "itUserId" in incident ? incident.itUserId : incident.adminUserId;
    const ackAt = it && "itAckAt" in incident ? incident.itAckAt : incident.adminAckAt;
    if (!ackAt || ownerId !== me.id) return NextResponse.json({ error: "ผู้รับเคสต้องเป็นผู้บันทึกสถานะรอ กรุณารับเคสก่อน" }, { status: 403 });
    if (!["OPEN", "IT_RESOLVED"].includes(incident.status)) return NextResponse.json({ error: "เคสนี้อยู่ขั้นตรวจยืนยันแล้ว ไม่สามารถเปลี่ยนเป็นรอแก้ไข" }, { status: 409 });
    const now = new Date();
    let waiting: WaitingDetails | undefined;
    try {
      if (body.action === "FORWARD") waiting = { ...forwardingInput(body), since: now.toISOString(), owner: me.name };
      else if (body.action === "WAIT") waiting = { ...waitingInput(body, now), since: activeWaiting(incident)?.since || now.toISOString(), owner: me.name };
      else if (!activeWaiting(incident)) return NextResponse.json({ error: "เคสไม่ได้อยู่ระหว่างรอแก้ไข" }, { status: 409 });
    } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
    try {
      await prisma.$transaction(async tx => {
        const args = { where: { id: incident.id, updatedAt: incident.updatedAt, status: incident.status }, data: { waitingDetails: waiting || Prisma.DbNull } };
        const result = source === "SYSTEM" ? await tx.incident.updateMany(args) : await tx.networkIncident.updateMany(args);
        if (!result.count) throw new Error("CHANGED");
        await tx.caseActivity.create({ data: { source, caseId: incident.id, companyId: incident.link.companyId, companyName: incident.link.company.name, linkName: incident.link.name, url: incident.link.url, action: body.action, actorId: me.id, actorName: me.name, note: waiting?.kind === "forwarded" ? `ส่งต่อแล้ว — รอติดตาม · ส่งให้: ${waiting.recipient} · งาน: ${waiting.reason}` : waiting ? `รับเคสแล้ว — รอแก้ไข: ${waiting.reason} · ${waiting.impact}` : "กลับมาดำเนินการแก้ไขต่อ", details: { before: incident.waitingDetails, after: waiting || null, kpiPaused: false }, createdAt: now } });
      });
    } catch (e) {
      if (e instanceof Error && e.message === "CHANGED") return NextResponse.json({ error: "เคสเปลี่ยนแปลงแล้ว กรุณารีเฟรชก่อนบันทึก" }, { status: 409 });
      throw e;
    }
    return NextResponse.json({ ok: true });
  }
  if (body.action === "ESCALATE" || body.action === "NOTE") {
    if (!note) return NextResponse.json({ error: "กรุณาระบุผู้รับผิดชอบที่ส่งต่อ สาเหตุ หรือรายละเอียดการดำเนินการ" }, { status: 400 });
    await caseActivity(source, incident.id, incident.link, body.action, note, me);
    return NextResponse.json({ ok: true });
  }
  if (body.action !== "ACK") return NextResponse.json({ error: "action ไม่ถูกต้อง" }, { status: 400 });
  const it = source === "SYSTEM" && me.role === "IT";
  if (source === "MOBILE" && !canActAsAdmin(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const updated = source === "MOBILE"
        ? await tx.networkIncident.updateMany({ where: { id: incident.id, adminAckAt: null, status: { notIn: ["CLOSED", "PAUSED"] } }, data: { adminAckAt: now, adminAckUserName: me.name, adminUserId: me.id } })
        : await tx.incident.updateMany({ where: { id: incident.id, ...(it ? { itAckAt: null } : { adminAckAt: null }), status: { notIn: ["CLOSED", "PAUSED"] } }, data: it ? { itAckAt: now, itAckUserName: me.name, itUserId: me.id } : { adminAckAt: now, adminAckUserName: me.name, adminUserId: me.id } });
      if (!updated.count) throw new Error("CLAIMED");
      await tx.caseActivity.create({ data: { source, caseId: incident.id, companyId: incident.link.companyId, companyName: incident.link.company.name, linkName: incident.link.name, url: incident.link.url, action: "ACK", actorId: me.id, actorName: me.name, note: it ? "ไอทีรับเรื่อง" : "แอดมินรับเรื่อง", createdAt: now } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CLAIMED") return NextResponse.json({ error: "มีผู้รับเรื่องแล้ว กรุณารีเฟรชเพื่อดูผู้รับผิดชอบ" }, { status: 409 });
    throw error;
  }
  return NextResponse.json({ ok: true });
}
