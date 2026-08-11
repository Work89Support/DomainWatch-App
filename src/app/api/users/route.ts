import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/users — รายชื่อผู้ใช้ (แอดมินเท่านั้น)
export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, username: true, role: true, isActive: true, createdAt: true },
  });
  return NextResponse.json(users);
}

// POST /api/users — เพิ่มผู้ใช้ (แอดมินเท่านั้น)
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { name, username, password, role } = await req.json().catch(() => ({}));
  if (!name || !username || !password) {
    return NextResponse.json({ error: "กรอกชื่อ, ชื่อผู้ใช้ และรหัสผ่าน" }, { status: 400 });
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: "รหัสผ่านอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
  }
  const exists = await prisma.user.findUnique({ where: { username: String(username).trim() } });
  if (exists) {
    return NextResponse.json({ error: "ชื่อผู้ใช้นี้มีอยู่แล้ว" }, { status: 400 });
  }
  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      username: String(username).trim(),
      passwordHash: hashPassword(String(password)),
      role: role === "IT" ? "IT" : "ADMIN",
    },
    select: { id: true, name: true, username: true, role: true, isActive: true },
  });
  return NextResponse.json(user, { status: 201 });
}
