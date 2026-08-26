// ส่งข้อความแจ้งเตือนผ่าน Telegram Bot API
// ตั้งค่า TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, TELEGRAM_IT_CHAT_ID ใน .env

import { fmtMinutes } from "@/lib/format";
import type { DailyReport } from "@/lib/report";

type Audience = "admin" | "it" | "all";
const TELEGRAM_TIMEOUT_MS = 5000;

async function telegramFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ปุ่มกดใต้ข้อความ (Inline Keyboard) — ใช้ปุ่มแบบเปิดลิงก์เท่านั้น (ไม่ต้องมี webhook)
export type InlineButton = { text: string; url: string };
// ข้อความ Telegram แบบมีปุ่ม — ตัวสร้างข้อความคืนค่าเป็นชนิดนี้
export type TgMessage = { text: string; buttons?: InlineButton[][] };

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

// URL ปุ่มต้องเป็น http(s) จริง และไม่ใช่ localhost (กัน Telegram ปฏิเสธทั้งข้อความ)
function validButtonUrl(u: string): boolean {
  if (!u || /\s/.test(u)) return false;
  if (!/^https?:\/\//i.test(u)) return false;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(u)) return false;
  return true;
}

// สร้าง reply_markup จากปุ่ม (คัดเฉพาะปุ่มที่ URL ใช้ได้จริง) — ถ้าไม่มีปุ่มที่ใช้ได้คืน undefined
function buildReplyMarkup(buttons?: InlineButton[][]) {
  if (!buttons || buttons.length === 0) return undefined;
  const rows = buttons
    .map((row) => row.filter((b) => b && validButtonUrl(b.url)))
    .filter((row) => row.length > 0);
  return rows.length ? { inline_keyboard: rows } : undefined;
}

// แปลง string | TgMessage -> body สำหรับ sendMessage
function buildBody(chatId: string, msg: string | TgMessage) {
  const m: TgMessage = typeof msg === "string" ? { text: msg } : msg;
  const markup = buildReplyMarkup(m.buttons);
  return {
    chat_id: chatId,
    text: m.text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(markup ? { reply_markup: markup } : {}),
  };
}

export async function sendTelegram(
  msg: string | TgMessage,
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
      const res = await telegramFetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildBody(chatId, msg)),
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
  msg: string | TgMessage
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
      const res = await telegramFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(chatId, msg)),
      });
      if (res.ok) sent++;
      else console.error("[telegram] route ส่งไม่สำเร็จ", await res.text());
    } catch (e) {
      console.error("[telegram] route error", e);
    }
  }
  return { ok: sent > 0, sent };
}

// ปุ่ม "เปิดในระบบ" ของเคส
function incidentUrl(appBaseUrl: string, incidentId: string): string {
  return `${appBaseUrl}/incidents?incident=${encodeURIComponent(incidentId)}`;
}

// ข้อความแจ้งเตือน LINE OA ผิดปกติ
export function oaAlertMessage(opts: {
  room: string;
  company: string;
  status: string;
  displayName?: string | null;
  expectedName?: string | null;
  appBaseUrl: string;
}): TgMessage {
  const reasonMap: Record<string, string> = {
    MISMATCH: `ชื่อ OA ไม่ตรง (พบ "${opts.displayName || "-"}" คาดหวัง "${opts.expectedName || "-"}")`,
    NO_PICTURE: "รูปโปรไฟล์ OA หาย/ไม่มี",
    TOKEN_INVALID: "token ใช้ไม่ได้ — OA อาจถูกปิด/แบน",
    ERROR: "ตรวจ OA ไม่สำเร็จ",
  };
  const text = [
    `🚨 <b>LINE OA ผิดปกติ</b>`,
    `━━━━━━━━━━━━━━━`,
    `💬 <b>${escapeHtml(opts.room)}</b>`,
    `🏢 บริษัท: ${escapeHtml(opts.company)}`,
    `⚠️ ปัญหา: ${escapeHtml(reasonMap[opts.status] || opts.status)}`,
  ].join("\n");
  return {
    text,
    buttons: [[{ text: "🛠️ จัดการ OA", url: `${opts.appBaseUrl}/companies` }]],
  };
}

