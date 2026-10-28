import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canManageCompanies } from "@/lib/permissions";
import { getRichMenuLinks } from "@/lib/line";

export const dynamic = "force-dynamic";

// POST /api/linegroups/[id]/import-richmenu — ดึงลิงก์จาก Rich Menu ของ OA มาสร้างเป็นลิงก์ในห้องนี้
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManageCompanies(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const g = await prisma.lineGroup.findUnique({
    where: { id: params.id },
    include: { links: true },
  });
  if (!g) return NextResponse.json({ error: "ไม่พบห้อง" }, { status: 404 });
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const body = await req.json().catch(() => ({}));
  const token = String(dryRun ? body.channelAccessToken || g.channelAccessToken || "" : g.channelAccessToken || "").trim();
  if (!token)
    return NextResponse.json({ error: "ยังไม่ได้ใส่ Channel Access Token" }, { status: 400 });

  let links;
  try {
    links = await getRichMenuLinks(token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: msg === "TOKEN_INVALID" ? "token ใช้ไม่ได้" : `ดึง Rich Menu ไม่สำเร็จ (${msg})` },
      { status: 400 }
    );
  }

  // สร้างเฉพาะลิงก์ที่ยังไม่มี (เทียบด้วย URL ในห้องนี้)
  const existing = new Set(g.links.map((l) => l.url.trim()));
  const preview = links.map((l) => ({ ...l, exists: existing.has(l.url.trim()) }));
  if (dryRun) {
    const skipped = preview.filter((l) => l.exists).length;
    return NextResponse.json({
      ok: true,
      dryRun: true,
      links: preview,
      total: preview.length,
      added: preview.length - skipped,
      skipped,
      note: preview.length ? null : "ไม่พบลิงก์ใน Rich Menu ที่ Messaging API มองเห็น",
    });
  }

  if (links.length === 0)
    return NextResponse.json({ ok: true, added: 0, skipped: 0, note: "ไม่พบลิงก์ใน Rich Menu" });
  let added = 0;
  let skipped = 0;
  for (const l of links) {
    if (existing.has(l.url.trim())) {
      skipped++;
      continue;
    }
    await prisma.link.create({
      data: {
        companyId: g.companyId,
        lineGroupId: g.id,
        name: l.label || "ลิงก์",
        url: l.url,
        category: "ริชเมนู",
        note: "ดึงจาก Rich Menu อัตโนมัติ",
      },
    });
    existing.add(l.url.trim());
    added++;
  }
  return NextResponse.json({ ok: true, added, skipped, total: links.length });
}
