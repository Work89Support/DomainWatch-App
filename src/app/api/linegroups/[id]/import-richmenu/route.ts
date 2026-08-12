import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getRichMenuLinks } from "@/lib/line";

export const dynamic = "force-dynamic";

// POST /api/linegroups/[id]/import-richmenu — ดึงลิงก์จาก Rich Menu ของ OA มาสร้างเป็นลิงก์ในห้องนี้
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await getCurrentUser()))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const g = await prisma.lineGroup.findUnique({
    where: { id: params.id },
    include: { links: true },
  });
  if (!g) return NextResponse.json({ error: "ไม่พบห้อง" }, { status: 404 });
  const token = (g.channelAccessToken || "").trim();
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

  if (links.length === 0)
    return NextResponse.json({ ok: true, added: 0, skipped: 0, note: "ไม่พบลิงก์ใน Rich Menu" });

  // สร้างเฉพาะลิงก์ที่ยังไม่มี (เทียบด้วย URL ในห้องนี้)
  const existing = new Set(g.links.map((l) => l.url.trim()));
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