export function oaRecoveredMessage(opts: {
  room: string;
  company: string;
  appBaseUrl?: string;
}): TgMessage {
  const text = [
    `🟢 <b>LINE OA กลับมาปกติ</b>`,
    `━━━━━━━━━━━━━━━`,
    `💬 <b>${escapeHtml(opts.room)}</b>`,
    `🏢 บริษัท: ${escapeHtml(opts.company)}`,
  ].join("\n");
  return {
    text,
    buttons: opts.appBaseUrl
      ? [[{ text: "ดูในระบบ", url: `${opts.appBaseUrl}/companies` }]]
      : undefined,
  };
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
  backupUrl?: string | null;
  detectedAt: Date;
  appBaseUrl: string;
}): TgMessage {
  const t = opts.detectedAt.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
  });
  const reason = opts.error || (opts.httpCode ? `HTTP ${opts.httpCode}` : "ไม่ตอบสนอง");
  const caseCode = opts.incidentId.slice(-8).toUpperCase();
  const text = [
    `🔴 <b>ลิงก์ใช้งานไม่ได้ — ต้องดำเนินการ</b>`,
    `━━━━━━━━━━━━━━━`,
    `🆔 เคส: <b>#${caseCode}</b>`,
    `🏢 บริษัท: ${escapeHtml(opts.company)}`,
    ...(opts.room ? [`💬 ห้อง: ${escapeHtml(opts.room)}`] : []),
    `📄 <b>${escapeHtml(opts.name)}</b>`,
    `🏷️ หมวด: ${escapeHtml(opts.category || "ทั่วไป")}`,
    `🔗 ${escapeHtml(opts.url)}`,
    `⚠️ สาเหตุ: ${escapeHtml(reason)}`,
    `🕒 ตรวจพบ: ${t}`,
  ].join("\n");
  const backupBtn: InlineButton[] =
    opts.backupUrl && opts.backupUrl.trim()
      ? [{ text: "♻️ ลิงก์สำรอง", url: opts.backupUrl.trim() }]
      : [];
  return {
    text,
    buttons: [
      [{ text: "🔗 เปิดลิงก์", url: opts.url }, ...backupBtn],
      [{ text: "🛠️ รับเรื่อง/อัพเดตในระบบ", url: incidentUrl(opts.appBaseUrl, opts.incidentId) }],
    ],
  };
}

export function recoveredMessage(opts: {
  incidentId: string;
  company: string;
  room?: string | null;
  name: string;
  url: string;
  downMinutes: number;
  slow?: boolean;
  responseMs?: number | null;
  detail?: string | null;
  appBaseUrl: string;
}): TgMessage {
  const caseCode = opts.incidentId.slice(-8).toUpperCase();
  const responseSeconds =
    typeof opts.responseMs === "number" ? Math.max(0, opts.responseMs / 1000).toFixed(1) : null;
  const text = [
    opts.slow
      ? `🟡 <b>ลิงก์กลับมาใช้งานได้แล้ว — แต่ยังโหลดช้า</b>`
      : `🟢 <b>ลิงก์กลับมาใช้งานได้แล้ว</b>`,
    `━━━━━━━━━━━━━━━`,
    `🆔 เคส: <b>#${caseCode}</b>`,
    `🏢 บริษัท: ${escapeHtml(opts.company)}`,
    ...(opts.room ? [`💬 ห้อง: ${escapeHtml(opts.room)}`] : []),
    `📄 <b>${escapeHtml(opts.name)}</b>`,
    `🔗 ${escapeHtml(opts.url)}`,
    `⏱️ ล่มไปประมาณ ${opts.downMinutes} นาที`,
    ...(opts.slow && responseSeconds ? [`🐢 เวลาตอบกลับ: ${responseSeconds} วินาที`] : []),
    ...(opts.slow && opts.detail ? [`ℹ️ รายละเอียด: ${escapeHtml(opts.detail)}`] : []),
    ...(opts.slow ? [`🔎 ระบบจะตรวจติดตามต่ออัตโนมัติ`] : []),
  ].join("\n");
  return {
    text,
    buttons: [
      [
        { text: "🔗 เปิดลิงก์", url: opts.url },
        { text: "🛠️ ดูเคส", url: incidentUrl(opts.appBaseUrl, opts.incidentId) },
      ],
    ],
  };
}

