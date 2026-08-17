import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  sendTelegramTo,
  downAlertMessage,
  recoveredMessage,
  dailyReportMessage,
} from "@/lib/telegram";
import { getDailyReport, todayBangkok } from "@/lib/report";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/companies/[id]/test-telegram
// ส่ง "ตัวอย่างจริง" 3 แบบเข้ากลุ่ม Telegram ของบริษัทนี้: ผิดปกติ (ล่ม) · ปกติ (กลับมา) · รายงานรอบวัน
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const company = await prisma.company.findUnique({
    where: { id: params.id },
    select: { name: true, tgBotToken: true, tgChatId: true },
  });
  if (!company) {
    return NextResponse.json({ error: "ไม่พบบริษัท" }, { status: 404 });
  }
  const token = (company.tgBotToken || "").trim();
  const chatId = (company.tgChatId || "").trim();
  if (!token || !chatId) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้ง Bot Token / Chat ID ของบริษัทนี้" },
      { status: 400 }
    );
  }

  const origin = new URL(req.url).origin;
  let sent = 0;

  // ข้อความนำ — ถ้าอันนี้ส่งไม่ได้ = ตั้งค่าผิด (แจ้ง error กลับไปเลย)
  const head = await sendTelegramTo(token, chatId, {
    text: [
      `🧪 <b>ตัวอย่างการแจ้งเตือน — ${escapeHtml(company.name)}</b>`,
      `ต่อไปนี้คือตัวอย่าง 3 แบบที่ทีมจะได้รับจริง`,
    ].join("\n"),
  });
  if (!head.ok) {
    return NextResponse.json(
      {
        error:
          "ส่งไม่สำเร็จ — ตรวจสอบว่า Bot Token ถูกต้อง, Chat ID เป็นเลข -100..., และบอทอยู่ในกลุ่ม (เป็นแอดมิน)",
        sent: 0,
      },
      { status: 502 }
    );
  }
  sent += head.sent;

  // 1) ตัวอย่าง "ผิดปกติ" (ลิงก์ล่ม)
  const down = await sendTelegramTo(
    token,
    chatId,
    downAlertMessage({
      incidentId: "SAMPLEDOWN01",
      company: company.name,
      room: "@ตัวอย่าง",
      name: "หน้าเข้าเล่นหลัก (ตัวอย่าง)",
      url: "https://example.com/login",
      category: "ทางเข้า",
      httpCode: 403,
      error: "ถูกบล็อค/ต้องสิทธิ์ (HTTP 403)",
      backupUrl: "https://backup.example.com/login",
      detectedAt: new Date(),
      appBaseUrl: origin,
    })
  );
  sent += down.sent;

  // 2) ตัวอย่าง "ปกติ" (ลิงก์กลับมาใช้ได้)
  const up = await sendTelegramTo(
    token,
    chatId,
    recoveredMessage({
      incidentId: "SAMPLEUP0001",
      company: company.name,
      name: "หน้าเข้าเล่นหลัก (ตัวอย่าง)",
      url: "https://example.com/login",
      downMinutes: 12,
      appBaseUrl: origin,
    })
  );
  sent += up.sent;

  // 3) ตัวอย่าง "หน้าสรุป" (รายงานรอบวันจริงของวันนี้)
  try {
    const report = await getDailyReport(todayBangkok());
    const rep = await sendTelegramTo(token, chatId, dailyReportMessage(report, origin));
    sent += rep.sent;
  } catch {
    /* ถ้าดึงรายงานไม่ได้ ก็ข้ามไป — 2 ตัวอย่างแรกส่งแล้ว */
  }

  return NextResponse.json({ ok: true, sent });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
