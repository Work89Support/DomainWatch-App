import { prisma } from "@/lib/prisma";
import LinksClient from "./LinksClient";
import { requireUser } from "@/lib/auth";
import { canCreateLinks, canDeleteLinks, canEditBackup, canEditLinks, canManageCompanies, canViewLinks } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { normalizeUrl } from "@/lib/mobileAgent";

export const dynamic = "force-dynamic";

export default async function LinksPage({
  searchParams,
}: {
  searchParams: { company?: string; edit?: string };
}) {
  const me = await requireUser();
  if (!canViewLinks(me.role)) redirect("/");
  const requestedCompany = searchParams.company || undefined;
  const currentCompany = me.role === "ADMIN_COMPANY"
    ? (requestedCompany && me.companyIds.includes(requestedCompany) ? requestedCompany : undefined)
    : requestedCompany;
  const focusId = searchParams.edit || undefined;
  const companyScope = me.role === "ADMIN_COMPANY" ? { companyId: { in: me.companyIds } } : {};
  // โหลดลิงก์ทั้งหมด แล้วค่อยกรอง/ฟิลเตอร์ฝั่งหน้าเว็บ (ลื่นกว่า)
  const [links, companies, mobileAgents] = await Promise.all([
    prisma.link.findMany({
      where: companyScope,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        companyId: true,
        lineGroupId: true,
        name: true,
        url: true,
        category: true,
        backupUrl: true,
        note: true,
        isActive: true,
        lastStatus: true,
        lastCheckedAt: true,
        lastResponseMs: true,
        lastHttpCode: true,
        company: { select: { id: true, name: true } },
        lineGroup: { select: { id: true, name: true } },
      },
    }),
    prisma.company.findMany({
      where: me.role === "ADMIN_COMPANY" ? { id: { in: me.companyIds } } : {},
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        lineGroups: {
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true },
        },
      },
    }),
    prisma.mobileAgent.findMany({
      orderBy: [{ carrier: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        carrier: true,
        reportedCarrier: true,
        isActive: true,
        urlStatuses: {
          select: {
            url: true,
            status: true,
            checkedAt: true,
            responseMs: true,
            httpCode: true,
            error: true,
            failureStreak: true,
          },
        },
      },
    }),
  ]);
  const checksByUrl = new Map<string, Array<{
    agentId: string; agentName: string; carrier: string; agentActive: boolean;
    status: string; checkedAt: Date; responseMs: number | null; httpCode: number | null; error: string | null; failureStreak: number;
  }>>();
  for (const agent of mobileAgents) {
    for (const status of agent.urlStatuses) {
      const key = normalizeUrl(status.url);
      const rows = checksByUrl.get(key) || [];
      rows.push({
        agentId: agent.id,
        agentName: agent.name,
        carrier: agent.reportedCarrier || agent.carrier,
        agentActive: agent.isActive,
        status: status.status,
        checkedAt: status.checkedAt,
        responseMs: status.responseMs,
        httpCode: status.httpCode,
        error: status.error,
        failureStreak: status.failureStreak,
      });
      checksByUrl.set(key, rows);
    }
  }
  const linksWithSources = links.map((link) => ({
    ...link,
    mobileChecks: checksByUrl.get(normalizeUrl(link.url)) || [],
  }));
  return (
    <LinksClient
      initialLinks={JSON.parse(JSON.stringify(linksWithSources))}
      companies={JSON.parse(JSON.stringify(companies))}
      mobileAgents={JSON.parse(JSON.stringify(mobileAgents.map(({ urlStatuses: _statuses, ...agent }) => agent)))}
      currentCompany={currentCompany}
      focusId={focusId}
      capabilities={{
        create: canCreateLinks(me.role),
        edit: canEditLinks(me.role),
        delete: canDeleteLinks(me.role),
        editBackup: canEditBackup(me.role),
        manageStructure: canManageCompanies(me.role),
      }}
    />
  );
}
