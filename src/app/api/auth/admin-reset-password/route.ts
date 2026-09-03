import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { hashPasswordResetToken } from "@/lib/passwordReset";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ error: "เฉพาะแอดมินดูแลระบบเท่านั้น" }, { status: 403 });

  const { token } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !token)
    return NextResponse.json({ error: "ลิงก์ไม่ถูกต้อง" }, { status: 400 });

  const now = new Date();
  const record = await prisma.passwordResetToken.findFirst({
    where: { tokenHash: hashPasswordResetToken(token), usedAt: null, expiresAt: { gt: now }, user: { isActive: true } },
    include: { user: { select: { id: true, name: true, username: true } } },
  });
  if (!record)
    return NextResponse.json({ error: "ลิงก์หมดอายุหรือถูกใช้แล้ว กรุณาให้ผู้ใช้ขอใหม่" }, { status: 400 });

  const temporaryPassword = `DW-R-${crypto.randomBytes(10).toString("base64url")}!`;
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new Error("RESET_TOKEN_ALREADY_USED");
      await tx.user.update({
        where: { id: record.user.id },
        data: {
          passwordHash: hashPassword(temporaryPassword),
          mustChangePassword: true,
          passwordChangedAt: null,
        },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: record.user.id, usedAt: null }, data: { usedAt: now },
      });
    });
  } catch {
    return NextResponse.json({ error: "ลิงก์ถูกใช้แล้ว กรุณาให้ผู้ใช้ขอใหม่" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    user: { name: record.user.name, username: record.user.username },
    temporaryPassword,
  });
}
