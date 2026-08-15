import { prisma } from "@/lib/prisma";
import IncidentsClient from "./IncidentsClient";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: { company?: string; incident?: string };
}) {
  await requireUser();
  const companyId = searchParams.company || undefined;
  const [incidents, companies] = await Promise.all([
    prisma.incident.findMany({
      where: companyId ? { link: { companyId } } : {},
      orderBy: { detectedAt: "desc" },
      take: 200,
      include: { link: { include: { company: true } } },
    }),
    prisma.company.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <IncidentsClient
      initial={JSON.parse(JSON.stringify(incidents))}
      companies={companies}
      currentCompany={companyId}
      initialIncidentId={searchParams.incident}
    />
  );
}
