import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ---- ตัวช่วยแปลง CSV (รองรับ field ที่มีเครื่องหมายคำพูด "") ----
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* ข้าม */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const HEADER_ALIASES: Record<string, string> = {
  name: "name", "ชื่อ": "name", "ชื่อลิงก์": "name",
  url: "url", link: "url", "ลิงก์": "url", "ลิ้งค์": "url",
  category: "category", "หมวด": "category", "หมวดหมู่": "category",
  linegroup: "lineGroup", "line": "lineGroup", "ห้อง": "lineGroup", "ห้องline": "lineGroup", "ที่มา": "lineGroup",
  backupurl: "backupUrl", "ลิงก์สำรอง": "backupUrl", "สำรอง": "backupUrl",
  note: "note", "หมายเหตุ": "note",
};

// ลิงก์ LINE เพิ่มเพื่อน (เช็คสถานะไม่ได้ มักโดน 403) -> เปิดใช้งานปิดไว้
function isLineLink(url: string): boolean {
  return /(line\.me\/ti|lin\.ee)/i.test(url);
}

// POST /api/links/sync  { companyName, csv }
// นำเข้าแบบ "รวม" (idempotent): หา-หรือ-สร้าง บริษัท/ห้อง ตามชื่อ, ข้ามลิงก์ที่มีอยู่แล้ว
// (คีย์ = ห้อง + url), ตั้ง isActive=false ให้ลิงก์ LINE. เรียกซ้ำได้ปลอดภัย
export async function POST(req: NextRequest) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const companyName: string = String(body.companyName || "").trim();
  const csvText: string = String(body.csv || "");
  if (!companyName) return NextResponse.json({ error: "ต้องระบุ companyName" }, { status: 400 });
  if (!csvText.trim()) return NextResponse.json({ error: "ไม่พบข้อมูล CSV" }, { status: 400 });

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV ต้องมีหัวตาราง + ข้อมูลอย่างน้อย 1 แถว" }, { status: 400 });
  }
  const header = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()] || h.trim());
  const nameIdx = header.indexOf("name");
  const urlIdx = header.indexOf("url");
  if (nameIdx === -1 || urlIdx === -1) {
    return NextResponse.json({ error: "ต้องมีคอลัมน์ name และ url" }, { status: 400 });
  }
  const get = (r: string[], key: string) => {
    const idx = header.indexOf(key);
    return idx >= 0 ? (r[idx] || "").trim() || null : null;
  };

  let company = await prisma.company.findFirst({ where: { name: companyName } });
  let createdCompany = false;
  if (!company) {
    company = await prisma.company.create({ data: { name: companyName } });
    createdCompany = true;
  }
  const companyId = company.id;

  const groups = await prisma.lineGroup.findMany({ where: { companyId } });
  const groupByName = new Map<string, string>();
  for (const g of groups) groupByName.set(g.name.toLowerCase(), g.id);

  const existing = await prisma.link.findMany({
    where: { companyId },
    select: { lineGroupId: true, url: true },
  });
  const existingKeys = new Set(existing.map((l) => `${l.lineGroupId || ""}|${l.url}`));

  let created = 0, skipped = 0, createdRooms = 0;
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = (r[nameIdx] || "").trim();
    const url = (r[urlIdx] || "").trim();
    if (!name || !url) { errors.push(`แถว ${i + 1}: ขาดชื่อหรือ url`); continue; }

    let lineGroupId: string | null = null;
    const groupName = get(r, "lineGroup");
    if (groupName) {
      const key = groupName.toLowerCase();
      if (!groupByName.has(key)) {
        const g = await prisma.lineGroup.create({ data: { companyId, name: groupName } });
        groupByName.set(key, g.id);
        createdRooms++;
      }
      lineGroupId = groupByName.get(key) || null;
    }

    const dedupKey = `${lineGroupId || ""}|${url}`;
    if (existingKeys.has(dedupKey)) { skipped++; continue; }

    await prisma.link.create({
      data: {
        companyId,
        lineGroupId,
        name,
        url,
        category: get(r, "category") || "ทั่วไป",
        backupUrl: get(r, "backupUrl"),
        note: get(r, "note"),
        isActive: !isLineLink(url),
      },
    });
    existingKeys.add(dedupKey);
    created++;
  }

  return NextResponse.json({
    company: companyName,
    createdCompany,
    createdRooms,
    created,
    skipped,
    errors,
  });
}
