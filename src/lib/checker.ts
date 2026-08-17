import { prisma } from "@/lib/prisma";
import {
  sendTelegram,
  sendTelegramTo,
  downAlertMessage,
  recoveredMessage,
  oaAlertMessage,
  oaRecoveredMessage,
  type TgMessage,
} from "@/lib/telegram";
import { checkOa } from "@/lib/line";
import { confirmCheckState } from "@/lib/checkState";
import { Prisma, type LinkStatus } from "@prisma/client";

// cron-job.org ตัดคำขอที่ 30 วินาที จึงต้องให้ URL หนึ่งรายการจบภายใน ~16 วินาที
// 12 วินาทียังพอสำหรับเว็บที่โหลดช้า และ HEAD สำรองได้เวลาเพิ่มอีก 4 วินาที
const TIMEOUT_MS = Number(process.env.CHECK_TIMEOUT_MS || 12000);
const HEAD_TIMEOUT_MS = Number(process.env.CHECK_HEAD_TIMEOUT_MS || 4000);
const SLOW_RESPONSE_MS = Number(process.env.SLOW_RESPONSE_MS || 5000);
const RETRIES = Number(process.env.CHECK_RETRIES || 0);
const DOWN_CONFIRMATIONS = Math.max(1, Number(process.env.DOWN_CONFIRMATIONS || 2));
const RECOVERY_CONFIRMATIONS = Math.max(1, Number(process.env.RECOVERY_CONFIRMATIONS || 2));
const DEGRADED_HTTP_CODES = new Set(
  (process.env.CHECK_DEGRADED_HTTP_CODES || "503")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter(Number.isFinite)
);
// URL ทั้งหมดต้องเริ่มใน wave เดียว มิฉะนั้น URL ที่ timeout หลายตัวจะต่อคิวยาวเกิน 60 วินาที
const CONCURRENCY = Math.max(1, Number(process.env.CHECK_CONCURRENCY || 160));
// จำกัดงานเขียน DB แยกต่างหาก เพื่อให้เร็วแต่ไม่เปิด connection พร้อมกันหลายร้อยรายการ
const WRITE_CONCURRENCY = Math.max(1, Number(process.env.CHECK_WRITE_CONCURRENCY || 24));
const OA_CONCURRENCY = Math.max(1, Number(process.env.CHECK_OA_CONCURRENCY || 80));
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";
// กลุ่ม Telegram ใช้เป็นช่องแจ้ง "ปัญหาที่ต้องจัดการ" เป็นหลัก
// ข้อความสีเขียวตอนฟื้นตัวเปิดได้ภายหลัง แต่ค่าเริ่มต้นปิดเพื่อไม่รบกวนกลุ่ม
const NOTIFY_RECOVERY = recoveryNotificationsEnabled(process.env.TELEGRAM_NOTIFY_RECOVERY);

const CHROME_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const LINE_UA = `${CHROME_UA} Line/13.7.1`;

// เลือก header ตามโดเมน — LINE/Telegram ต้องมี Referer ที่ถูกต้อง
function headersFor(url: string): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent": CHROME_UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Upgrade-Insecure-Requests": "1",
    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?1",
    "sec-ch-ua-platform": '"Android"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
  };
  try {
    const host = new URL(url).host.toLowerCase();
    if (host.endsWith("lin.ee") || host.endsWith("line.me") || host.endsWith("liff.line.me")) {
      h["User-Agent"] = LINE_UA;
      h["Referer"] = "https://line.me/";
    } else if (host.endsWith("t.me") || host.endsWith("telegram.me")) {
      h["Referer"] = "https://t.me/";
    }
  } catch {
    /* ignore url ที่ parse ไม่ได้ */
  }
  return h;
}

export type ProbeResult = {
  ok: boolean;
  httpCode: number | null;
  responseMs: number;
  error: string | null;
  degraded?: boolean;
};

// ยิง fetch 1 ครั้งพร้อม timeout ของตัวเอง (แต่ละ method ได้เวลาเต็ม ไม่โดน abort ต่อกัน)
async function fetchWithTimeout(
  url: string,
  method: "HEAD" | "GET",
  timeoutMs = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: headersFor(url),
    });
  } finally {
    clearTimeout(timer);
  }
}

