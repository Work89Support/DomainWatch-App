import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function guard() {
  return (await getCurrentUser()) ? null : NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

// PATCH /api/linegroups/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const g = await guard(); if (g) return g;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("name" in body) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "ชื่อห้องห้ามว่าง" }, { status: 400 });
    data.name = name;
  }
  if ("note" in body) data.note = body.note?.trim() || null;
  if ("isActive" in body) data.isActive = !!body.isActive;
  if ("channelAccessToken" in body) data.channelAccessToken = body.channelAccessToken?.trim() || null;
  if ("expectedOaName" in body) data.expectedOaName = body.expectedOaName?.trim() || null;
  const group = await prisma.lineGroup.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(group);
}

// DELETE /api/linegroups/[id] — ลบห้อง (ลิงก์ในห้องจะถูกตั้ง lineGroupId เป็นว่าง แต่ยังอยู่ในบริษัท)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const g = await guard(); if (g) return g;
  try {
    await prisma.lineGroup.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: "ลบไม่สำเร็จ", detail: String(e) },
      { status: 500 }
    );
  }
}
