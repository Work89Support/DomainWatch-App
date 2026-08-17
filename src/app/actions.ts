"use server";

import { runCheck } from "@/lib/checker";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { canRunCheck } from "@/lib/permissions";

// เรียกจากปุ่ม "เช็คตอนนี้" ในแอป (ต้องล็อกอิน)
export async function runManualCheck() {
  const me = await getCurrentUser();
  if (!me) throw new Error("unauthorized");
  if (!canRunCheck(me.role)) throw new Error("forbidden");
  const summary = await runCheck();
  revalidatePath("/");
  revalidatePath("/links");
  revalidatePath("/incidents");
  return summary;
}
