import { prisma } from "@/lib/prisma";
import LinksClient from "./LinksClient";
import { requireUser } from "@/lib/auth";
import { canCreateLinks, canDeleteLinks, canEditBackup, canEditLinks, canManageCompanies, canViewLinks } from "@/lib/permissions";
import { redirect } from "next/navigation";

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
  const [links, companies] = await Promise.all([
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
  ]);
  return (
    <LinksClient
      initialLinks={JSON.parse(JSON.stringify(links))}
      companies={JSON.parse(JSON.stringify(companies))}
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
