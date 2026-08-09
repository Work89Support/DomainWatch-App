import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ใส่ข้อมูลตัวอย่างผ่านเว็บ (ใช้ตอน deploy เสร็จใหม่ ๆ)
// เรียก: /api/seed?token=<CRON_SECRET>  (ถ้าไม่ตั้ง CRON_SECRET เรียกได้เลย)
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (token !== secret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const existing = await prisma.company.count();
  if (existing > 0) {
    return NextResponse.json({
      ok: true,
      message: `มีบริษัทอยู่แล้ว ${existing} รายการ — ข้ามการใส่ข้อมูลตัวอย่าง`,
    });
  }

  const companyA = await prisma.company.create({
    data: { name: "บริษัท A", note: "ตัวอย่างบริษัทแรก" },
  });
  const aAdmin = await prisma.lineGroup.create({
    data: { companyId: companyA.id, name: "ห้องแอดมิน A" },
  });
  const aMarket = await prisma.lineGroup.create({
    data: { companyId: companyA.id, name: "ห้องการตลาด A" },
  });
  const companyB = await prisma.company.create({
    data: { name: "บริษัท B", note: "ตัวอย่างบริษัทที่สอง" },
  });
  const bAdmin = await prisma.lineGroup.create({
    data: { companyId: companyB.id, name: "ห้องแอดมิน B" },
  });

  await prisma.link.createMany({
    data: [
      { companyId: companyA.id, lineGroupId: aAdmin.id, name: "หน้าเข้าเล่นหลัก", url: "https://example.com", category: "ทางเข้า", backupUrl: "https://example.org", note: "ลิงก์หลักที่ลูกค้าใช้บ่อยสุด" },
      { companyId: companyA.id, lineGroupId: aMarket.id, name: "หน้าโปรโมชันเดือนนี้", url: "https://example.com/promo", category: "โปรโมชัน" },
      { companyId: companyA.id, lineGroupId: aAdmin.id, name: "หน้าสมัครสมาชิก", url: "https://httpstat.us/503", category: "สมัคร", note: "ตัวอย่างลิงก์ที่จะขึ้นสถานะล่ม (503) เพื่อทดสอบระบบ" },
      { companyId: companyB.id, lineGroupId: bAdmin.id, name: "หน้าคู่มือการใช้งาน", url: "https://example.net", category: "ทั่วไป" },
      { companyId: companyB.id, lineGroupId: bAdmin.id, name: "หน้าทางเข้าสำรอง", url: "https://httpstat.us/200", category: "ทางเข้า" },
    ],
  });

  return NextResponse.json({
    ok: true,
    message: "ใส่ข้อมูลตัวอย่างสำเร็จ — บริษัท 2, ห้อง LINE 3, ลิงก์ 5",
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
