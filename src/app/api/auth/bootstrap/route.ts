import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSessionToken, COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

// สร้างผู้ดูแลระบบคนแรก — ใช้ได้เฉพาะตอนที่ยังไม่มีผู้ใช้เลย
export async function POST(req: NextRequest) {
  const count = await prisma.user.count();
  if (count > 0) {
    return NextResponse.json(
      { error: "มีผู้ใช้ในระบบแล้ว — เพิ่มผู้ใช้ผ่านหน้าจัดการผู้ใช้แทน" },
      { status: 400 }
    );
  }
  const { name, username, password } = await req.json().catch(() => ({}));
  if (!name || !username || !password) {
    return NextResponse.json({ error: "กรอกชื่อ, ชื่อผู้ใช้ และรหัสผ่าน" }, { status: 400 });
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: "รหัสผ่านอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
  }
  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      username: String(username).trim(),
      passwordHash: hashPassword(String(password)),
      role: "ADMIN",
    },
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, createSessionToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

// เช็คว่ามีผู้ใช้ในระบบหรือยัง (ให้หน้า /setup ใช้)
export async function GET() {
  const count = await prisma.user.count();
  return NextResponse.json({ hasUsers: count > 0 });
}
