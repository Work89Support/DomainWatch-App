import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CaseSource = "SYSTEM" | "MOBILE";
export function caseActivity(source: CaseSource, caseId: string,
  link: { companyId: string; name: string; url: string; company?: { name: string } },
  action: string, note: string, actor?: { id: string; name: string }, details?: Prisma.InputJsonValue) {
  return prisma.caseActivity.create({ data: {
    source, caseId, companyId: link.companyId, companyName: link.company?.name || link.companyId,
    linkName: link.name, url: link.url, action, note,
    actorId: actor?.id, actorName: actor?.name || "ระบบตรวจอัตโนมัติ", details,
  } });
}

export function isCaseClosed(status: string) { return status === "CLOSED" || status === "PAUSED"; }

export function elapsedMinutes(start: Date, end: Date | null) {
  return end && end >= start ? (end.getTime() - start.getTime()) / 60000 : null;
}
