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
  const base = (process.env.APP_BASE_URL || requestBaseUrl).replace(/\/$/, "");
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
  checkedAt: Date;
};

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

export async function storeMobileResults(agentId: string, results: MobileResultInput[]) {
  const agent = await prisma.mobileAgent.findUniqueOrThrow({ where: { id: agentId } });
  const routes = await loadRoutes();
  let opened = 0;
  let recovered = 0;

  for (const result of results) {
    const normalized = normalizeUrl(result.url);
    if (mobileUrlHash(normalized) !== result.urlHash) continue;
    const previous = await prisma.mobileUrlStatus.findUnique({
      where: { agentId_urlHash: { agentId, urlHash: result.urlHash } },
    });
    if (previous && result.checkedAt <= previous.checkedAt) continue;
    const next = nextMobileState(previous, result.status);

    await prisma.mobileUrlStatus.upsert({
      where: { agentId_urlHash: { agentId, urlHash: result.urlHash } },
      create: {
        agentId,
        urlHash: result.urlHash,
        url: normalized,
        status: next.status,
        httpCode: result.httpCode ?? null,
        responseMs: result.responseMs ?? null,
        error: result.error ?? null,
        failureStreak: next.failureStreak,
        recoveryStreak: next.recoveryStreak,
        checkedAt: result.checkedAt,
      },
      update: {
        url: normalized,
        status: next.status,
        httpCode: result.httpCode ?? null,
        responseMs: result.responseMs ?? null,
        error: result.error ?? null,
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
          error: result.error ?? null,
          checkedAt: result.checkedAt,
        },
      });
    }

    if (!next.opened && !next.recovered) continue;
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
            error: result.error ?? null,
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
          error: result.error,
          detectedAt: result.checkedAt,
          appBaseUrl: APP_BASE_URL,
        }));
        opened++;
      } else {
        const incidents = await prisma.networkIncident.findMany({
          where: { agentId, linkId: link.id, status: { not: "CLOSED" } },
        });
        for (const incident of incidents) {
          await prisma.networkIncident.update({
            where: { id: incident.id },
            data: { status: "CLOSED", resolvedAt: result.checkedAt },
          });
          const downMinutes = Math.max(0, Math.round((result.checkedAt.getTime() - incident.detectedAt.getTime()) / 60_000));
          await notifyCompany(routes, link.company.id, networkRecoveredMessage({
            incidentId: incident.id,
            carrier: agent.carrier,
            agentName: agent.name,
            company: link.company.name,
            room: link.lineGroup?.name,
            name: link.name,
            url: link.url,
            downMinutes,
            slow: result.status === "SLOW",
            responseMs: result.responseMs,
            appBaseUrl: APP_BASE_URL,
          }));
          recovered++;
        }
      }
    }
  }
  return { accepted: results.length, opened, recovered };
}
