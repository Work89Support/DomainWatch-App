import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSessionToken, COOKIE_NAME } from "@/lib/auth";
import { getClientIp, isIpAllowed } from "@/lib/ipAccess";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) {
    return NextResponse.json({ error: "กรอกชื่อผู้ใช้และรหัสผ่าน" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({
    where: { username: String(username).trim() },
  });
  if (!user || !user.isActive || !verifyPassword(String(password), user.passwordHash)) {
    return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }
  const clientIp = getClientIp(req.headers);
  if (!isIpAllowed(clientIp, user.allowedIpRanges)) {
    return NextResponse.json({
      error: `IP นี้ไม่ได้รับอนุญาต${clientIp ? ` (${clientIp})` : ""} กรุณาติดต่อแอดมิน`,
    }, { status: 403 });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginIp: clientIp, lastLoginAt: new Date() },
  });
  const token = createSessionToken(user.id, user.passwordHash);
  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, role: user.role },
    redirectTo: user.mustChangePassword
      ? "/change-password"
      : user.role === "SITE_STAFF" ? "/agents" : "/",
  });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 วัน
  });
  return res;
}
