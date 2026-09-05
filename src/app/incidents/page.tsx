import { prisma } from "@/lib/prisma";
import IncidentsClient from "./IncidentsClient";
import { requireUser } from "@/lib/auth";
import { canActAsAdmin, canActAsIt, canViewIncidents, canViewKpi } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { IncidentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: { company?: string; incident?: string; page?: string };
}) {
  const me = await requireUser();
  if (!canViewIncidents(me.role)) redirect("/");
  const requestedCompany = searchParams.company || undefined;
  const companyId = requestedCompany;
  const companyWhere = companyId ? { companyId } : {};
  const include = { adminUser: { select: { name: true } }, link: { include: { company: true, lineGroup: true } } } as const;
  const pageSize = 100;
  const page = Math.max(1, Number.parseInt(searchParams.page || "1", 10) || 1);
  const openStatusWhere = { status: { notIn: [IncidentStatus.CLOSED, IncidentStatus.PAUSED] } };
  const [incidents, mobileIncidents, requestedIncident, requestedMobileIncident, companies, systemTotal, mobileTotal, systemOpen, mobileOpen, openIncidents, openMobileIncidents] = await Promise.all([
    prisma.incident.findMany({
      where: { link: companyWhere },
      orderBy: { detectedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include,
    }),
    prisma.networkIncident.findMany({
      where: { link: companyWhere },
      orderBy: { detectedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        adminUser: { select: { name: true } },
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
            adminUser: { select: { name: true } },
            agent: { select: { id: true, name: true, carrier: true, reportedCarrier: true, deviceLabel: true, appVersion: true } },
            link: { include: { company: true, lineGroup: true } },
          },
        })
      : Promise.resolve(null),
    prisma.company.findMany({
      where: {},
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        lineGroups: { orderBy: { createdAt: "asc" }, select: { id: true, name: true } },
      },
    }),
    prisma.incident.count({ where: { link: companyWhere } }),
    prisma.networkIncident.count({ where: { link: companyWhere } }),
    prisma.incident.count({ where: { link: companyWhere, ...openStatusWhere } }),
    prisma.networkIncident.count({ where: { link: companyWhere, ...openStatusWhere } }),
    prisma.incident.findMany({ where: { link: companyWhere, ...openStatusWhere }, orderBy: { detectedAt: "desc" }, include }),
    prisma.networkIncident.findMany({
      where: { link: companyWhere, ...openStatusWhere },
      orderBy: { detectedAt: "desc" },
      include: {
        adminUser: { select: { name: true } },
        agent: { select: { id: true, name: true, carrier: true, reportedCarrier: true, deviceLabel: true, appVersion: true } },
        link: { include: { company: true, lineGroup: true } },
      },
    }),
  ]);
  const visibleIncidents = Array.from(new Map([
    ...(requestedIncident ? [requestedIncident] : []),
    ...openIncidents,
    ...incidents,
  ].map((incident) => [incident.id, incident])).values());
  const visibleMobileIncidents = Array.from(new Map([
    ...(requestedMobileIncident ? [requestedMobileIncident] : []),
    ...openMobileIncidents,
    ...mobileIncidents,
  ].map((incident) => [incident.id, incident])).values());
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
      counts={{ systemTotal, mobileTotal, systemOpen, mobileOpen }}
      pagination={{ page, pageSize, pageCount: Math.max(1, Math.ceil(Math.max(systemTotal, mobileTotal) / pageSize)) }}
    />
  );
}
