import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canEditCrmLinks } from "@/lib/permissions";
import { normalizeCrmUrl } from "@/lib/crmLink";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canEditCrmLinks(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const data: { name?: string; url?: string; note?: string | null; isActive?: boolean; lastStatus?: "UNKNOWN" } = {};
  if ("name" in body) {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "กรุณาระบุชื่อ" }, { status: 400 });
    data.name = name;
  }
  if ("url" in body) {
    const url = normalizeCrmUrl(body.url);
    if (!url) return NextResponse.json({ error: "URL ไม่ถูกต้อง" }, { status: 400 });
    data.url = url;
    data.lastStatus = "UNKNOWN";
  }
  if ("note" in body) data.note = String(body.note || "").trim() || null;
  if ("isActive" in body) data.isActive = Boolean(body.isActive);
  try {
    const link = await prisma.crmLink.update({ where: { id: params.id }, data });
    return NextResponse.json(link);
  } catch {
    return NextResponse.json({ error: "ไม่พบรายการหรือ URL ซ้ำ" }, { status: 409 });
  }
}
