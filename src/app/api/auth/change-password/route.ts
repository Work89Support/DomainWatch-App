import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COOKIE_NAME, createSessionToken, getSessionUser, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
  const { password } = await req.json().catch(() => ({}));
  if (typeof password !== "string" || password.length < 10) {
    return NextResponse.json({ error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 10 ตัวอักษร" }, { status: 400 });
  }

  const passwordHash = hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date() },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  const response = NextResponse.json({
    ok: true,
    redirectTo: user.role === "SITE_STAFF" ? "/agents" : "/",
  });
  response.cookies.set(COOKIE_NAME, createSessionToken(user.id, passwordHash), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
