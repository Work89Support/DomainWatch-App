import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken, isValidEmail, normalizeEmail, sendAdminPasswordResetEmail } from "@/lib/passwordReset";

export const dynamic = "force-dynamic";
const GENERIC_MESSAGE = "หากอีเมลนี้อยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ให้แล้ว";

export async function POST(req: NextRequest) {
  const { email: rawEmail } = await req.json().catch(() => ({}));
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return NextResponse.json({ message: GENERIC_MESSAGE });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.isActive) return NextResponse.json({ message: GENERIC_MESSAGE });

  // จำกัดการส่งซ้ำต่อบัญชี เพื่อป้องกันอีเมลรบกวนและการกดถี่โดยไม่ตั้งใจ
  const recentRequest = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60_000) } },
    select: { id: true },
  });
  if (recentRequest) return NextResponse.json({ message: GENERIC_MESSAGE });

  const token = createPasswordResetToken();
  const record = await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: token.tokenHash, expiresAt: token.expiresAt },
  });
  const appBaseUrl = process.env.APP_BASE_URL || req.nextUrl.origin;
  const approvalUrl = `${appBaseUrl.replace(/\/$/, "")}/admin/password-reset?token=${encodeURIComponent(token.rawToken)}`;
  const adminEmail = normalizeEmail(process.env.RESET_ADMIN_EMAIL);
  try {
    if (!isValidEmail(adminEmail)) throw new Error("Reset admin email is not configured");
    await sendAdminPasswordResetEmail({
      adminEmail,
      approvalUrl,
      requestedName: user.name,
      requestedUsername: user.username,
    });
  } catch (error) {
    await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => undefined);
    console.error("Password reset delivery failed", error instanceof Error ? error.message : "unknown error");
  }
  return NextResponse.json({ message: GENERIC_MESSAGE });
}
