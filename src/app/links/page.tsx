import { prisma } from "@/lib/prisma";
import LinksClient from "./LinksClient";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LinksPage({
  searchParams,
}: {
  searchParams: { company?: string; edit?: string };
}) {
  await requireUser();
  const currentCompany = searchParams.company || undefined;
  const focusId = searchParams.edit || undefined;
  // โหลดลิงก์ทั้งหมด แล้วค่อยกรอง/ฟิลเตอร์ฝั่งหน้าเว็บ (ลื่นกว่า)
  const [links, companies] = await Promise.all([
    prisma.link.findMany({
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
        company: { select: { id: true, name: true } },
        lineGroup: { select: { id: true, name: true } },
      },
    }),
    prisma.company.findMany({
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
    />
  );
}
