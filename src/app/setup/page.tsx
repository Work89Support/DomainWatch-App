import { prisma } from "@/lib/prisma";
import SetupClient from "./SetupClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const count = await prisma.user.count();
  if (count > 0) redirect("/login");
  return <SetupClient />;
}
