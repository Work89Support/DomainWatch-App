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

  const appBaseUrl = resolvePublicBaseUrl(new URL(req.url).origin);

  // รวมบริษัทที่ใช้ Telegram กลุ่มเดียวกัน แล้วสร้างรายงานเฉพาะบริษัทในกลุ่มนั้น
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, tgBotToken: true, tgChatId: true },
  });
  const routes = new Map<string, {
    botToken: string;
    chatId: string;
    companyIds: string[];
    companyNames: string[];
  }>();
  for (const company of companies) {
    const botToken = (company.tgBotToken || "").trim();
    const chatId = (company.tgChatId || "").trim();
    if (!botToken || !chatId) continue;
    const key = `${botToken}|${chatId}`;
    const route = routes.get(key) || { botToken, chatId, companyIds: [], companyNames: [] };
    route.companyIds.push(company.id);
    route.companyNames.push(company.name);
    routes.set(key, route);
  }

  let sent = 0;
  const groups = routes.size;
  for (const route of routes.values()) {
    const report = await getDailyReport(date, {
      companyIds: route.companyIds,
      scopeLabel: route.companyNames.join(", "),
    });
    const r = await sendTelegramTo(
      route.botToken,
      route.chatId,
      dailyReportMessage(report, appBaseUrl)
    );
    sent += r.sent;
  }

  // ไม่มีกลุ่มต่อบริษัทเลย -> ใช้กลุ่มกลาง (env)
  if (groups === 0) {
    const report = await getDailyReport(date);
    const r = await sendTelegram(dailyReportMessage(report, appBaseUrl), "all");
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
