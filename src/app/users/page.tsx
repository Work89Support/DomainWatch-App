import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import UsersClient from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireUser();
  if (me.role !== "ADMIN") redirect("/");
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, username: true, role: true, isActive: true },
  });
  return <UsersClient initial={JSON.parse(JSON.stringify(users))} />;
}
