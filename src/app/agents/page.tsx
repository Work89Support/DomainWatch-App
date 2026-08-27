import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageMobileAgents, canViewMobileAgents } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { normalizeUrl } from "@/lib/mobileAgent";
import AgentsClient from "./AgentsClient";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const user = await requireUser();
  if (!canViewMobileAgents(user.role)) redirect("/");
  const [agents, links] = await Promise.all([
    prisma.mobileAgent.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        carrier: true,
        isActive: true,
        tokenHash: true,
        deviceLabel: true,
        appVersion: true,
        networkType: true,
        reportedCarrier: true,
        enrolledAt: true,
        lastSeenAt: true,
        createdAt: true,
        // ใช้ทุก URL เพื่อให้ตัวเลขบนการ์ดและรายละเอียดตรงกับผลจริง
        urlStatuses: { orderBy: { checkedAt: "desc" } },
        networkIncidents: {
          orderBy: { detectedAt: "desc" },
          take: 30,
          include: {
            link: {
              select: {
                name: true,
                url: true,
                company: { select: { name: true } },
                lineGroup: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.link.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        url: true,
        company: { select: { name: true } },
        lineGroup: { select: { name: true } },
      },
    }),
  ]);
  const safeAgents = agents.map(({ tokenHash, ...agent }) => ({
    ...agent,
    hasEnrollment: Boolean(tokenHash),
  }));
  const linkContexts = links.reduce<Record<string, Array<{ id: string; name: string; company: string; room: string | null }>>>((result, link) => {
    const key = normalizeUrl(link.url);
    (result[key] ||= []).push({
      id: link.id,
      name: link.name,
      company: link.company.name,
      room: link.lineGroup?.name || null,
    });
    return result;
  }, {});
  return <AgentsClient
    initial={JSON.parse(JSON.stringify(safeAgents))}
    linkContexts={linkContexts}
    canManage={canManageMobileAgents(user.role)}
  />;
}
