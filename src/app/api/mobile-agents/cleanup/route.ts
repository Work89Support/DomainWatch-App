import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageMobileAgents } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManageMobileAgents(user.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [incidents, downLogs, statuses] = await prisma.$transaction([
    prisma.networkIncident.deleteMany(),
    prisma.mobileCheckLog.deleteMany({ where: { status: "DOWN" } }),
    prisma.mobileUrlStatus.updateMany({
      data: {
        status: "UNKNOWN",
        httpCode: null,
        responseMs: null,
        error: null,
        failureStreak: 0,
        recoveryStreak: 0,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    removedIncidents: incidents.count,
    removedDownLogs: downLogs.count,
    resetStatuses: statuses.count,
  });
}
