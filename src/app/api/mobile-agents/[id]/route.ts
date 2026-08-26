import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageMobileAgents } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManageMobileAgents(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const data: { name?: string; isActive?: boolean } = {};
  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "กรุณาระบุชื่อเครื่อง" }, { status: 400 });
    }
    if (body.name.trim().length > 80) {
      return NextResponse.json({ error: "ชื่อเครื่องต้องไม่เกิน 80 ตัวอักษร" }, { status: 400 });
    }
    data.name = body.name.trim();
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  const agent = await prisma.mobileAgent.update({
    where: { id: params.id },
    data: {
      ...data,
      ...(body.isActive === false ? { tokenHash: null, deviceId: null } : {}),
    },
  });
  return NextResponse.json({ agent });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManageMobileAgents(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await prisma.mobileAgent.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
