import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bearerToken, hashSecret } from "@/lib/mobileAgent";

// The bearer identifies exactly one enrollment; never accepts a user/agent ID.
export async function POST(req: NextRequest) {
  const token = bearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tokenHash = hashSecret(token);
  const locked = await prisma.$transaction(async (tx) => {
    const agent = await tx.mobileAgent.findUnique({ where: { tokenHash } });
    if (!agent) return false;
    const now = new Date();
    const changed = await tx.mobileAgent.updateMany({
      where: { id: agent.id, tokenHash },
      data: { isActive: false, tokenHash: null, emergencyLockedAt: now },
    });
    if (changed.count !== 1) return false;
    await tx.mobileEnrollment.updateMany({
      where: { agentId: agent.id, usedAt: null }, data: { usedAt: now },
    });
    return true;
  });
  return NextResponse.json({ ok: locked }, { status: locked ? 200 : 401 });
}
