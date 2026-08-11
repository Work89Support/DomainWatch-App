import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

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

// ---------- โทเคน session (userId + ลายเซ็น HMAC) ----------
export function createSessionToken(userId: string): string {
  const sig = crypto.createHmac("sha256", SECRET).update(userId).digest("hex");
  return `${userId}.${sig}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const userId = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(userId)
    .digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return userId;
}

export type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: "ADMIN" | "IT";
};

// อ่านผู้ใช้ปัจจุบันจาก cookie (server component / route handler)
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) return null;
  return { id: user.id, name: user.name, username: user.username, role: user.role };
}

// บังคับต้องล็อกอิน (ใช้ต้นหน้า server component) — ถ้าไม่ล็อกอินเด้งไป /login
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
