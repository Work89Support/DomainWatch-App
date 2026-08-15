import { prisma } from "@/lib/prisma";
import {
  sendTelegram,
  sendTelegramTo,
  downAlertMessage,
  recoveredMessage,
  oaAlertMessage,
  oaRecoveredMessage,
} from "@/lib/telegram";
import { checkOa } from "@/lib/line";
import { confirmCheckState } from "@/lib/checkState";
import type { LinkStatus } from "@prisma/client";

const TIMEOUT_MS = Number(process.env.CHECK_TIMEOUT_MS || 25000);
const HEAD_TIMEOUT_MS = Number(process.env.CHECK_HEAD_TIMEOUT_MS || 5000);
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
// เช็คพร้อมกันกี่ลิงก์ (network-bound จึงขนานได้ ปลอดภัยกับ DB เพราะเขียนทีหลังแบบเรียงลำดับ)
const CONCURRENCY = Number(process.env.CHECK_CONCURRENCY || 8);
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

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
      const message =
        err?.name === "AbortError"
          ? `หมดเวลา (timeout ${TIMEOUT_MS}ms)`
          : err?.message || "เชื่อมต่อไม่ได้";
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

// แผนที่ route Telegram ต่อบริษัท (ถ้าตั้งไว้)
type TgRoute = { botToken: string; chatId: string };

// ส่งแจ้งเตือน: ถ้าบริษัทมี route ของตัวเอง ส่งเข้ากลุ่มนั้น ไม่งั้นใช้กลุ่มกลาง
async function notifyCompany(
  routes: Map<string, TgRoute>,
  companyId: string | null | undefined,
  msg: string
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
  const links = await prisma.link.findMany({
    where: { isActive: true },
    include: {
      company: { select: { id: true, name: true } },
      lineGroup: { select: { id: true, name: true } },
    },
  });
  const routes = await loadRoutes();
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

  // URL เดียวอาจอยู่หลายห้อง: ยิงจริงครั้งเดียวแล้วใช้ผลร่วมกัน
  const uniqueUrls = Array.from(new Set(links.map((link) => urlKey(link.url))));
  const results = new Map<string, ProbeResult>();
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= uniqueUrls.length) return;
      results.set(uniqueUrls[i], await probe(uniqueUrls[i]));
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, uniqueUrls.length) }, worker)
  );

  const equivalentLinkIds = new Map<string, string[]>();
  for (const link of links) {
    const key = `${link.companyId}\u0000${urlKey(link.url)}`;
    equivalentLinkIds.set(key, [...(equivalentLinkIds.get(key) || []), link.id]);
  }

  // 2) บันทึกผล + จัดการ incident/แจ้งเตือน แบบเรียงลำดับ (กันโหลด DB พุ่ง)
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const result = results.get(urlKey(link.url));
    if (!result) continue;
    const probeStatus: LinkStatus = !result.ok
      ? "DOWN"
      : result.degraded || result.responseMs >= SLOW_RESPONSE_MS
        ? "SLOW"
        : "UP";
    const groupKey = `${link.companyId}\u0000${urlKey(link.url)}`;
    const siblingLinkIds = equivalentLinkIds.get(groupKey) || [link.id];
    const openIncidents = await prisma.incident.findMany({
      where: { linkId: { in: siblingLinkIds }, status: { not: "CLOSED" } },
      orderBy: { detectedAt: "desc" },
    });
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

    const now = new Date();

    await prisma.checkLog.create({
      data: {
        linkId: link.id,
        status: probeStatus,
        httpCode: result.httpCode,
        responseMs: result.responseMs,
        error: result.error,
      },
    });

    await prisma.link.update({
      where: { id: link.id },
      data: {
        lastStatus: status,
        lastCheckedAt: now,
        lastHttpCode: result.httpCode,
        lastResponseMs: result.responseMs,
        failureStreak,
        recoveryStreak,
      },
    });

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

  await runOaChecks(routes);

  return summary;
}

// ตรวจ LINE OA ทุกห้องที่มี Channel Access Token — เก็บสถานะ + แจ้งเตือนตอนเปลี่ยนสถานะ
export async function runOaChecks(routes?: Map<string, TgRoute>): Promise<void> {
  const r = routes || (await loadRoutes());
  const groups = await prisma.lineGroup.findMany({
    where: { isActive: true, NOT: { channelAccessToken: null } },
    include: { company: { select: { id: true, name: true } } },
  });
  for (const g of groups) {
    const token = (g.channelAccessToken || "").trim();
    if (!token) continue;
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
    } else if (res.status === "OK" && prevStatus !== "OK" && prevStatus !== "UNKNOWN") {
      await notifyCompany(
        r,
        g.companyId,
        oaRecoveredMessage({ room: g.name, company: g.company.name })
      );
    }
  }
}
