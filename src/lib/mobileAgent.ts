import crypto from "crypto";
import type { LinkStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  networkDownMessage,
  networkRecoveredMessage,
  sendTelegram,
  sendTelegramTo,
  type TgMessage,
} from "@/lib/telegram";

const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";
export const ENROLLMENT_TTL_MINUTES = 15;
export const MOBILE_DOWN_CONFIRMATIONS = Math.max(2, Number(process.env.MOBILE_DOWN_CONFIRMATIONS || 2));
export const MOBILE_RECOVERY_CONFIRMATIONS = Math.max(2, Number(process.env.MOBILE_RECOVERY_CONFIRMATIONS || 2));

export function hashSecret(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomSecret(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function normalizeUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    url.hash = "";
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function mobileUrlHash(value: string): string {
  return hashSecret(normalizeUrl(value));
}

function cleanBaseUrl(value?: string): string {
  return (value || "").trim().replace(/\/$/, "");
}

function isLoopbackUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1";
  } catch {
    return false;
  }
}

export function resolvePublicBaseUrl(requestBaseUrl?: string): string {
  const configured = cleanBaseUrl(process.env.APP_BASE_URL);
  const requested = cleanBaseUrl(requestBaseUrl);

  // ป้องกันค่า APP_BASE_URL ของเครื่องพัฒนาหลุดไปอยู่ใน QR บน production
  if (configured && (!isLoopbackUrl(configured) || !requested || isLoopbackUrl(requested))) return configured;
  if (requested) return requested;

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export function bearerToken(header: string | null): string {
  if (!header?.startsWith("Bearer ")) return "";
  return header.slice(7).trim();
}

export async function authenticateMobileAgent(header: string | null) {
  const token = bearerToken(header);
  if (!token) return null;
  return prisma.mobileAgent.findFirst({
    where: { tokenHash: hashSecret(token), isActive: true },
  });
}

export async function createEnrollment(agentId: string, requestBaseUrl: string) {
  const code = randomSecret(24);
  const expiresAt = new Date(Date.now() + ENROLLMENT_TTL_MINUTES * 60_000);
  await prisma.mobileEnrollment.create({
    data: { agentId, codeHash: hashSecret(code), expiresAt },
  });
  const base = resolvePublicBaseUrl(requestBaseUrl);
  return {
    code,
    expiresAt,
    enrollmentUrl: `${base}/agent/enroll?code=${encodeURIComponent(code)}`,
  };
}

type MobileResultInput = {
  urlHash: string;
  url: string;
  status: LinkStatus;
  httpCode?: number | null;
  responseMs?: number | null;
  error?: string | null;
  finalUrl?: string | null;
  redirectCount?: number;
  redirectChain?: string[];
  pageTitle?: string | null;
  blockPageDetected?: boolean;
  checkedAt: Date;
};

export type MobileRedirectType = "NONE" | "NORMAL" | "NETWORK_BLOCK" | "POSSIBLE_DOMAIN_MOVE";

const SHORTENER_HOSTS = new Set([
  "bit.ly", "cutt.ly", "tinyurl.com", "t.co", "rebrand.ly", "shorturl.at", "is.gd", "v.gd",
]);

function hostname(value?: string | null): string {
  try { return new URL(value || "").hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

export function classifyMobileRedirect(input: {
  requestedUrl: string;
  finalUrl?: string | null;
  redirectCount?: number;
  httpCode?: number | null;
  blockPageDetected?: boolean;
}): MobileRedirectType {
  const requested = normalizeUrl(input.requestedUrl);
  const finalUrl = normalizeUrl(input.finalUrl || input.requestedUrl);
  const count = Math.max(0, input.redirectCount || 0);
  if (count === 0 || requested === finalUrl) return "NONE";

  const from = hostname(requested);
  const to = hostname(finalUrl);
  const suspicious = /(block|blocked|deny|denied|forbidden|suspend|ระงับ|ปิดกั้น)/i.test(finalUrl);
  if (input.blockPageDetected || input.httpCode === 451 || suspicious) return "NETWORK_BLOCK";
  if (SHORTENER_HOSTS.has(from)) return "NORMAL";
  if (from && to && (from === to || from.endsWith(`.${to}`) || to.endsWith(`.${from}`))) return "NORMAL";
  return "POSSIBLE_DOMAIN_MOVE";
}

type TelegramRoute = { botToken: string; chatId: string };

async function loadRoutes() {
  const companies = await prisma.company.findMany({
    select: { id: true, tgBotToken: true, tgChatId: true },
  });
  const routes = new Map<string, TelegramRoute>();
  for (const company of companies) {
    if (company.tgBotToken?.trim() && company.tgChatId?.trim()) {
      routes.set(company.id, { botToken: company.tgBotToken.trim(), chatId: company.tgChatId.trim() });
    }
  }
  return routes;
}

async function notifyCompany(routes: Map<string, TelegramRoute>, companyId: string, message: TgMessage) {
  const route = routes.get(companyId);
  if (route) return sendTelegramTo(route.botToken, route.chatId, message);
  return sendTelegram(message, "all");
}

export function nextMobileState(previous: {
  status: LinkStatus;
  failureStreak: number;
  recoveryStreak: number;
} | null, probeStatus: LinkStatus) {
  const current = previous?.status || "UNKNOWN";
  if (probeStatus === "DOWN") {
    const failureStreak = (previous?.failureStreak || 0) + 1;
    return {
      status: failureStreak >= MOBILE_DOWN_CONFIRMATIONS ? "DOWN" as const : current,
      failureStreak,
      recoveryStreak: 0,
      opened: current !== "DOWN" && failureStreak >= MOBILE_DOWN_CONFIRMATIONS,
      recovered: false,
    };
  }
  const recoveryStreak = current === "DOWN" ? (previous?.recoveryStreak || 0) + 1 : 0;
  const recovered = current === "DOWN" && recoveryStreak >= MOBILE_RECOVERY_CONFIRMATIONS;
  return {
    status: current === "DOWN" && !recovered ? "DOWN" as const : probeStatus,
    failureStreak: 0,
    recoveryStreak: recovered ? 0 : recoveryStreak,
    opened: false,
    recovered,
  };
}

export function isInconclusiveMobileTimeout(error?: string | null): boolean {
  if (!error) return false;
  return /(sockettimeoutexception|read timed out|connect timed out|timeout|timed out)/i.test(error);
}

export function normalizeMobileProbeStatus(
  status: LinkStatus,
  error?: string | null
): LinkStatus {
  // Timeout จากซิมบอกได้เพียงว่าเว็บตอบช้า/ตรวจไม่จบ ไม่ได้ยืนยันว่าเว็บล่ม
  // ทำที่ server ด้วยเพื่อรองรับแอปรุ่นเก่าที่ยังส่ง DOWN มา
  return status === "DOWN" && isInconclusiveMobileTimeout(error) ? "SLOW" : status;
}

export async function storeMobileResults(agentId: string, results: MobileResultInput[]) {
  const agent = await prisma.mobileAgent.findUniqueOrThrow({ where: { id: agentId } });
  const routes = await loadRoutes();
  const pendingAdminIncidents = await prisma.networkIncident.findMany({
    where: { agentId, status: "ADMIN_UPDATED" },
    select: { link: { select: { url: true } } },
  });
  const pendingAdminUrls = new Set(
    pendingAdminIncidents.map((incident) => normalizeUrl(incident.link.url))
  );
  let opened = 0;
  let recovered = 0;

  for (const result of results) {
    const normalized = normalizeUrl(result.url);
    if (mobileUrlHash(normalized) !== result.urlHash) continue;
    const previous = await prisma.mobileUrlStatus.findUnique({
      where: { agentId_urlHash: { agentId, urlHash: result.urlHash } },
    });
    if (previous && result.checkedAt <= previous.checkedAt) continue;
    const finalUrl = result.finalUrl ? normalizeUrl(result.finalUrl) : normalized;
    const redirectCount = Math.max(0, result.redirectCount || 0);
    const redirectChain = (result.redirectChain || []).slice(0, 12);
    const redirectType = classifyMobileRedirect({
      requestedUrl: normalized,
      finalUrl,
      redirectCount,
      httpCode: result.httpCode,
      blockPageDetected: result.blockPageDetected,
    });
    const rawProbeStatus = redirectType === "NETWORK_BLOCK" ? "DOWN" : result.status;
    const probeStatus = normalizeMobileProbeStatus(rawProbeStatus, result.error);
    const normalizedError = probeStatus === "SLOW" && result.status === "DOWN"
      ? "ตอบกลับช้าหรือหมดเวลาตรวจ (ยังไม่ยืนยันว่าเว็บล่ม)"
      : redirectType === "NETWORK_BLOCK"
        ? "ถูก Redirect ไปหน้าปิดกั้นของเครือข่ายมือถือ"
        : result.error ?? null;
    const next = nextMobileState(previous, probeStatus);

    await prisma.mobileUrlStatus.upsert({
      where: { agentId_urlHash: { agentId, urlHash: result.urlHash } },
      create: {
        agentId,
        urlHash: result.urlHash,
        url: normalized,
        status: next.status,
        httpCode: result.httpCode ?? null,
        responseMs: result.responseMs ?? null,
        error: normalizedError,
        finalUrl,
        redirectCount,
        redirectType,
        redirectChain,
        pageTitle: result.pageTitle ?? null,
        blockPageDetected: redirectType === "NETWORK_BLOCK",
        failureStreak: next.failureStreak,
        recoveryStreak: next.recoveryStreak,
        checkedAt: result.checkedAt,
      },
      update: {
        url: normalized,
        status: next.status,
        httpCode: result.httpCode ?? null,
        responseMs: result.responseMs ?? null,
        error: normalizedError,
        finalUrl,
        redirectCount,
        redirectType,
        redirectChain,
        pageTitle: result.pageTitle ?? null,
        blockPageDetected: redirectType === "NETWORK_BLOCK",
        failureStreak: next.failureStreak,
        recoveryStreak: next.recoveryStreak,
        checkedAt: result.checkedAt,
      },
    });

    if (!previous || previous.status !== next.status) {
      await prisma.mobileCheckLog.create({
        data: {
          agentId,
          urlHash: result.urlHash,
          url: normalized,
          status: next.status,
          httpCode: result.httpCode ?? null,
          responseMs: result.responseMs ?? null,
          error: normalizedError,
          finalUrl,
          redirectCount,
          redirectType,
          redirectChain,
          pageTitle: result.pageTitle ?? null,
          blockPageDetected: redirectType === "NETWORK_BLOCK",
          checkedAt: result.checkedAt,
        },
      });
    }
    // หลังแอดมินแก้ลิงก์ เคสจะอยู่ ADMIN_UPDATED จนซิมยืนยันว่าใช้งานได้
    // URL ใหม่อาจยังไม่มีประวัติ จึงรอผลที่ใช้งานได้ต่อเนื่อง 2 รอบก่อนปิดเคส
    const confirmsAdminUpdate = probeStatus !== "DOWN"
      && pendingAdminUrls.has(normalized)
      && previous !== null
      && previous.status !== "DOWN"
      && next.status !== "DOWN";
    if (!next.opened && !next.recovered && !confirmsAdminUpdate) continue;
    const candidateLinks = await prisma.link.findMany({
      where: { isActive: true },
      include: {
        company: { select: { id: true, name: true } },
        lineGroup: { select: { name: true } },
      },
    });
    const links = candidateLinks.filter((link) => normalizeUrl(link.url) === normalized);

    for (const link of links) {
      if (next.opened) {
        const existing = await prisma.networkIncident.findFirst({
          where: { agentId, linkId: link.id, status: { not: "CLOSED" } },
        });
        if (existing) continue;
        const incident = await prisma.networkIncident.create({
          data: {
            agentId,
            linkId: link.id,
            detectedAt: result.checkedAt,
            httpCode: result.httpCode ?? null,
            responseMs: result.responseMs ?? null,
            error: normalizedError,
            finalUrl,
            redirectCount,
            redirectType,
            redirectChain,
            pageTitle: result.pageTitle ?? null,
            blockPageDetected: redirectType === "NETWORK_BLOCK",
          },
        });
        await notifyCompany(routes, link.company.id, networkDownMessage({
          incidentId: incident.id,
          carrier: agent.carrier,
          agentName: agent.name,
          company: link.company.name,
          room: link.lineGroup?.name,
          name: link.name,
          url: link.url,
          httpCode: result.httpCode,
          error: normalizedError,
          finalUrl,
          redirectType,
          redirectCount,
          detectedAt: result.checkedAt,
          appBaseUrl: APP_BASE_URL,
        }));
        opened++;
      } else {
        const incidents = await prisma.networkIncident.findMany({
          where: {
            agentId,
            linkId: link.id,
            status: next.recovered ? { not: "CLOSED" } : "ADMIN_UPDATED",
          },
        });
        for (const incident of incidents) {
          await prisma.networkIncident.update({
            where: { id: incident.id },
            data: { status: "CLOSED", resolvedAt: result.checkedAt },
          });
          const downMinutes = Math.max(0, Math.round((result.checkedAt.getTime() - incident.detectedAt.getTime()) / 60_000));
          // เคส timeout เดิมเป็น false positive: ปิดสถานะ แต่ไม่ยิงข้อความ
          // "กลับมาแล้ว" หลายสิบรายการไปรบกวนกลุ่ม Telegram
          if (!isInconclusiveMobileTimeout(incident.error)) {
            await notifyCompany(routes, link.company.id, networkRecoveredMessage({
              incidentId: incident.id,
              carrier: agent.carrier,
              agentName: agent.name,
              company: link.company.name,
              room: link.lineGroup?.name,
              name: link.name,
              url: link.url,
              downMinutes,
              slow: probeStatus === "SLOW",
              responseMs: result.responseMs,
              appBaseUrl: APP_BASE_URL,
            }));
          }
          recovered++;
        }
      }
    }
    if (confirmsAdminUpdate) pendingAdminUrls.delete(normalized);
  }
  return { accepted: results.length, opened, recovered };
}
