import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import AdminPasswordResetClient from "./AdminPasswordResetClient";

export const dynamic = "force-dynamic";

export default async function AdminPasswordResetPage({ searchParams }: { searchParams: { token?: string } }) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return <AdminPasswordResetClient token={searchParams.token || ""} />;
}
