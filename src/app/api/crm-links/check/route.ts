import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canRunCheck } from "@/lib/permissions";
import { runCrmChecks } from "@/lib/checker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canRunCheck(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const checked = await runCrmChecks();
  return NextResponse.json({ ok: true, checked, checkedAt: new Date().toISOString() });
}
