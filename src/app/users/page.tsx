import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { headers } from "next/headers";
import { getClientIp } from "@/lib/ipAccess";
import { redirect } from "next/navigation";
import { canManageUsers } from "@/lib/permissions";
import UsersClient from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireUser();
  if (!canManageUsers(me.role)) redirect("/");
  const users = await prisma.user.findMany({
    where: me.role === "ADMIN" ? {} : { role: { not: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, username: true, email: true, role: true, isActive: true,
      mustChangePassword: true,
      allowedIpRanges: true, lastLoginIp: true, lastLoginAt: true,
      companyAssignments: { select: { companyId: true } },
    },
  });
  return <UsersClient
    initial={JSON.parse(JSON.stringify(users))}
    currentUserId={me.id}
    currentUserRole={me.role}
    currentIp={getClientIp(headers())}
  />;
}
