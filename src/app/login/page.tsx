import LoginClient from "./LoginClient";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // ถ้ามี session ที่ยังใช้ได้ แปลว่าเข้าระบบอยู่แล้ว
  // ไม่ render หน้า Login ภายใน Layout ที่มีเมนู เพื่อป้องกันเมนูโผล่ก่อนฟอร์ม
  const currentUser = await getSessionUser();
  if (currentUser?.mustChangePassword) redirect("/change-password");
  if (currentUser) redirect(currentUser.role === "SITE_STAFF" ? "/agents" : "/");

  // ถ้ายังไม่มีผู้ใช้เลย ให้ไปหน้าตั้งค่าครั้งแรก
  const count = await prisma.user.count();
  if (count === 0) redirect("/setup");
  return <LoginClient />;
}
