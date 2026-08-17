import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canManageCompanies } from "@/lib/permissions";
import { checkOa } from "@/lib/line";

export const dynamic = "force-dynamic";

// POST /api/linegroups/[id]/check-oa — ตรวจ OA ห้องนี้ทันที
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManageCompanies(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const g = await prisma.lineGroup.findUnique({ where: { id: params.id } });
  if (!g) return NextResponse.json({ error: "ไม่พบห้อง" }, { status: 404 });
  const token = (g.channelAccessToken || "").trim();
  if (!token)
    return NextResponse.json({ error: "ยังไม่ได้ใส่ Channel Access Token" }, { status: 400 });

  const res = await checkOa(token, g.expectedOaName);
  const updated = await prisma.lineGroup.update({
    where: { id: g.id },
    data: {
      oaStatus: res.status,
      oaDisplayName: res.displayName,
      oaHasPicture: res.hasPicture,
      oaError: res.error,
      oaLastCheckedAt: new Date(),
    },
  });
  return NextResponse.json({ ok: true, result: res, group: updated });
}
