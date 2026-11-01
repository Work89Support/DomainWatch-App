import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canManageCompanies } from "@/lib/permissions";
import { createRichMenuDraft, validateRichMenuDraft, type RichMenuDraftConfig } from "@/lib/line";

export const dynamic = "force-dynamic";

function validateConfig(input: unknown): RichMenuDraftConfig {
  if (!input || typeof input !== "object") throw new Error("ข้อมูล Rich Menu ไม่ครบ");
  const c = input as RichMenuDraftConfig;
  if (c.size?.width !== 2500 || c.size?.height !== 1686) throw new Error("รอบทดลองรองรับภาพ 2500×1686 เท่านั้น");
  if (!c.name?.trim() || c.name.length > 300) throw new Error("ชื่อ Rich Menu ไม่ถูกต้อง");
  if (!c.chatBarText?.trim() || c.chatBarText.length > 14) throw new Error("ข้อความแถบเมนูต้องมี 1–14 ตัวอักษร");
  if (!Array.isArray(c.areas) || c.areas.length !== 6) throw new Error("ต้องกำหนดพื้นที่กดให้ครบ 6 ช่อง");
  for (const [index, area] of c.areas.entries()) {
    const b = area.bounds;
    if (!b || b.x < 0 || b.y < 0 || b.width <= 0 || b.height <= 0 || b.x + b.width > 2500 || b.y + b.height > 1686) {
      throw new Error(`ขอบเขตช่อง ${index + 1} ไม่ถูกต้อง`);
    }
    if (area.action?.type !== "uri" || !area.action.label?.trim()) throw new Error(`ข้อมูลช่อง ${index + 1} ไม่ครบ`);
    let parsed: URL;
    try { parsed = new URL(area.action.uri); } catch { throw new Error(`URL ช่อง ${index + 1} ไม่ถูกต้อง`); }
    if (!/^https?:$/.test(parsed.protocol)) throw new Error(`URL ช่อง ${index + 1} ต้องเป็น http หรือ https`);
  }
  return c;
}

function readPngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset++; continue; }
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (length < 2) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {
        height: (bytes[offset + 5] << 8) + bytes[offset + 6],
        width: (bytes[offset + 7] << 8) + bytes[offset + 8],
      };
    }
    offset += 2 + length;
  }
  return null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManageCompanies(me.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const group = await prisma.lineGroup.findUnique({ where: { id: params.id } });
  if (!group) return NextResponse.json({ error: "ไม่พบห้อง LINE" }, { status: 404 });
  const token = (group.channelAccessToken || "").trim();
  if (!token) return NextResponse.json({ error: "กรุณาบันทึก Channel Access Token ก่อน" }, { status: 400 });

  try {
    const form = await req.formData();
    const action = String(form.get("action") || "validate");
    if (action !== "validate" && action !== "create") throw new Error("คำสั่งไม่ถูกต้อง");
    const config = validateConfig(JSON.parse(String(form.get("config") || "{}")));
    const image = form.get("image");
    if (!(image instanceof File)) throw new Error("กรุณาเลือกไฟล์ภาพ Rich Menu");
    if (image.type !== "image/png" && image.type !== "image/jpeg") throw new Error("รองรับเฉพาะไฟล์ PNG หรือ JPEG");
    if (image.size > 1_000_000) throw new Error("ไฟล์ภาพต้องไม่เกิน 1 MB");
    const bytes = new Uint8Array(await image.arrayBuffer());
    const size = image.type === "image/png" ? readPngSize(bytes) : readJpegSize(bytes);
    if (!size || size.width !== 2500 || size.height !== 1686) throw new Error("ภาพต้องมีขนาด 2500×1686 px");

    if (action === "validate") {
      await validateRichMenuDraft(token, config);
      return NextResponse.json({ ok: true, validated: true, imageBytes: image.size, note: "ข้อมูลผ่านการตรวจของ LINE แล้ว ยังไม่ได้สร้าง Rich Menu" });
    }

    const richMenuId = await createRichMenuDraft(token, config, bytes, image.type);
    await prisma.lineGroup.update({
      where: { id: group.id },
      data: { richMenuDraftId: richMenuId, richMenuDraftName: config.name, richMenuDraftCreatedAt: new Date() },
    });
    return NextResponse.json({ ok: true, created: true, richMenuId, note: "สร้างแบบร่างและอัปโหลดภาพแล้ว แต่ยังไม่ได้ตั้งเป็น Default" });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const message = raw === "TOKEN_INVALID" ? "Channel Access Token ใช้ไม่ได้ กรุณาตรวจ token ก่อน" : raw;
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
