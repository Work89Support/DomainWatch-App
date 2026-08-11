import { prisma } from "@/lib/prisma";
import CompaniesClient from "./CompaniesClient";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  await requireUser();
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      lineGroups: { orderBy: { createdAt: "asc" } },
      _count: { select: { links: true } },
    },
  });
  return <CompaniesClient initial={JSON.parse(JSON.stringify(companies))} />;
}
