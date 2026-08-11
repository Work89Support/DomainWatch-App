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

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, username: true, role: true, isActive: true },
  });
  return NextResponse.json(user);
}
