import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessCompany, canManageCompanies, canViewLinks } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// GET /api/linegroups?companyId=... — ห้อง LINE ของบริษัท
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canViewLinks(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId") || undefined;
  if (companyId && !canAccessCompany(me.role, me.companyIds, companyId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const groups = await prisma.lineGroup.findMany({
    where: companyId ? { companyId } : {},
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      companyId: true,
      name: true,
      note: true,
      isActive: true,
      expectedOaName: true,
      oaStatus: true,
      oaDisplayName: true,
      oaHasPicture: true,
      oaLastCheckedAt: true,
      oaError: true,
    },
  });
  return NextResponse.json(groups);
}

// POST /api/linegroups — เพิ่มห้อง LINE
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManageCompanies(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  if (!body?.companyId || !body?.name?.trim()) {
    return NextResponse.json(
      { error: "ต้องระบุ companyId และชื่อห้อง" },
      { status: 400 }
    );
  }
  // ตรวจว่าบริษัทมีอยู่จริง ก่อนสร้าง (กัน error 500 จาก foreign key)
  const company = await prisma.company.findUnique({ where: { id: String(body.companyId) } });
  if (!company) {
    return NextResponse.json({ error: "ไม่พบบริษัทที่ระบุ" }, { status: 400 });
  }
  try {
    const group = await prisma.lineGroup.create({
      data: {
        companyId: String(body.companyId),
        name: String(body.name).trim(),
        note: body.note?.trim() || null,
      },
    });
    return NextResponse.json(group, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "เพิ่มห้องไม่สำเร็จ", detail: String(e) },
      { status: 500 }
    );
  }
}
