import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canRunCheck } from "@/lib/permissions";
import { getCrmTelegramStatus, sendConfiguredCrmTelegram } from "@/lib/crmTelegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canRunCheck(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if ((await getCrmTelegramStatus()).mode === "off") {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า Telegram" }, { status: 400 });
  }
  const origin = new URL(req.url).origin;
  const result = await sendConfiguredCrmTelegram({
    text: [
      "🧪 <b>ทดสอบแจ้งเตือน CRM / ลิงก์ส่ง SMS</b>",
      "━━━━━━━━━━━━━━━",
      "✅ DomainWatch เชื่อมต่อ Telegram สำหรับ CRM สำเร็จ",
      "ระบบจะแจ้งเมื่อพบลิงก์ใช้ไม่ได้และเมื่อกลับมาใช้งานได้",
    ].join("\n"),
    buttons: [[{ text: "📨 เปิดหน้า CRM", url: `${origin}/crm` }]],
  });
  if (!result.ok) return NextResponse.json({ error: "ส่งไม่สำเร็จ กรุณาตรวจ Bot Token และ Chat ID" }, { status: 502 });
  return NextResponse.json({ ok: true, sent: result.sent });
}
