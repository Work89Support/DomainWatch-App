import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendTelegramTo } from "@/lib/telegram";

export const dynamic = "force-dynamic";

// POST /api/companies/[id]/test-telegram — ส่งข้อความทดสอบเข้ากลุ่ม Telegram ของบริษัทนี้
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
  const text = [
    `🔔 <b>ทดสอบการแจ้งเตือน DomainWatch</b>`,
    `━━━━━━━━━━━━━━━`,
    `🏢 บริษัท: ${escapeHtml(company.name)}`,
    ``,
    `✅ เชื่อมต่อ Telegram สำเร็จ! ถ้าเห็นข้อความนี้ = ตั้งค่าถูกต้อง`,
    `พร้อมรับแจ้งเตือน ลิงก์ล่ม / OA ผิดปกติ / รายงานรอบวัน ของบริษัทนี้`,
  ].join("\n");

  const res = await sendTelegramTo(token, chatId, {
    text,
    buttons: [[{ text: "🖥️ เปิดระบบ DomainWatch", url: origin }]],
  });

  if (!res.ok) {
    return NextResponse.json(
      {
        error:
          "ส่งไม่สำเร็จ — ตรวจสอบว่า Bot Token ถูกต้อง, Chat ID เป็นเลข -100..., และบอทอยู่ในกลุ่ม (เป็นแอดมิน)",
        sent: 0,
      },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, sent: res.sent });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
