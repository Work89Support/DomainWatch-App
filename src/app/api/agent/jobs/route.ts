import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileAgent, mobileUrlHash, normalizeUrl } from "@/lib/mobileAgent";
import { prisma } from "@/lib/prisma";
import { recordPresence } from "@/lib/agentPresence";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const agent = await authenticateMobileAgent(req.headers.get("authorization"));
  if (!agent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const links = await prisma.link.findMany({
    where: { isActive: true },
    select: { url: true, backupUrl: true },
  });
  // ตรวจทั้งลิงก์หลักและลิงก์สำรอง เพื่อให้ซิมยืนยันได้ว่า fallback ใช้งานจริง
  const unique = Array.from(new Set(links.flatMap((item) => [item.url, item.backupUrl])
    .filter((url): url is string => Boolean(url?.trim()))
    .map((url) => normalizeUrl(url))));
  const active = await prisma.$transaction(async tx => {
    const changed = await tx.mobileAgent.updateMany({ where: { id: agent.id, isActive: true, tokenHash: agent.tokenHash }, data: { lastSeenAt: new Date() } });
    if (changed.count) await recordPresence(tx, agent.id, "HEARTBEAT");
    return changed.count === 1;
  });
  if (!active) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({
    agent: { id: agent.id, name: agent.name, carrier: agent.carrier },
    routeMode: agent.routeMode,
    intervalSeconds: 300,
    slowResponseMs: Number(process.env.SLOW_RESPONSE_MS || 5000),
    jobs: unique.map((url) => ({ url, urlHash: mobileUrlHash(url) })),
    issuedAt: new Date().toISOString(),
  });
}
