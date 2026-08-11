import { prisma } from "@/lib/prisma";
import LinksClient from "./LinksClient";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LinksPage({
  searchParams,
}: {
  searchParams: { company?: string };
}) {
  await requireUser();
  const currentCompany = searchParams.company || undefined;
  // โหลดลิงก์ทั้งหมด แล้วค่อยกรอง/ฟิลเตอร์ฝั่งหน้าเว็บ (ลื่นกว่า)
  const [links, companies] = await Promise.all([
    prisma.link.findMany({
      orderBy: { createdAt: "desc" },
      include: { company: true, lineGroup: true },
    }),
    prisma.company.findMany({
      orderBy: { createdAt: "asc" },
      include: { lineGroups: { orderBy: { createdAt: "asc" } } },
    }),
  ]);
  return (
    <LinksClient
      initialLinks={JSON.parse(JSON.stringify(links))}
      companies={JSON.parse(JSON.stringify(companies))}
      currentCompany={currentCompany}
    />
  );
}
