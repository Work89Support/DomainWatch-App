import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewIncidents } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canViewIncidents(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const requestedPage = Number(p.get("page") || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const from = p.get("from"), to = p.get("to");
  const start = from ? new Date(`${from}T00:00:00+07:00`) : undefined;
  const end = to ? new Date(`${to}T23:59:59.999+07:00`) : undefined;
  if ((start && isNaN(+start)) || (end && isNaN(+end)) || (start && end && start > end)) return NextResponse.json({ error: "ช่วงวันที่ไม่ถูกต้อง" }, { status: 400 });
  const where = {
    ...(p.get("caseId") ? { caseId: p.get("caseId")! } : {}),
    ...(p.get("source") ? { source: p.get("source")! } : {}),
    ...(p.get("q") ? { OR: ["caseId", "actorName", "linkName", "companyName", "note"].map(key => ({ [key]: { contains: p.get("q")!, mode: "insensitive" as const } })) } : {}),
    ...(start || end ? { createdAt: { gte: start, lte: end } } : {}),
  };
  const [total, events] = await prisma.$transaction([
    prisma.caseActivity.count({ where }),
    prisma.caseActivity.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 50, take: 50 }),
  ]);
  return NextResponse.json({ total, events, page, pageCount: Math.max(1, Math.ceil(total / 50)) });
}
