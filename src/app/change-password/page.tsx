import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ChangePasswordClient from "./ChangePasswordClient";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect(user.role === "SITE_STAFF" ? "/agents" : "/");
  return <ChangePasswordClient name={user.name} />;
}
