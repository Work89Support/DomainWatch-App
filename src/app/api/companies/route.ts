import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/companies — บริษัททั้งหมด (พร้อมห้อง LINE และจำนวนลิงก์)
export async function GET() {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      note: true,
      isActive: true,
      createdAt: true,
      tgChatId: true,
      lineGroups: {
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
      },
      _count: { select: { links: true } },
    },
  });
  return NextResponse.json(companies);
}

// POST /api/companies — เพิ่มบริษัท
export async function POST(req: NextRequest) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "ต้องระบุชื่อบริษัท" }, { status: 400 });
  }
  const company = await prisma.company.create({
    data: {
      name: String(body.name).trim(),
      note: body.note?.trim() || null,
    },
  });
  return NextResponse.json(company, { status: 201 });
}
