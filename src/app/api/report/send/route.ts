import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDailyReport, todayBangkok } from "@/lib/report";
import { dailyReportMessage, sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

// POST /api/report/send { date? } — ส่งสรุปรอบวันเข้า Telegram (กลุ่มกลาง)
// อนุญาต: ผู้ใช้ที่ล็อกอิน หรือ ?token=CRON_SECRET (สำหรับตั้งส่งอัตโนมัติ)
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const cronOk = !!process.env.CRON_SECRET && token === process.env.CRON_SECRET;
  if (!cronOk && !(await getCurrentUser()))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const date = (body?.date as string) || url.searchParams.get("date") || todayBangkok();
  const report = await getDailyReport(date);
  const res = await sendTelegram(dailyReportMessage(report, APP_BASE_URL), "all");
  if (!res.ok)
    return NextResponse.json(
      { error: res.skipped === "no_token" ? "ยังไม่ได้ตั้งค่า Telegram กลาง" : "ส่งไม่สำเร็จ" },
      { status: 400 }
    );
  return NextResponse.json({ ok: true, sent: res.sent });
}