// สถานะที่แปลว่า "เซิร์ฟเวอร์ยังตอบอยู่ แต่กันบอท/ต้องยืนยันตัวตน" — เว็บไม่ได้ล่ม
// (Cloudflare/anti-bot มักตอบ 403 กับบอทจาก IP ดาต้าเซ็นเตอร์ แต่คนกดเข้าปกติ)
const ALIVE_BLOCKED = new Set([401, 403, 429, 451]);
// ถือว่า "ใช้ได้" เมื่อ HTTP < 400 หรือเป็นรหัสกันบอท/ยืนยันตัวตนข้างบน
function statusOk(status: number): boolean {
  return status < 400 || ALIVE_BLOCKED.has(status);
}

export function isDegradedAvailability(getStatus: number, headStatus: number): boolean {
  return getStatus >= 500 && statusOk(headStatus);
}

export function isConfiguredDegradedStatus(status: number): boolean {
  return DEGRADED_HTTP_CODES.has(status);
}

export function isMonitorTimeout(error: { name?: string } | null | undefined): boolean {
  return error?.name === "AbortError";
}

export function recoveryNotificationsEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

// ยิงเช็ค URL 1 ครั้ง
async function probeOnce(url: string): Promise<ProbeResult> {
  const start = Date.now();
  try {
    // GET สะท้อนสิ่งที่ผู้ใช้เปิดจริงกว่า HEAD
    let res = await fetchWithTimeout(url, "GET");
    if (res.status === 405 || res.status === 501) {
      res = await fetchWithTimeout(url, "HEAD", HEAD_TIMEOUT_MS);
    }
    // ถ้า Vercel ถูก WAF ตอบ 5xx แต่ HEAD ยังตอบ ให้เป็น degraded/SLOW ไม่ใช่ DOWN
    if (res.status >= 500) {
      try {
        const head = await fetchWithTimeout(url, "HEAD", HEAD_TIMEOUT_MS);
        if (isDegradedAvailability(res.status, head.status)) {
          return {
            ok: true,
            httpCode: res.status,
            responseMs: Date.now() - start,
            error: `GET ${res.status}; HEAD ${head.status}`,
            degraded: true,
          };
        }
      } catch {
        // ใช้ผล GET เดิมหาก HEAD ยืนยันไม่ได้
      }
      // เว็บหลัง WAF หลายแห่งตอบ 503 เฉพาะ IP ของ server monitor ทั้งที่ผู้ใช้เปิดได้
      // ค่าเริ่มต้นจึงแสดง SLOW และไม่เปิด Incident; ปรับรหัสได้ผ่าน CHECK_DEGRADED_HTTP_CODES
      if (isConfiguredDegradedStatus(res.status)) {
        return {
          ok: true,
          httpCode: res.status,
          responseMs: Date.now() - start,
          error: `HTTP ${res.status} จาก monitor/WAF`,
          degraded: true,
        };
      }
    }
    const responseMs = Date.now() - start;
    const ok = statusOk(res.status);
    return {
      ok,
      httpCode: res.status,
      responseMs,
      error: ok ? null : `HTTP ${res.status}`,
    };
  } catch {
    // GET ล้มเหลว — ใช้ HEAD ยืนยันว่า origin ยังตอบหรือไม่
    try {
      const res = await fetchWithTimeout(url, "HEAD", HEAD_TIMEOUT_MS);
      const responseMs = Date.now() - start;
      const ok = statusOk(res.status);
      return {
        ok,
        httpCode: res.status,
        responseMs,
        error: ok ? null : `HTTP ${res.status}`,
        degraded: ok,
      };
    } catch (e2: unknown) {
      const responseMs = Date.now() - start;
      const err = e2 as { name?: string; message?: string };
      // timeout จากทั้ง GET และ HEAD ยังพิสูจน์ไม่ได้ว่าเว็บล่มจริง เพราะหลายเว็บ
      // ทิ้ง request จาก IP ศูนย์ข้อมูล/WAF แต่ผู้ใช้ผ่านมือถือยังเปิดได้ตามปกติ
      // จึงจัดเป็น SLOW/degraded; DNS/connection error ที่ตอบกลับชัดเจนยังเป็น DOWN
      if (isMonitorTimeout(err)) {
        return {
          ok: true,
          httpCode: null,
          responseMs,
          error: `monitor timeout ${TIMEOUT_MS + HEAD_TIMEOUT_MS}ms (ยังยืนยันว่าเว็บล่มไม่ได้)`,
          degraded: true,
        };
      }
      const message = err?.message || "เชื่อมต่อไม่ได้";
      return { ok: false, httpCode: null, responseMs, error: message };
    }
  }
}

