import { NextRequest, NextResponse } from "next/server";
import type { LinkStatus } from "@prisma/client";
import { authenticateMobileAgent, storeMobileResults } from "@/lib/mobileAgent";
import { prisma } from "@/lib/prisma";

const VALID_STATUS = new Set<LinkStatus>(["UP", "SLOW", "DOWN"]);

export async function POST(req: NextRequest) {
  const agent = await authenticateMobileAgent(req.headers.get("authorization"));
  if (!agent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const rawResults = Array.isArray(body.results) ? body.results.slice(0, 1000) : [];
  const now = Date.now();
  const results = rawResults.flatMap((item: Record<string, unknown>) => {
    const status = typeof item.status === "string" ? item.status as LinkStatus : "UNKNOWN";
    const checkedAt = new Date(typeof item.checkedAt === "string" ? item.checkedAt : now);
    if (
      typeof item.url !== "string" || typeof item.urlHash !== "string" ||
      !VALID_STATUS.has(status) || Number.isNaN(checkedAt.getTime()) ||
      Math.abs(now - checkedAt.getTime()) > 24 * 60 * 60 * 1000
    ) return [];
    return [{
      url: item.url.slice(0, 3000),
      urlHash: item.urlHash.slice(0, 80),
      status,
      httpCode: typeof item.httpCode === "number" ? Math.trunc(item.httpCode) : null,
      responseMs: typeof item.responseMs === "number" ? Math.max(0, Math.trunc(item.responseMs)) : null,
      error: typeof item.error === "string" ? item.error.slice(0, 1000) : null,
      checkedAt,
    }];
  });
  await prisma.mobileAgent.update({
    where: { id: agent.id },
    data: {
      lastSeenAt: new Date(),
      lastIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      deviceLabel: typeof body.deviceLabel === "string" ? body.deviceLabel.slice(0, 160) : agent.deviceLabel,
      appVersion: typeof body.appVersion === "string" ? body.appVersion.slice(0, 40) : agent.appVersion,
      networkType: typeof body.networkType === "string" ? body.networkType.slice(0, 80) : agent.networkType,
      reportedCarrier: typeof body.reportedCarrier === "string" ? body.reportedCarrier.slice(0, 80) : agent.reportedCarrier,
    },
  });
  const summary = await storeMobileResults(agent.id, results);
  return NextResponse.json({ ok: true, ...summary, receivedAt: new Date().toISOString() });
}
