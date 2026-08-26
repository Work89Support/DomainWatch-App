import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getDailyReport, todayBangkok, shiftDate } from "@/lib/report";
import { dailyReportMessage, sendTelegram, sendTelegramTo } from "@/lib/telegram";
import { resolvePublicBaseUrl } from "@/lib/mobileAgent";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// อนุญาตเรียกจาก cron: ?token=, header x-cron-token, หรือ Authorization: Bearer (Vercel Cron ใส่ให้อัตโนมัติ)
function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  const token =
    url.searchParams.get("token") ||
    req.headers.get("x-cron-token") ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    "";
  return token === secret;
}

// GET/POST /api/report/send — ส่งสรุปรอบวันเข้า Telegram
//   ?day=prev  -> รายงานของ "เมื่อวาน" (รอบวันที่เพิ่งจบ รวมกะดึก) ใช้ตอนเช้า 06:00
//   ?day=today -> รายงานของ "วันนี้" (เช้า+เย็นถึงตอนนี้) ใช้ตอนเย็น 18:00
//   ?date=YYYY-MM-DD -> ระบุวันเอง
async function handle(req: NextRequest) {
  const isCron = cronAuthorized(req);
  if (!isCron) {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (me.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const dayParam = String(body?.day || url.searchParams.get("day") || "");
  let date = String(body?.date || url.searchParams.get("date") || "");
  if (!date) {
    date =
      dayParam === "prev" || dayParam === "yesterday"
        ? shiftDate(todayBangkok(), -1)
        : todayBangkok();
  }

  const report = await getDailyReport(date);
  const msg = dailyReportMessage(report, resolvePublicBaseUrl(new URL(req.url).origin));

  // ส่งเข้ากลุ่ม Telegram ที่ตั้งไว้ต่อบริษัท (รวมกลุ่มที่ซ้ำกันให้เหลือส่งครั้งเดียว)
  const companies = await prisma.company.findMany({
    select: { tgBotToken: true, tgChatId: true },
  });
  const seen = new Set<string>();
  let sent = 0;
  let groups = 0;
  for (const c of companies) {
    const bt = (c.tgBotToken || "").trim();
    const ci = (c.tgChatId || "").trim();
    if (!bt || !ci) continue;
    const key = `${bt}|${ci}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = await sendTelegramTo(bt, ci, msg);
    sent += r.sent;
    groups++;
  }

  // ไม่มีกลุ่มต่อบริษัทเลย -> ใช้กลุ่มกลาง (env)
  if (groups === 0) {
    const r = await sendTelegram(msg, "all");
    sent += r.sent;
    if (!r.ok) {
      return NextResponse.json(
        {
          error:
            r.skipped === "no_token"
              ? "ยังไม่ได้ตั้งค่า Telegram (กลุ่มบริษัท หรือ กลุ่มกลาง)"
              : "ส่งไม่สำเร็จ",
        },
        { status: 400 }
      );
    }
  }

  return NextResponse.json({ ok: true, date, groups, sent });
}

export async function POST(req: NextRequest) {
  return handle(req);
}
export async function GET(req: NextRequest) {
  return handle(req);
}