function urlKey(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

// เช็ค URL พร้อมลองซ้ำ — คืน "ล่ม" ต่อเมื่อพยายามครบทุกครั้งแล้วยังไม่ผ่าน
export async function probe(url: string): Promise<ProbeResult> {
  let last: ProbeResult = await probeOnce(url);
  for (let attempt = 1; attempt <= RETRIES && !last.ok; attempt++) {
    // เว้นสั้นๆ ก่อนลองใหม่ เผื่อเว็บสะดุดชั่วขณะ
    await new Promise((r) => setTimeout(r, 800));
    last = await probeOnce(url);
  }
  return last;
}

export type CheckSummary = {
  checked: number;
  up: number;
  slow: number;
  down: number;
  pending: number;
  newIncidents: number;
  recovered: number;
  ranAt: string;
};

export async function forEachConcurrent<T>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await task(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, worker)
  );
}

export function classifyProbeStatus(result: ProbeResult): LinkStatus {
  if (!result.ok) return "DOWN";
  return result.degraded || result.responseMs >= SLOW_RESPONSE_MS ? "SLOW" : "UP";
}

// CheckLog ใช้เป็นประวัติการเปลี่ยนสถานะ ไม่ใช่ heartbeat ทุก 5 นาที
// สถานะปัจจุบันและเวลาตรวจล่าสุดเก็บอยู่บน Link อยู่แล้ว การเขียนทุกรอบทำให้
// ฐานข้อมูลฟรีโตหลายแสนแถวต่อวันโดยไม่เพิ่มข้อมูลที่หน้ารายงานใช้งาน
export function shouldRecordCheckLog(
  previousStatus: LinkStatus,
  probeStatus: LinkStatus,
  lastCheckedAt: Date | null
): boolean {
  return lastCheckedAt === null || previousStatus !== probeStatus;
}

// แผนที่ route Telegram ต่อบริษัท (ถ้าตั้งไว้)
type TgRoute = { botToken: string; chatId: string };

// ส่งแจ้งเตือน: ถ้าบริษัทมี route ของตัวเอง ส่งเข้ากลุ่มนั้น ไม่งั้นใช้กลุ่มกลาง
async function notifyCompany(
  routes: Map<string, TgRoute>,
  companyId: string | null | undefined,
  msg: string | TgMessage
): Promise<{ ok: boolean }> {
  const r = companyId ? routes.get(companyId) : undefined;
  if (r) return sendTelegramTo(r.botToken, r.chatId, msg);
  return sendTelegram(msg, "all");
}

async function loadRoutes(): Promise<Map<string, TgRoute>> {
  const companies = await prisma.company.findMany({
    select: { id: true, tgBotToken: true, tgChatId: true },
  });
  const map = new Map<string, TgRoute>();
  for (const c of companies) {
    if (c.tgBotToken && c.tgBotToken.trim() && c.tgChatId && c.tgChatId.trim()) {
      map.set(c.id, { botToken: c.tgBotToken.trim(), chatId: c.tgChatId.trim() });
    }
  }
  return map;
}

