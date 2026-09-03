import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/permissions";
import { getClientIp, isIpAllowed } from "@/lib/ipAccess";

export const COOKIE_NAME = "dw_session";
const SECRET = process.env.AUTH_SECRET || "dev-insecure-secret-change-me";

// ---------- รหัสผ่าน (scrypt) ----------
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(test, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- โทเคน session (userId + เวลาออก + ลายเซ็น HMAC ที่ผูกกับรหัสผ่าน) ----------
// รูปแบบ: `${userId}.${issuedAtMs}.${sig}` โดย sig = HMAC(SECRET, userId.issuedAt.passwordHash)
// การผูกกับ passwordHash ทำให้ "เปลี่ยนรหัสผ่าน" ทำให้ cookie เดิมใช้ไม่ได้ทันที
// และมีวันหมดอายุ (30 วัน) ตรงกับอายุ cookie
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function signSession(userId: string, issuedAt: number, passwordHash: string): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${userId}.${issuedAt}.${passwordHash}`)
    .digest("hex");
}

export function createSessionToken(userId: string, passwordHash: string, issuedAt = Date.now()): string {
  const sig = signSession(userId, issuedAt, passwordHash);
  return `${userId}.${issuedAt}.${sig}`;
}

type ParsedToken = { userId: string; issuedAt: number; sig: string };
function parseSessionToken(token: string | undefined): ParsedToken | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, iatStr, sig] = parts;
  const issuedAt = Number(iatStr);
  if (!userId || !sig || !Number.isFinite(issuedAt)) return null;
  return { userId, issuedAt, sig };
}

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: AppRole;
  companyIds: string[];
  mustChangePassword: boolean;
};

// อ่าน session ที่ยืนยันตัวตนแล้ว แม้ผู้ใช้ยังต้องเปลี่ยนรหัสผ่านครั้งแรก
export async function getSessionUser(): Promise<SessionUser | null> {
  const parsed = parseSessionToken(cookies().get(COOKIE_NAME)?.value);
  if (!parsed) return null;
  // หมดอายุแล้ว?
  if (Date.now() - parsed.issuedAt > SESSION_MAX_AGE_MS) return null;
  const user = await prisma.user.findUnique({
    where: { id: parsed.userId },
    include: { companyAssignments: { select: { companyId: true } } },
  });
  if (!user || !user.isActive) return null;
  if (!isIpAllowed(getClientIp(headers()), user.allowedIpRanges)) return null;
  // ตรวจลายเซ็นโดยผูกกับ passwordHash ปัจจุบัน (เปลี่ยนรหัส = โทเคนเก่าใช้ไม่ได้)
  const expected = signSession(user.id, parsed.issuedAt, user.passwordHash);
  const a = Buffer.from(parsed.sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    companyIds: user.companyAssignments.map((item) => item.companyId),
    mustChangePassword: user.mustChangePassword,
  };
}

// ผู้ใช้ที่ผ่านขั้นตอนเปลี่ยนรหัสแล้วเท่านั้นจึงเข้าหน้าระบบ/API เดิมได้
export async function getCurrentUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  return user && !user.mustChangePassword ? user : null;
}

// บังคับต้องล็อกอิน (ใช้ต้นหน้า server component) — ถ้าไม่ล็อกอินเด้งไป /login
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}
