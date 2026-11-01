import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canEditCrmLinks, canViewCrmLinks } from "@/lib/permissions";
import { normalizeCrmUrl } from "@/lib/crmLink";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canViewCrmLinks(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const links = await prisma.crmLink.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] });
  return NextResponse.json(links);
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canEditCrmLinks(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const url = normalizeCrmUrl(body.url);
  if (!name || !url) return NextResponse.json({ error: "กรุณาระบุชื่อและ URL ที่ถูกต้อง" }, { status: 400 });
  try {
    const link = await prisma.crmLink.create({
      data: { name, url, note: String(body.note || "").trim() || null, isActive: body.isActive !== false },
    });
    return NextResponse.json(link, { status: 201 });
  } catch {
    return NextResponse.json({ error: "URL นี้มีอยู่แล้วหรือบันทึกไม่สำเร็จ" }, { status: 409 });
  }
}
