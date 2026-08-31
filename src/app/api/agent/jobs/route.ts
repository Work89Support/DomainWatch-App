import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileAgent, mobileUrlHash, normalizeUrl } from "@/lib/mobileAgent";
import { prisma } from "@/lib/prisma";

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
  await prisma.mobileAgent.update({
    where: { id: agent.id },
    data: { lastSeenAt: new Date() },
  });
  return NextResponse.json({
    agent: { id: agent.id, name: agent.name, carrier: agent.carrier },
    intervalSeconds: 300,
    slowResponseMs: Number(process.env.SLOW_RESPONSE_MS || 5000),
    jobs: unique.map((url) => ({ url, urlHash: mobileUrlHash(url) })),
    issuedAt: new Date().toISOString(),
  });
}
