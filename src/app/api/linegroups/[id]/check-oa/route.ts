import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canManageCompanies } from "@/lib/permissions";
import { checkOa, enforceOaIdentityBaseline } from "@/lib/line";

export const dynamic = "force-dynamic";

// POST /api/linegroups/[id]/check-oa — ตรวจ OA ห้องนี้ทันที
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManageCompanies(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const g = await prisma.lineGroup.findUnique({ where: { id: params.id } });
  if (!g) return NextResponse.json({ error: "ไม่พบห้อง" }, { status: 404 });
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const confirmIdentity = req.nextUrl.searchParams.get("confirmIdentity") === "1";
  const body = await req.json().catch(() => ({}));
  const token = String(dryRun ? body.channelAccessToken || g.channelAccessToken || "" : g.channelAccessToken || "").trim();
  if (!token)
    return NextResponse.json({ error: "ยังไม่ได้ใส่ Channel Access Token" }, { status: 400 });

  const expectedName = dryRun && "expectedOaName" in body ? String(body.expectedOaName || "").trim() : g.expectedOaName;
  const checked = await checkOa(token, expectedName);
  const res = confirmIdentity ? checked : enforceOaIdentityBaseline(checked, g.oaUserId);
  if (dryRun) return NextResponse.json({ ok: true, dryRun: true, result: res });

  if (confirmIdentity && (!checked.userId || checked.status === "TOKEN_INVALID" || checked.status === "ERROR")) {
    return NextResponse.json(
      { error: "ยังยืนยันตัวตนใหม่ไม่ได้ กรุณาตรวจ token ให้สำเร็จก่อน" },
      { status: 400 }
    );
  }

  const hasIdentity = !!checked.userId && res.status !== "IDENTITY_MISMATCH";
  const updated = await prisma.lineGroup.update({
    where: { id: g.id },
    data: {
      oaStatus: res.status,
      oaDisplayName: res.displayName,
      ...(hasIdentity
        ? {
            oaUserId: checked.userId,
            oaBasicId: checked.basicId,
            oaPremiumId: checked.premiumId,
            oaChatMode: checked.chatMode,
          }
        : {}),
      oaHasPicture: res.hasPicture,
      oaError: res.error,
      oaLastCheckedAt: new Date(),
    },
  });
  return NextResponse.json({ ok: true, confirmedIdentity: confirmIdentity, result: res, group: updated });
}
