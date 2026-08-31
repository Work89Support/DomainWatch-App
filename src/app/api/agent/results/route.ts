import { NextRequest, NextResponse } from "next/server";
import type { LinkStatus } from "@prisma/client";
import { authenticateMobileAgent, storeMobileResults } from "@/lib/mobileAgent";
import { prisma } from "@/lib/prisma";
import { getRequestGeo, hasRequestGeo } from "@/lib/requestGeo";

const VALID_STATUS = new Set<LinkStatus>(["UP", "SLOW", "DOWN"]);
const VALID_ROUTE_MODES = new Set(["CELLULAR_DIRECT", "VPN_DEFAULT"]);

export async function POST(req: NextRequest) {
  const agent = await authenticateMobileAgent(req.headers.get("authorization"));
  if (!agent) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const routeModeUsed = typeof body.routeModeUsed === "string" && VALID_ROUTE_MODES.has(body.routeModeUsed)
    ? body.routeModeUsed
    : null;
  const geo = getRequestGeo(req.headers);
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
      finalUrl: typeof item.finalUrl === "string" ? item.finalUrl.slice(0, 3000) : null,
      redirectCount: typeof item.redirectCount === "number" ? Math.min(10, Math.max(0, Math.trunc(item.redirectCount))) : 0,
      redirectChain: Array.isArray(item.redirectChain)
        ? item.redirectChain.filter((url): url is string => typeof url === "string").slice(0, 12).map((url) => url.slice(0, 3000))
        : [],
      pageTitle: typeof item.pageTitle === "string" ? item.pageTitle.slice(0, 200) : null,
      blockPageDetected: item.blockPageDetected === true,
      checkedAt,
    }];
  });
  await prisma.mobileAgent.update({
    where: { id: agent.id },
    data: {
      lastSeenAt: new Date(),
      deviceLabel: typeof body.deviceLabel === "string" ? body.deviceLabel.slice(0, 160) : agent.deviceLabel,
      appVersion: typeof body.appVersion === "string" ? body.appVersion.slice(0, 40) : agent.appVersion,
      networkType: typeof body.networkType === "string" ? body.networkType.slice(0, 80) : agent.networkType,
      reportedCarrier: typeof body.reportedCarrier === "string" ? body.reportedCarrier.slice(0, 80) : agent.reportedCarrier,
      lastRouteMode: routeModeUsed || agent.lastRouteMode,
      ...(routeModeUsed === agent.routeMode && hasRequestGeo(geo) ? {
        egressCountry: geo.country,
        egressRegion: geo.region,
        egressCity: geo.city,
        egressUpdatedAt: new Date(),
      } : {}),
    },
  });
  const summary = await storeMobileResults(agent.id, results);
  return NextResponse.json({ ok: true, ...summary, receivedAt: new Date().toISOString() });
}
