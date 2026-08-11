"use server";

import { runCheck } from "@/lib/checker";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// เรียกจากปุ่ม "เช็คตอนนี้" ในแอป (ต้องล็อกอิน)
export async function runManualCheck() {
  const me = await getCurrentUser();
  if (!me) throw new Error("unauthorized");
  const summary = await runCheck();
  revalidatePath("/");
  revalidatePath("/links");
  revalidatePath("/incidents");
  return summary;
}
