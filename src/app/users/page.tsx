import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/ipAccess";
import { redirect } from "next/navigation";
import UsersClient from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireUser();
  if (me.role !== "ADMIN") redirect("/");
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, username: true, role: true, isActive: true,
      allowedIpRanges: true, lastLoginIp: true, lastLoginAt: true,
      companyAssignments: { select: { companyId: true } },
    },
  });
  const companies = await prisma.company.findMany({
    where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true },
  });
  return <UsersClient
    initial={JSON.parse(JSON.stringify(users))}
    companies={companies}
    currentUserId={me.id}
    currentIp={getClientIp(headers())}
  />;
}
