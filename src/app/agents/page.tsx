import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManageMobileAgents, canViewMobileAgents } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import AgentsClient from "./AgentsClient";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const user = await requireUser();
  if (!canViewMobileAgents(user.role)) redirect("/");
  const agents = await prisma.mobileAgent.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      carrier: true,
      isActive: true,
      deviceLabel: true,
      appVersion: true,
      networkType: true,
      reportedCarrier: true,
      enrolledAt: true,
      lastSeenAt: true,
      createdAt: true,
      urlStatuses: { orderBy: { checkedAt: "desc" }, take: 8 },
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
  });
  return <AgentsClient
    initial={JSON.parse(JSON.stringify(agents))}
    canManage={canManageMobileAgents(user.role)}
  />;
}
