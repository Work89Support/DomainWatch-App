import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageMobileAgents } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManageMobileAgents(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const data: {
    name?: string;
    isActive?: boolean;
    routeMode?: "CELLULAR_DIRECT" | "VPN_DEFAULT";
    lastRouteMode?: null;
    egressCountry?: null;
    egressRegion?: null;
    egressCity?: null;
    egressUpdatedAt?: null;
  } = {};
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
  if ("routeMode" in body) {
    if (body.routeMode !== "CELLULAR_DIRECT" && body.routeMode !== "VPN_DEFAULT") {
      return NextResponse.json({ error: "โหมดเส้นทางตรวจไม่ถูกต้อง" }, { status: 400 });
    }
    data.routeMode = body.routeMode;
    // ป้องกันการแสดงตำแหน่งจากโหมดเดิมหลังสลับเส้นทาง
    data.lastRouteMode = null;
    data.egressCountry = null;
    data.egressRegion = null;
    data.egressCity = null;
    data.egressUpdatedAt = null;
  }
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
