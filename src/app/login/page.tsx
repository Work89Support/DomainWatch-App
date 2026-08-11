import LoginClient from "./LoginClient";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // ถ้ายังไม่มีผู้ใช้เลย ให้ไปหน้าตั้งค่าครั้งแรก
  const count = await prisma.user.count();
  if (count === 0) redirect("/setup");
  return <LoginClient />;
}
