import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { runCheck } from "@/lib/checker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// เทียบสตริงแบบคงเวลา (constant-time) กันการเดา secret จากเวลาตอบสนอง
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // ถ้าไม่ตั้ง secret = อนุญาต (สำหรับ dev) แต่แนะนำให้ตั้งใน production
  if (!secret) return true;
  const url = new URL(req.url);
  const token =
    url.searchParams.get("token") ||
    req.headers.get("x-cron-token") ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    "";
  return safeEqual(token, secret);
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await runCheck();
  return NextResponse.json(summary);
}

// รองรับทั้ง GET (ง่ายต่อ cron/uptime service) และ POST
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
