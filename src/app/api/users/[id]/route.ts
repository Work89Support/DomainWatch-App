import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PATCH /api/users/[id] — รีเซ็ตรหัส / เปิด-ปิดการใช้งาน / เปลี่ยนบทบาท (แอดมินเท่านั้น)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.password) {
    if (String(body.password).length < 6)
      return NextResponse.json({ error: "รหัสผ่านอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
    data.passwordHash = hashPassword(String(body.password));
  }
  if ("isActive" in body) data.isActive = !!body.isActive;
  if (body.role === "IT" || body.role === "ADMIN") data.role = body.role;
  if (body.name) data.name = String(body.name).trim();

  // ต้องมีผู้ใช้จริง
  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });

  const willDeactivate = "isActive" in body && !body.isActive;
  const willDemote = body.role === "IT";

  // กันล็อกตัวเองออก: แอดมินห้ามปิดการใช้งาน/ลดสิทธิ์บัญชีตัวเอง
  if (me.id === target.id && (willDeactivate || willDemote)) {
    return NextResponse.json(
      { error: "ห้ามปิดการใช้งานหรือลดสิทธิ์บัญชีของตัวเอง" },
      { status: 400 }
    );
  }

  // กันเหลือแอดมินที่ใช้งานได้ 0 คน
  if (target.role === "ADMIN" && target.isActive && (willDeactivate || willDemote)) {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    if (activeAdmins <= 1) {
      return NextResponse.json(
        { error: "ต้องมีผู้ดูแลระบบ (ADMIN) ที่ใช้งานได้อย่างน้อย 1 คน" },
        { status: 400 }
      );
    }
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, username: true, role: true, isActive: true },
  });
  return NextResponse.json(user);
}