// เช็คลิงก์ทั้งหมดที่เปิดใช้งาน + จัดการ incident + แจ้งเตือน
export async function runCheck(): Promise<CheckSummary> {
  const [links, routes] = await Promise.all([
    prisma.link.findMany({
      where: { isActive: true },
      include: {
        company: { select: { id: true, name: true } },
        lineGroup: { select: { id: true, name: true } },
      },
    }),
    loadRoutes(),
  ]);
  const summary: CheckSummary = {
    checked: 0,
    up: 0,
    slow: 0,
    down: 0,
    pending: 0,
    newIncidents: 0,
    recovered: 0,
    ranAt: new Date().toISOString(),
  };
  // OA เป็นงานอิสระ จึงเริ่มพร้อมกับการตรวจ URL แทนการรอต่อท้ายรอบ
  const oaChecksPromise = runOaChecks(routes);

  // URL เดียวอาจอยู่หลายห้อง: ยิงจริงครั้งเดียวแล้วใช้ผลร่วมกัน
  const uniqueUrls = Array.from(new Set(links.map((link) => urlKey(link.url))));
  const results = new Map<string, ProbeResult>();
  const openIncidentsPromise = prisma.incident.findMany({
    where: { linkId: { in: links.map((link) => link.id) }, status: { not: "CLOSED" } },
    orderBy: { detectedAt: "desc" },
  });
  await forEachConcurrent(uniqueUrls, CONCURRENCY, async (url) => {
    results.set(url, await probe(url));
  });

  // โหลดเคสค้างครั้งเดียว แทนการ query ซ้ำ 504 ครั้ง
  const openIncidentRows = await openIncidentsPromise;
  const openByLink = new Map<string, typeof openIncidentRows>();
  for (const incident of openIncidentRows) {
    const rows = openByLink.get(incident.linkId) || [];
    rows.push(incident);
    openByLink.set(incident.linkId, rows);
  }

  const checkedAt = new Date();
  const prepared = links.flatMap((link) => {
    const result = results.get(urlKey(link.url));
    if (!result) return [];
    const probeStatus = classifyProbeStatus(result);
    // URL เดียวกันแต่คนละห้อง LINE คือคนละงาน จึง map เคสตาม linkId
    const openIncidents = openByLink.get(link.id) || [];
    const state = confirmCheckState({
      probeStatus,
      currentStatus: link.lastStatus,
      hasOpenIncident: openIncidents.length > 0,
      failureStreak: link.failureStreak,
      recoveryStreak: link.recoveryStreak,
      downConfirmations: DOWN_CONFIRMATIONS,
      recoveryConfirmations: RECOVERY_CONFIRMATIONS,
    });
    const { status, failureStreak, recoveryStreak } = state;
    summary.checked++;
    if (state.pendingVerification) summary.pending++;
    else if (status === "UP") summary.up++;
    else if (status === "SLOW") summary.slow++;
    else summary.down++;

    return [{ link, result, probeStatus, openIncidents, state, status, failureStreak, recoveryStreak }];
  });

  // อัปเดต heartbeat ทั้ง 504 ลิงก์ด้วย SQL คำสั่งเดียว แทน 504 round trips ไป Neon
  // ซึ่งเป็นคอขวดหลักที่ทำให้ cron-job.org รอเกิน 30 วินาที
  if (prepared.length > 0) {
    const rows = prepared.map(({ link, result, status, failureStreak, recoveryStreak }) =>
      Prisma.sql`(${link.id}::text, ${status}::"LinkStatus", ${result.httpCode}::integer, ${result.responseMs}::integer, ${failureStreak}::integer, ${recoveryStreak}::integer)`
    );
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "Link" AS target
      SET
        "lastStatus" = source.status,
        "lastCheckedAt" = ${checkedAt},
        "lastHttpCode" = source.http_code,
        "lastResponseMs" = source.response_ms,
        "failureStreak" = source.failure_streak,
        "recoveryStreak" = source.recovery_streak,
        "updatedAt" = ${checkedAt}
      FROM (VALUES ${Prisma.join(rows)}) AS source(
        id, status, http_code, response_ms, failure_streak, recovery_streak
      )
      WHERE target.id = source.id
    `);

    const logRows = prepared
      .filter(({ link, probeStatus }) =>
        shouldRecordCheckLog(link.lastStatus, probeStatus, link.lastCheckedAt)
      )
      .map(({ link, result, probeStatus }) => ({
        linkId: link.id,
        status: probeStatus,
        httpCode: result.httpCode,
        responseMs: result.responseMs,
        error: result.error,
        checkedAt,
      }));
    if (logRows.length > 0) await prisma.checkLog.createMany({ data: logRows });
  }

  // เปิด/ปิด incident และส่งข้อความเฉพาะรายการที่เปลี่ยนสถานะเท่านั้น
  await forEachConcurrent(prepared, WRITE_CONCURRENCY, async ({ link, result, openIncidents, state }) => {
    const now = checkedAt;

    if (state.shouldOpenIncident) {
      const incident = await prisma.incident.create({
        data: { linkId: link.id, detectedAt: now, status: "OPEN" },
      });
      summary.newIncidents++;

      const msg = downAlertMessage({
        incidentId: incident.id,
        company: link.company.name,
        room: link.lineGroup?.name,
        name: link.name,
        url: link.url,
        category: link.category,
        httpCode: result.httpCode,
        error: result.error,
        backupUrl: link.backupUrl,
        detectedAt: now,
        appBaseUrl: APP_BASE_URL,
      });
      const sent = await notifyCompany(routes, link.companyId, msg);
      if (sent.ok) {
        await prisma.incident.update({
          where: { id: incident.id },
          data: { notifiedAt: new Date() },
        });
      }
    }

    if (state.shouldCloseIncident) {
      const newestOpen = openIncidents[0];
      if (newestOpen) {
        const downMinutes = Math.max(
          1,
          Math.round((now.getTime() - newestOpen.detectedAt.getTime()) / 60000)
        );
        await prisma.incident.updateMany({
          where: { id: { in: openIncidents.map((incident) => incident.id) } },
          data: { status: "CLOSED", resolvedAt: now },
        });
        summary.recovered += openIncidents.length;
        // เคสที่เกิดจาก monitor timeout เป็น false DOWN เดิม ไม่ส่ง recovery
        // หลายสิบข้อความไปรบกวนกลุ่ม Telegram ตอนระบบแก้สถานะกลับเป็น SLOW
        if (NOTIFY_RECOVERY && !(result.degraded && result.httpCode === null)) {
          await notifyCompany(
            routes,
            link.companyId,
            recoveredMessage({
              incidentId: newestOpen.id,
              company: link.company.name,
              name: link.name,
              url: link.url,
              downMinutes,
              appBaseUrl: APP_BASE_URL,
            })
          );
        }
      }
    }
  });

  await oaChecksPromise;

  return summary;
}

// ตรวจ LINE OA ทุกห้องที่มี Channel Access Token — เก็บสถานะ + แจ้งเตือนตอนเปลี่ยนสถานะ
export async function runOaChecks(routes?: Map<string, TgRoute>): Promise<void> {
  const r = routes || (await loadRoutes());
  const groups = await prisma.lineGroup.findMany({
    where: { isActive: true, NOT: { channelAccessToken: null } },
    include: { company: { select: { id: true, name: true } } },
  });
  await forEachConcurrent(groups, OA_CONCURRENCY, async (g) => {
    const token = (g.channelAccessToken || "").trim();
    if (!token) return;
    const prevStatus = g.oaStatus;
    const res = await checkOa(token, g.expectedOaName);
    await prisma.lineGroup.update({
      where: { id: g.id },
      data: {
        oaStatus: res.status,
        oaDisplayName: res.displayName,
        oaHasPicture: res.hasPicture,
        oaError: res.error,
        oaLastCheckedAt: new Date(),
      },
    });
    // แจ้งเตือนเมื่อ "เปลี่ยนเข้าสู่สถานะผิดปกติ" — รวมถึงพังตั้งแต่ตรวจครั้งแรก (UNKNOWN->ผิดปกติ)
    // และเปลี่ยนจากผิดปกติแบบหนึ่งไปอีกแบบ (เช่น MISMATCH->TOKEN_INVALID) แต่ไม่สแปมสถานะเดิมซ้ำ
    if (res.status !== "OK" && res.status !== prevStatus) {
      await notifyCompany(
        r,
        g.companyId,
        oaAlertMessage({
          room: g.name,
          company: g.company.name,
          status: res.status,
          displayName: res.displayName,
          expectedName: g.expectedOaName,
          appBaseUrl: APP_BASE_URL,
        })
      );
    } else if (
      NOTIFY_RECOVERY &&
      res.status === "OK" &&
      prevStatus !== "OK" &&
      prevStatus !== "UNKNOWN"
    ) {
      await notifyCompany(
        r,
        g.companyId,
        oaRecoveredMessage({ room: g.name, company: g.company.name, appBaseUrl: APP_BASE_URL })
      );
    }
  });
}
