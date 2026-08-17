import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canAccessCompany, canCreateLinks, canViewLinks } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// GET /api/links?companyId=... — รายการลิงก์ (กรองตามบริษัทได้)
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canViewLinks(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId") || undefined;
  if (companyId && !canAccessCompany(me.role, me.companyIds, companyId))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const where = me.role === "ADMIN_COMPANY"
    ? { companyId: companyId || { in: me.companyIds } }
    : (companyId ? { companyId } : {});
  const links = await prisma.link.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      companyId: true,
      lineGroupId: true,
      name: true,
      url: true,
      category: true,
      backupUrl: true,
      note: true,
      isActive: true,
      lastStatus: true,
      lastCheckedAt: true,
      lastHttpCode: true,
      lastResponseMs: true,
      company: { select: { id: true, name: true } },
      lineGroup: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(links);
}

// POST /api/links — เพิ่มลิงก์ใหม่
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canCreateLinks(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  if (!body?.name || !body?.url || !body?.companyId) {
    return NextResponse.json(
      { error: "ต้องระบุ companyId, name และ url" },
      { status: 400 }
    );
  }
  if (body.lineGroupId) {
    const group = await prisma.lineGroup.findFirst({
      where: { id: String(body.lineGroupId), companyId: String(body.companyId) },
    });
    if (!group) return NextResponse.json({ error: "ห้อง LINE ไม่อยู่ในบริษัทที่เลือก" }, { status: 400 });
  }
  try {
    const link = await prisma.link.create({
      data: {
        companyId: String(body.companyId),
        lineGroupId: body.lineGroupId || null,
        name: String(body.name).trim(),
        url: String(body.url).trim(),
        category: body.category?.trim() || "ทั่วไป",
        backupUrl: body.backupUrl?.trim() || null,
        note: body.note?.trim() || null,
        isActive: body.isActive ?? true,
      },
    });
    return NextResponse.json(link, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "บันทึกไม่สำเร็จ", detail: String(e) },
      { status: 500 }
    );
  }
}
