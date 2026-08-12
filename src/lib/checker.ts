import { prisma } from "@/lib/prisma";
import {
  sendTelegram,
  downAlertMessage,
  recoveredMessage,
} from "@/lib/telegram";
import type { LinkStatus } from "@prisma/client";

const TIMEOUT_MS = Number(process.env.CHECK_TIMEOUT_MS || 15000);
// ลองซ้ำกี่ครั้งก่อนจะตัดสินว่า "ล่มจริง" (กันเว็บตอบช้า/หลุดชั่วคราว)
const RETRIES = Number(process.env.CHECK_RETRIES || 2);
// เช็คพร้อมกันกี่ลิงก์ (network-bound จึงขนานได้ ปลอดภัยกับ DB เพราะเขียนทีหลังแบบเรียงลำดับ)
const CONCURRENCY = Number(process.env.CHECK_CONCURRENCY || 8);
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

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
      headers: { "User-Agent": "DomainWatch/1.0 (+monitoring)" },
    });
  } finally {
    clearTimeout(timer);
  }
}

// ยิงเช็ค URL 1 ครั้ง — ถือว่า "ใช้ได้" เมื่อ HTTP < 400
async function probeOnce(url: string): Promise<ProbeResult> {
  const start = Date.now();
  try {
    // ลอง HEAD ก่อน (เบากว่า)
    let res = await fetchWithTimeout(url, "HEAD");
    // บางเว็บไม่รองรับ HEAD -> ลอง GET (ด้วย timeout ใหม่)
    if (res.status === 405 || res.status === 501) {
      res = await fetchWithTimeout(url, "GET");
    }
    const responseMs = Date.now() - start;
    return {
      ok: res.status < 400,
      httpCode: res.status,
      responseMs,
      error: res.status < 400 ? null : `HTTP ${res.status}`,
    };
  } catch {
    // HEAD ล้มเหลว (timeout/บล็อก) — ลอง GET ด้วย timeout ใหม่ก่อนตัดสินว่าล่ม
    try {
      const res = await fetchWithTimeout(url, "GET");
      const responseMs = Date.now() - start;
      return {
        ok: res.status < 400,
        httpCode: res.status,
        responseMs,
        error: res.status < 400 ? null : `HTTP ${res.status}`,
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

// เช็คลิงก์ทั้งหมดที่เปิดใช้งาน + จัดการ incident + แจ้งเตือน
export async function runCheck(): Promise<CheckSummary> {
  const links = await prisma.link.findMany({ where: { isActive: true } });
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

    // เปลี่ยนจากใช้ได้/ไม่รู้ -> ล่ม : เปิด incident + แจ้งเตือน
    if (status === "DOWN" && prev !== "DOWN") {
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
        const sent = await sendTelegram(msg, "all");
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
          await sendTelegram(
            recoveredMessage({
              name: link.name,
              url: link.url,
              downMinutes,
              appBaseUrl: APP_BASE_URL,
            }),
            "all"
          );
        }
      }
    }
  }

  return summary;
}
