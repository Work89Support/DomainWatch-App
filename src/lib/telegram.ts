// ส่งข้อความแจ้งเตือนผ่าน Telegram Bot API
// ตั้งค่า TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, TELEGRAM_IT_CHAT_ID ใน .env

import { fmtMinutes } from "@/lib/format";
import type { DailyReport } from "@/lib/report";

type Audience = "admin" | "it" | "all";

function chatIdsFor(audience: Audience): string[] {
  const admin = (process.env.TELEGRAM_ADMIN_CHAT_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const it = (process.env.TELEGRAM_IT_CHAT_ID || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (audience === "admin") return admin;
  if (audience === "it") return it;
  return Array.from(new Set([...admin, ...it]));
}

export async function sendTelegram(
  text: string,
  audience: Audience = "all"
): Promise<{ ok: boolean; sent: number; skipped?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("[telegram] ไม่ได้ตั้ง TELEGRAM_BOT_TOKEN — ข้ามการส่ง");
    return { ok: false, sent: 0, skipped: "no_token" };
  }

  const ids = chatIdsFor(audience);
  if (ids.length === 0) {
    console.warn(`[telegram] ไม่มี chat id สำหรับ audience=${audience}`);
    return { ok: false, sent: 0, skipped: "no_chat_id" };
  }

  let sent = 0;
  for (const chatId of ids) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        }
      );
      if (res.ok) sent++;
      else console.error("[telegram] ส่งไม่สำเร็จ", await res.text());
    } catch (e) {
      console.error("[telegram] error", e);
    }
  }
  return { ok: sent > 0, sent };
}

// ส่งเข้าบอท/กลุ่มที่ระบุเอง (ใช้ตอนแยกกลุ่มต่อบริษัท)
export async function sendTelegramTo(
  botToken: string,
  chatIdCsv: string,
  text: string
): Promise<{ ok: boolean; sent: number }> {
  const token = (botToken || "").trim();
  const ids = (chatIdCsv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!token || ids.length === 0) return { ok: false, sent: 0 };
  let sent = 0;
  for (const chatId of ids) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
      if (res.ok) sent++;
      else console.error("[telegram] route ส่งไม่สำเร็จ", await res.text());
    } catch (e) {
      console.error("[telegram] route error", e);
    }
  }
  return { ok: sent > 0, sent };
}

// ข้อความแจ้งเตือน LINE OA ผิดปกติ
export function oaAlertMessage(opts: {
  room: string;
  company: string;
  status: string;
  displayName?: string | null;
  expectedName?: string | null;
  appBaseUrl: string;
}): string {
  const reasonMap: Record<string, string> = {
    MISMATCH: `ชื่อ OA ไม่ตรง (พบ "${opts.displayName || "-"}" คาดหวัง "${opts.expectedName || "-"}")`,
    NO_PICTURE: "รูปโปรไฟล์ OA หาย/ไม่มี",
    TOKEN_INVALID: "token ใช้ไม่ได้ — OA อาจถูกปิด/แบน",
    ERROR: "ตรวจ OA ไม่สำเร็จ",
  };
  return [
    `🚨 <b>LINE OA ผิดปกติ</b>`,
    ``,
    `💬 <b>${escapeHtml(opts.room)}</b>`,
    `🏢 บริษัท: ${escapeHtml(opts.company)}`,
    `⚠️ ปัญหา: ${escapeHtml(reasonMap[opts.status] || opts.status)}`,
    ``,
    `${opts.appBaseUrl}/companies`,
  ].join("\n");
}

export function oaRecoveredMessage(opts: { room: string; company: string }): string {
  return [
    `🟢 <b>LINE OA กลับมาปกติ</b>`,
    ``,
    `💬 <b>${escapeHtml(opts.room)}</b>`,
    `🏢 บริษัท: ${escapeHtml(opts.company)}`,
  ].join("\n");
}

