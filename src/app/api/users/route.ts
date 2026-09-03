import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { canManageUserRole, canManageUsers, isAppRole } from "@/lib/permissions";
import { normalizeAllowedIpRanges } from "@/lib/ipAccess";

export const dynamic = "force-dynamic";

// GET /api/users — รายชื่อผู้ใช้ (แอดมินเท่านั้น)
export async function GET() {
  const me = await getCurrentUser();
  if (!me || !canManageUsers(me.role))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const users = await prisma.user.findMany({
    where: me.role === "ADMIN" ? {} : { role: { not: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, username: true, email: true, role: true, isActive: true, createdAt: true,
      mustChangePassword: true,
      allowedIpRanges: true, lastLoginIp: true, lastLoginAt: true,
      companyAssignments: { select: { companyId: true } },
    },
  });
  return NextResponse.json(users);
}

// POST /api/users — เพิ่มผู้ใช้ (แอดมินเท่านั้น)
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !canManageUsers(me.role))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { name, username, email, password, role, allowedIpRanges } = await req.json().catch(() => ({}));
  if (!name || !username || !email || !password) {
    return NextResponse.json({ error: "กรอกชื่อ, ชื่อผู้ใช้, อีเมล และรหัสผ่าน" }, { status: 400 });
  }
  if (String(password).length < 10) {
    return NextResponse.json({ error: "รหัสผ่านอย่างน้อย 10 ตัวอักษร" }, { status: 400 });
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
    return NextResponse.json({ error: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });
  if (!isAppRole(role)) return NextResponse.json({ error: "บทบาทไม่ถูกต้อง" }, { status: 400 });
  if (!canManageUserRole(me.role, role))
    return NextResponse.json({ error: "เฉพาะแอดมินดูแลระบบเท่านั้นที่สร้างบัญชีระดับแอดมินดูแลระบบได้" }, { status: 403 });
  const exists = await prisma.user.findFirst({ where: { OR: [
    { username: String(username).trim() }, { email: normalizedEmail },
  ] } });
  if (exists) {
    return NextResponse.json({ error: "ชื่อผู้ใช้นี้มีอยู่แล้ว" }, { status: 400 });
  }
  let normalizedIpRanges: string | null;
  try { normalizedIpRanges = normalizeAllowedIpRanges(allowedIpRanges); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "รูปแบบ IP ไม่ถูกต้อง" }, { status: 400 });
  }
  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      username: String(username).trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(String(password)),
      mustChangePassword: true,
      role,
      allowedIpRanges: normalizedIpRanges,
    },
    select: { id: true, name: true, username: true, email: true, role: true, isActive: true, allowedIpRanges: true, mustChangePassword: true },
  });
  return NextResponse.json(user, { status: 201 });
}
