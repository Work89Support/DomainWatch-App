import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { hashPasswordResetToken } from "@/lib/passwordReset";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !token || typeof password !== "string" || password.length < 10) {
    return NextResponse.json({ error: "ลิงก์ไม่ถูกต้อง หรือรหัสผ่านสั้นกว่า 10 ตัวอักษร" }, { status: 400 });
  }
  const tokenHash = hashPasswordResetToken(token);
  const record = await prisma.passwordResetToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() }, user: { isActive: true } },
  });
  if (!record) return NextResponse.json({ error: "ลิงก์หมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่" }, { status: 400 });

  const now = new Date();
  const passwordHash = hashPassword(password);
  try {
    await prisma.$transaction(async (tx) => {
      // ยึด token แบบ atomic: ถ้ามีคำขอสองอันพร้อมกัน มีเพียงอันแรกที่เปลี่ยนรหัสได้
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new Error("RESET_TOKEN_ALREADY_USED");
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, mustChangePassword: false, passwordChangedAt: now },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null }, data: { usedAt: now },
      });
    });
  } catch {
    return NextResponse.json({ error: "ลิงก์หมดอายุหรือถูกใช้แล้ว กรุณาขอลิงก์ใหม่" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
