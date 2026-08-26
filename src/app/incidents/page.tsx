import { prisma } from "@/lib/prisma";
import IncidentsClient from "./IncidentsClient";
import { requireUser } from "@/lib/auth";
import { canActAsAdmin, canActAsIt, canViewIncidents, canViewKpi } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: { company?: string; incident?: string };
}) {
  const me = await requireUser();
  if (!canViewIncidents(me.role)) redirect("/");
  const requestedCompany = searchParams.company || undefined;
  const companyId = me.role === "ADMIN_COMPANY"
    ? (requestedCompany && me.companyIds.includes(requestedCompany) ? requestedCompany : undefined)
    : requestedCompany;
  const companyWhere = me.role === "ADMIN_COMPANY"
    ? (companyId ? { companyId } : { companyId: { in: me.companyIds } })
    : (companyId ? { companyId } : {});
  const include = { link: { include: { company: true, lineGroup: true } } } as const;
  const [incidents, mobileIncidents, requestedIncident, requestedMobileIncident, companies] = await Promise.all([
    prisma.incident.findMany({
      where: { link: companyWhere },
      orderBy: { detectedAt: "desc" },
      take: 200,
      include,
    }),
    prisma.networkIncident.findMany({
      where: { link: companyWhere },
      orderBy: { detectedAt: "desc" },
      take: 200,
      include: {
        agent: { select: { id: true, name: true, carrier: true, reportedCarrier: true, deviceLabel: true, appVersion: true } },
        link: { include: { company: true, lineGroup: true } },
      },
    }),
    searchParams.incident
      ? prisma.incident.findFirst({
          where: { id: searchParams.incident, link: companyWhere },
          include,
        })
      : Promise.resolve(null),
    searchParams.incident
      ? prisma.networkIncident.findFirst({
          where: { id: searchParams.incident, link: companyWhere },
          include: {
            agent: { select: { id: true, name: true, carrier: true, reportedCarrier: true, deviceLabel: true, appVersion: true } },
            link: { include: { company: true, lineGroup: true } },
          },
        })
      : Promise.resolve(null),
    prisma.company.findMany({
      where: me.role === "ADMIN_COMPANY" ? { id: { in: me.companyIds } } : {},
      orderBy: { createdAt: "asc" }, select: { id: true, name: true },
    }),
  ]);
  const visibleIncidents = requestedIncident && !incidents.some((incident) => incident.id === requestedIncident.id)
    ? [requestedIncident, ...incidents]
    : incidents;
  const visibleMobileIncidents = requestedMobileIncident && !mobileIncidents.some((incident) => incident.id === requestedMobileIncident.id)
    ? [requestedMobileIncident, ...mobileIncidents]
    : mobileIncidents;
  return (
    <IncidentsClient
      initial={JSON.parse(JSON.stringify(visibleIncidents))}
      mobileInitial={JSON.parse(JSON.stringify(visibleMobileIncidents))}
      companies={companies}
      currentCompany={companyId}
      initialIncidentId={searchParams.incident}
      canAdmin={canActAsAdmin(me.role)}
      canIt={canActAsIt(me.role)}
      showKpi={canViewKpi(me.role)}
    />
  );
}
