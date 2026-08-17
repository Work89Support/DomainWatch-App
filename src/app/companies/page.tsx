import { prisma } from "@/lib/prisma";
import CompaniesClient from "./CompaniesClient";
import { requireUser } from "@/lib/auth";
import { canManageCompanies } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const me = await requireUser();
  if (!canManageCompanies(me.role)) redirect("/");
  const raw = await prisma.company.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      lineGroups: { orderBy: { createdAt: "asc" } },
      links: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          url: true,
          lineGroupId: true,
          lastStatus: true,
          category: true,
          backupUrl: true,
          note: true,
          isActive: true,
        },
      },
    },
  });

  // ไม่ส่ง token/bot token ดิบไปฝั่ง client — ส่งแค่ว่าตั้งไว้หรือยัง + สถานะ
  const companies = raw.map((c) => ({
    id: c.id,
    name: c.name,
    note: c.note,
    isActive: c.isActive,
    tgChatId: c.tgChatId,
    hasTelegram: !!(c.tgBotToken && c.tgChatId),
    links: c.links,
    lineGroups: c.lineGroups.map((g) => ({
      id: g.id,
      name: g.name,
      note: g.note,
      isActive: g.isActive,
      expectedOaName: g.expectedOaName,
      hasToken: !!g.channelAccessToken,
      oaStatus: g.oaStatus,
      oaDisplayName: g.oaDisplayName,
      oaHasPicture: g.oaHasPicture,
      oaLastCheckedAt: g.oaLastCheckedAt,
      oaError: g.oaError,
    })),
  }));

  return <CompaniesClient initial={JSON.parse(JSON.stringify(companies))} />;
}
