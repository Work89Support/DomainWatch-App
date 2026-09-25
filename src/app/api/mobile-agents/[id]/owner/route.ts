import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageMobileAgents } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { recordPresence } from "@/lib/agentPresence";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManageMobileAgents(actor.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || (body.ownerId !== null && typeof body.ownerId !== "string") ||
    (body.expectedOwnerId !== null && typeof body.expectedOwnerId !== "string")) {
    return NextResponse.json({ error: "ข้อมูลผู้ดูแลไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    const assignment = await prisma.$transaction(async tx => {
      const agent = await tx.mobileAgent.findUnique({ where: { id: params.id } });
      if (!agent) throw new Error("NOT_FOUND");
      if (agent.siteOwnerId !== body.expectedOwnerId) throw new Error("STALE");
      const owner = body.ownerId ? await tx.user.findFirst({ where: { id: body.ownerId, role: "SITE_STAFF", isActive: true }, select: { id: true, name: true } }) : null;
      if (body.ownerId !== null && !owner) throw new Error("INVALID_OWNER");
      if (agent.siteOwnerId === body.ownerId) return { owner, assignedAt: agent.siteAssignedAt };
      const now = new Date();
      const changed = await tx.mobileAgent.updateMany({ where: { id: agent.id, siteOwnerId: body.expectedOwnerId }, data: { siteOwnerId: body.ownerId, siteAssignedAt: now } });
      if (changed.count !== 1) throw new Error("STALE");
      await recordPresence(tx, agent.id, "OWNER");
      await tx.agentAssignment.create({ data: { agentId: agent.id, agentName: agent.name, previousOwnerId: agent.siteOwnerId,
        ownerId: owner?.id, ownerName: owner?.name, assignedById: actor.id, assignedByName: actor.name, createdAt: now } });
      return { owner, assignedAt: now };
    });
    return NextResponse.json({ ok: true, ...assignment });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "NOT_FOUND") return NextResponse.json({ error: "ไม่พบเครื่องตรวจ" }, { status: 404 });
    if (code === "INVALID_OWNER") return NextResponse.json({ error: "เลือกพนักงานหน้าไซต์ที่เปิดใช้งานเท่านั้น" }, { status: 400 });
    if (code === "STALE") return NextResponse.json({ error: "ผู้ดูแลเปลี่ยนแล้ว กรุณารีเฟรช" }, { status: 409 });
    throw e;
  }
}
