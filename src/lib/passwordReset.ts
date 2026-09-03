import crypto from "crypto";

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function createPasswordResetToken(): { rawToken: string; tokenHash: string; expiresAt: Date } {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  return {
    rawToken,
    tokenHash: hashPasswordResetToken(rawToken),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  };
}

export function hashPasswordResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function sendAdminPasswordResetEmail(input: {
  adminEmail: string;
  approvalUrl: string;
  requestedName: string;
  requestedUsername: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESET_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Password reset email is not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.adminEmail],
      subject: `คำขอรีเซ็ตรหัสผ่าน DomainWatch — ${input.requestedName}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033">
        <h2>มีคำขอรีเซ็ตรหัสผ่าน DomainWatch</h2>
        <p><b>ชื่อ:</b> ${escapeHtml(input.requestedName)}<br/><b>บัญชี:</b> ${escapeHtml(input.requestedUsername)}</p>
        <p>ตรวจสอบผู้ขอ แล้วกดปุ่มด้านล่างเพื่อให้ระบบสร้างรหัสผ่านชั่วคราว ลิงก์ใช้ได้ครั้งเดียวและหมดอายุใน 30 นาที</p>
        <p><a href="${input.approvalUrl}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px">ตรวจสอบและสร้างรหัสชั่วคราว</a></p>
        <p style="color:#64748b;font-size:13px">หากไม่มีผู้ใช้แจ้งขอรีเซ็ต ให้เพิกเฉยอีเมลนี้ รหัสเดิมจะยังไม่ถูกเปลี่ยน</p>
      </div>`,
    }),
  });
  if (!response.ok) throw new Error(`Password reset email failed (${response.status})`);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[char] || char);
}
