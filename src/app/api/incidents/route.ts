import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { canAccessCompany, canViewIncidents } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// GET /api/incidents?status=open|all&companyId=...
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canViewIncidents(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "all";
  const companyId = url.searchParams.get("companyId") || undefined;
  if (companyId && !canAccessCompany(me.role, me.companyIds, companyId))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const companyScope = me.role === "ADMIN_COMPANY" ? (companyId || { in: me.companyIds }) : companyId;
  const where: Prisma.IncidentWhereInput = {
    ...(status === "open" ? { status: { notIn: ["CLOSED", "PAUSED"] } } : {}),
    ...(companyScope ? { link: { companyId: companyScope } } : {}),
  };

  const incidents = await prisma.incident.findMany({
    where,
    orderBy: { detectedAt: "desc" },
    take: 200,
    include: { link: { include: { company: true } } },
  });
  return NextResponse.json(incidents);
}