export function networkDownMessage(opts: {
  incidentId: string;
  carrier: string;
  agentName: string;
  company: string;
  room?: string | null;
  name: string;
  url: string;
  httpCode?: number | null;
  error?: string | null;
  detectedAt: Date;
  appBaseUrl: string;
}): TgMessage {
  const detected = opts.detectedAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  const reason = opts.error || (opts.httpCode ? `HTTP ${opts.httpCode}` : "เชื่อมต่อไม่ได้");
  return {
    text: [
      `🔴 <b>${escapeHtml(opts.carrier)} เปิดลิงก์ไม่ได้ — ยืนยันจากซิม 2 รอบ</b>`,
      `━━━━━━━━━━━━━━━`,
      `🆔 เคสเครือข่าย: <b>#${opts.incidentId.slice(-8).toUpperCase()}</b>`,
      `📱 เครื่องตรวจ: ${escapeHtml(opts.agentName)}`,
      `🏢 บริษัท: ${escapeHtml(opts.company)}`,
      ...(opts.room ? [`💬 ห้อง: ${escapeHtml(opts.room)}`] : []),
      `📄 <b>${escapeHtml(opts.name)}</b>`,
      `🔗 ${escapeHtml(opts.url)}`,
      `⚠️ สาเหตุ: ${escapeHtml(reason)}`,
      `🕒 ตรวจพบ: ${detected}`,
    ].join("\n"),
    buttons: [
      [{ text: "🔗 เปิดลิงก์", url: opts.url }],
      [{ text: "📱 ดูผลตรวจเครือข่าย", url: `${opts.appBaseUrl}/agents?incident=${encodeURIComponent(opts.incidentId)}` }],
    ],
  };
}

export function networkRecoveredMessage(opts: {
  incidentId: string;
  carrier: string;
  agentName: string;
  company: string;
  room?: string | null;
  name: string;
  url: string;
  downMinutes: number;
  slow?: boolean;
  responseMs?: number | null;
  appBaseUrl: string;
}): TgMessage {
  const responseSeconds = typeof opts.responseMs === "number"
    ? Math.max(0, opts.responseMs / 1000).toFixed(1)
    : null;
  return {
    text: [
      opts.slow
        ? `🟡 <b>${escapeHtml(opts.carrier)} กลับมาเปิดได้แล้ว — แต่ยังโหลดช้า</b>`
        : `🟢 <b>${escapeHtml(opts.carrier)} กลับมาเปิดลิงก์ได้แล้ว</b>`,
      `━━━━━━━━━━━━━━━`,
      `🆔 เคสเครือข่าย: <b>#${opts.incidentId.slice(-8).toUpperCase()}</b>`,
      `📱 เครื่องตรวจ: ${escapeHtml(opts.agentName)}`,
      `🏢 บริษัท: ${escapeHtml(opts.company)}`,
      ...(opts.room ? [`💬 ห้อง: ${escapeHtml(opts.room)}`] : []),
      `📄 <b>${escapeHtml(opts.name)}</b>`,
      `🔗 ${escapeHtml(opts.url)}`,
      `⏱️ ใช้งานไม่ได้ประมาณ ${opts.downMinutes} นาที`,
      ...(opts.slow && responseSeconds ? [`🐢 เวลาตอบกลับ: ${responseSeconds} วินาที`] : []),
      ...(opts.slow ? ["🔎 ระบบจะตรวจติดตามต่ออัตโนมัติ"] : []),
    ].join("\n"),
    buttons: [[
      { text: "🔗 เปิดลิงก์", url: opts.url },
      { text: "📱 ดูผลตรวจ", url: `${opts.appBaseUrl}/agents?incident=${encodeURIComponent(opts.incidentId)}` },
    ]],
  };
}

// สรุปรายงานรอบวัน สำหรับส่ง Management/ทีม
export function dailyReportMessage(r: DailyReport, appBaseUrl: string): TgMessage {
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
  if (r.isToday && r.currentOpenDetails.length > 0) {
    lines.push("", `<b>เคสที่ค้างอยู่ตอนนี้ (${r.currentOpenDetails.length})</b>`);
    for (const incident of r.currentOpenDetails.slice(0, 10)) {
      const since = new Date(incident.detectedAt).toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
      });
      const room = incident.room ? ` · ห้อง ${escapeHtml(incident.room)}` : "";
      lines.push(
        `• #${incident.id.slice(-8).toUpperCase()} ${escapeHtml(incident.name)} · ${escapeHtml(incident.company)}${room}`,
        `  ค้างตั้งแต่ ${since} (${fmtMinutes(incident.openMinutes)})`
      );
    }
    if (r.currentOpenDetails.length > 10) {
      lines.push(`…และอีก ${r.currentOpenDetails.length - 10} เคส ดูต่อในระบบ`);
    }
  }
  lines.push("", ...shiftLines, "");
  lines.push(`KPI เฉลี่ย — แอดมิน ${fmtMinutes(r.avgAdminMin)} · ไอที ${fmtMinutes(r.avgItMin)}`);
  lines.push(`สรุป: <b>${summary}</b>`);
  return {
    text: lines.join("\n"),
    buttons: [[{ text: "📊 เปิดรายงานเต็ม", url: `${appBaseUrl}/report?date=${r.date}` }]],
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
