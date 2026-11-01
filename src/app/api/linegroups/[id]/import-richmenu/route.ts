import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canManageCompanies } from "@/lib/permissions";
import { getRichMenuLinks, inspectDefaultRichMenu, type RichMenuLink } from "@/lib/line";

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

  let links: RichMenuLink[];
  let inspection: Awaited<ReturnType<typeof inspectDefaultRichMenu>> | null = null;
  try {
    if (dryRun) {
      inspection = await inspectDefaultRichMenu(token);
      links = inspection.links;
    } else {
      links = await getRichMenuLinks(token);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: msg === "TOKEN_INVALID" ? "token ใช้ไม่ได้" : `ดึง Rich Menu ไม่สำเร็จ (${msg})` },
      { status: 400 }
    );
  }

  // สร้างเฉพาะลิงก์ที่ยังไม่มี (เทียบด้วย URL ในห้องนี้)
  const normalizeUrl = (raw: string) => {
    const value = raw.trim();
    try {
      const parsed = new URL(value);
      parsed.hash = "";
      parsed.hostname = parsed.hostname.toLowerCase();
      if (parsed.pathname === "/") parsed.pathname = "";
      else parsed.pathname = parsed.pathname.replace(/\/$/, "");
      return parsed.toString().replace(/\/$/, "");
    } catch {
      return value.replace(/\/$/, "");
    }
  };
  const activeMaster = g.links.filter((l) => l.isActive);
  const existing = new Set(activeMaster.map((l) => normalizeUrl(l.url)));
  const observed = new Set(links.map((l) => normalizeUrl(l.url)));
  const preview = links.map((l) => ({ ...l, exists: existing.has(normalizeUrl(l.url)) }));
  if (dryRun) {
    const skipped = preview.filter((l) => l.exists).length;
    const expectedRichMenuLinks = activeMaster.filter(
      (l) => (l.category || "").trim() === "ริชเมนู" || (l.note || "").toLowerCase().includes("rich menu")
    );
    const missingInMaster = preview.filter((l) => !l.exists);
    const rawMissingInRichMenu = expectedRichMenuLinks
      .filter((l) => !observed.has(normalizeUrl(l.url)))
      .map((l) => ({ id: l.id, label: l.name, url: l.url }));
    const comparable = inspection?.status === "READY" || inspection?.status === "NO_URI";
    // หาก LINE ไม่เปิดรายละเอียดเมนูให้ API ห้ามแสดง Master เป็น "ไม่พบใน Rich Menu"
    // เพราะยังไม่มีหลักฐานว่าเมนูหายหรือ URL ผิดจริง
    const missingInRichMenu = comparable ? rawMissingInRichMenu : [];
    const comparisonStatus = !comparable
      ? "UNAVAILABLE"
      : missingInMaster.length || missingInRichMenu.length
        ? "MISMATCH"
        : "MATCH";
    return NextResponse.json({
      ok: true,
      dryRun: true,
      links: preview,
      total: preview.length,
      added: preview.length - skipped,
      skipped,
      sourceStatus: inspection?.status || "NO_DEFAULT",
      richMenuId: inspection?.richMenuId || null,
      comparisonStatus,
      matched: skipped,
      missingInMaster,
      missingInRichMenu,
      note: inspection?.note || "ตรวจ Rich Menu ไม่สำเร็จ",
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
