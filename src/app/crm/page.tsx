import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditCrmLinks, canRunCheck, canViewCrmLinks } from "@/lib/permissions";
import CrmLinksClient from "./CrmLinksClient";
import { getCrmTelegramStatus } from "@/lib/crmTelegram";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const me = await requireUser();
  if (!canViewCrmLinks(me.role)) redirect("/");
  const [links, crmTelegram] = await Promise.all([
    prisma.crmLink.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] }),
    getCrmTelegramStatus(),
  ]);
  return (
    <CrmLinksClient
      initialLinks={JSON.parse(JSON.stringify(links))}
      canEdit={canEditCrmLinks(me.role)}
      canCheck={canRunCheck(me.role)}
      crmTelegram={crmTelegram}
    />
  );
}
