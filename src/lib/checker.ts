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
import type { LinkStatus } from "@prisma/client";

const TIMEOUT_MS = Number(process.env.CHECK_TIMEOUT_MS || 15000);
// ลองซ้ำกี่ครั้งก่อนจะตัดสินว่า "ล่มจริง" (กันเว็บตอบช้า/หลุดชั่วคราว)
const RETRIES = Number(process.env.CHECK_RETRIES || 2);
// เช็คพร้อมกันกี่ลิงก์ (network-bound จึงขนานได้ ปลอดภัยกับ DB เพราะเขียนทีหลังแบบเรียงลำดับ)
const CONCURRENCY = Number(process.env.CHECK_CONCURRENCY || 8);
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

// UA แบบเบราว์เซอร์มือถือ (เหมือนที่ระบบเก่าใช้) — ลด 403 หลอกจากเว็บที่กันบอท
const BROWSER_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 Line/13.7.1";

// เลือก header ตามโดเมน — LINE/Telegram ต้องมี Referer ที่ถูกต้อง
function headersFor(url: string): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent": BROWSER_UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7",
  };
  try {
    const host = new URL(url).host.toLowerCase();
    if (host.endsWith("lin.ee") || host.endsWith("line.me") || host.endsWith("liff.line.me")) {
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
};

// ยิง fetch 1 ครั้งพร้อม timeout ของตัวเอง (แต่ละ method ได้เวลาเต็ม ไม่โดน abort ต่อกัน)
async function fetchWithTimeout(url: string, method: "HEAD" | "GET"): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
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

// ยิงเช็ค URL 1 ครั้ง
async function probeOnce(url: string): Promise<ProbeResult> {
  const start = Date.now();
  try {
    // ลอง HEAD ก่อน (เบากว่า)
    let res = await fetchWithTimeout(url, "HEAD");
    // หลายเว็บ (โดยเฉพาะที่กันบอท) ปฏิเสธ HEAD ด้วย 403/405/501 ฯลฯ แต่ตอบ GET ปกติ
    // -> ถ้า HEAD ไม่ผ่าน (>=400) ลอง GET ซ้ำก่อนตัดสินว่าล่ม กัน 403 หลอก
    if (res.status >= 400) {
      res = await fetchWithTimeout(url, "GET");
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
    // HEAD ล้มเหลว (timeout/บล็อก) — ลอง GET ด้วย timeout ใหม่ก่อนตัดสินว่าล่ม
    try {
      const res = await fetchWithTimeout(url, "GET");
      const responseMs = Date.now() - start;
      const ok = statusOk(res.status);
      return {
        ok,
        httpCode: res.status,
        responseMs,
        error: ok ? null : `HTTP ${res.status}`,
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
  down: number;
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
    include: { company: { select: { id: true } } },
  });
  const routes = await loadRoutes();
  const summary: CheckSummary = {
    checked: 0,
    up: 0,
    down: 0,
    newIncidents: 0,
    recovered: 0,
    ranAt: new Date().toISOString(),
  };

  // 1) ยิงเช็คทุกลิงก์แบบขนาน (เป็นงาน network จึงเร็วและปลอดภัย)
  const results: ProbeResult[] = new Array(links.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= links.length) return;
      results[i] = await probe(links[i].url);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, links.length) }, worker)
  );

  // 2) บันทึกผล + จัดการ incident/แจ้งเตือน แบบเรียงลำดับ (กันโหลด DB พุ่ง)
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const result = results[i];
    const status: LinkStatus = result.ok ? "UP" : "DOWN";
    const prev = link.lastStatus;
    summary.checked++;
    if (result.ok) summary.up++;
    else summary.down++;

    const now = new Date();

    await prisma.checkLog.create({
      data: {
        linkId: link.id,
        status,
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
      },
    });

    // ลิงก์ล่ม : เปิด incident ถ้ายังไม่มีเคสค้าง (ครอบคลุมกรณีเคสถูกปิดมือทั้งที่ยังล่มอยู่ -> เปิดใหม่ให้)
    if (status === "DOWN") {
      const existingOpen = await prisma.incident.findFirst({
        where: { linkId: link.id, status: { not: "CLOSED" } },
      });
      if (!existingOpen) {
        const incident = await prisma.incident.create({
          data: { linkId: link.id, detectedAt: now, status: "OPEN" },
        });
        summary.newIncidents++;

        const msg = downAlertMessage({
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
    }

    // ลิงก์ใช้ได้ : ปิดเคสที่ยังเปิดค้างของลิงก์นี้ทั้งหมด (self-heal เคสที่ค้างจากรอบก่อน)
    if (status === "UP") {
      const open = await prisma.incident.findFirst({
        where: { linkId: link.id, status: { not: "CLOSED" } },
        orderBy: { detectedAt: "desc" },
      });
      if (open) {
        const downMinutes = Math.max(
          1,
          Math.round((now.getTime() - open.detectedAt.getTime()) / 60000)
        );
        await prisma.incident.update({
          where: { id: open.id },
          data: { status: "CLOSED", resolvedAt: now },
        });
        summary.recovered++;
        // แจ้ง Telegram เฉพาะตอนเพิ่งกลับมาปกติจริง (prev = DOWN) กันสแปมตอนเก็บกวาดเคสค้าง
        if (prev === "DOWN") {
          await notifyCompany(
            routes,
            link.companyId,
            recoveredMessage({
              name: link.name,
              url: link.url,
              downMinutes,
              appBaseUrl: APP_BASE_URL,
            })
          );
        }
      }
    }
  }

  // 3) ตรวจ LINE OA (เฉพาะห้องที่ใส่ token)
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