// ข้อความแจ้งเตือนเมื่อพบลิงก์ล่ม
export function downAlertMessage(opts: {
  incidentId: string;
  company: string;
  room?: string | null;
  name: string;
  url: string;
  category?: string | null;
  httpCode?: number | null;
  error?: string | null;
  detectedAt: Date;
  appBaseUrl: string;
}): string {
  const t = opts.detectedAt.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
  });
  const reason = opts.error || (opts.httpCode ? `HTTP ${opts.httpCode}` : "ไม่ตอบสนอง");
  const caseCode = opts.incidentId.slice(-8).toUpperCase();
  return [
    `🔴 <b>ลิงก์ใช้งานไม่ได้</b>`,
    ``,
    `🆔 เคส: <b>#${caseCode}</b>`,
    `🏢 บริษัท: ${escapeHtml(opts.company)}`,
    ...(opts.room ? [`💬 ห้อง: ${escapeHtml(opts.room)}`] : []),
    `📌 <b>${escapeHtml(opts.name)}</b>`,
    `🏷️ หมวด: ${escapeHtml(opts.category || "ทั่วไป")}`,
    `🔗 ${escapeHtml(opts.url)}`,
    `⚠️ สาเหตุเบื้องต้น: ${escapeHtml(reason)}`,
    `🕒 ตรวจพบ: ${t}`,
    ``,
    `👉 เปิดเหตุการณ์นี้:`,
    `${opts.appBaseUrl}/incidents?incident=${encodeURIComponent(opts.incidentId)}`,
  ].join("\n");
}

export function recoveredMessage(opts: {
  incidentId: string;
  company: string;
  name: string;
  url: string;
  downMinutes: number;
  appBaseUrl: string;
}): string {
  const caseCode = opts.incidentId.slice(-8).toUpperCase();
  return [
    `🟢 <b>ลิงก์กลับมาใช้งานได้แล้ว</b>`,
    ``,
    `🆔 เคส: <b>#${caseCode}</b>`,
    `🏢 บริษัท: ${escapeHtml(opts.company)}`,
    `📌 <b>${escapeHtml(opts.name)}</b>`,
    `🔗 ${escapeHtml(opts.url)}`,
    `⏱️ ล่มไปประมาณ ${opts.downMinutes} นาที`,
    `${opts.appBaseUrl}/incidents?incident=${encodeURIComponent(opts.incidentId)}`,
  ].join("\n");
}

// สรุปรายงานรอบวัน สำหรับส่งผู้บริหาร/ทีม
export function dailyReportMessage(r: DailyReport, appBaseUrl: string): string {
  const icon: Record<string, string> = { morning: "🌅", evening: "🌆", night: "🌙" };
  const shiftLines = r.shifts.map((s) => {
    const badge = s.incidents === 0 ? "🟢 ไม่มีปัญหา" : s.allFixed ? "✅ แก้ครบ" : `⚠️ ค้าง ${s.open}`;
    return `${icon[s.key] || "•"} <b>${escapeHtml(s.label)}</b> (${s.time}): ปัญหา ${s.incidents} · แก้แล้ว ${s.resolved} · ${badge}`;
  });
  const summary = r.isToday
    ? (r.currentOpenIncidents === 0
      ? "✅ ไม่มีเคสค้างสะสม"
      : `⚠️ ค้างสะสม ${r.currentOpenIncidents} เคส`)
    : (r.totalOpen === 0
      ? (r.totalIncidents === 0 ? "✅ ทั้งวันไม่มีปัญหา" : "✅ ปิดครบทุกเคสแล้ว")
      : `⚠️ ยังมี ${r.totalOpen} เคสจากวันนั้นที่ปิดไม่ครบ`);
  const lines: string[] = [
    `📊 <b>รายงานสรุปรอบวัน</b>`,
    `🗓️ ${escapeHtml(r.dateLabel)}`,
    ``,
    `เฝ้าดู ${r.activeLinks} รายการ · ตอนนี้ใช้ได้ ${r.upNow} · ช้า ${r.slowNow} · ใช้ไม่ได้ ${r.downNowUnique} URLจริง (${r.downNow} รายการ)`,
    `เคสในรอบวัน ${r.totalIncidents} · แก้แล้ว ${r.totalResolved} · ค้างจากวันนี้ ${r.totalOpen}`,
  ];
  if (r.isToday) lines.push(`ค้างสะสมทุกวัน ณ ตอนนี้ ${r.currentOpenIncidents} เคส`);
  if (r.oaIssues > 0) lines.push(`LINE OA ผิดปกติ ${r.oaIssues} ห้อง`);
  lines.push("", ...shiftLines, "");
  lines.push(`KPI เฉลี่ย — แอดมิน ${fmtMinutes(r.avgAdminMin)} · ไอที ${fmtMinutes(r.avgItMin)}`);
  lines.push(`สรุป: <b>${summary}</b>`, "", `${appBaseUrl}/report?date=${r.date}`);
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
