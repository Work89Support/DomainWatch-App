import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { isAppRole } from "@/lib/permissions";
import { getClientIp, isIpAllowed, normalizeAllowedIpRanges } from "@/lib/ipAccess";

export const dynamic = "force-dynamic";

// PATCH /api/users/[id] — รีเซ็ตรหัส / เปิด-ปิดการใช้งาน / เปลี่ยนบทบาท (แอดมินเท่านั้น)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getCurrentUser();
  if (!me || me.role !== "ADMIN")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.password) {
    if (String(body.password).length < 6)
      return NextResponse.json({ error: "รหัสผ่านอย่างน้อย 6 ตัวอักษร" }, { status: 400 });
    data.passwordHash = hashPassword(String(body.password));
  }
  if ("isActive" in body) data.isActive = !!body.isActive;
  if ("role" in body) {
    if (!isAppRole(body.role)) return NextResponse.json({ error: "บทบาทไม่ถูกต้อง" }, { status: 400 });
    data.role = body.role;
  }
  if (body.name) data.name = String(body.name).trim();
  if ("allowedIpRanges" in body) {
    try { data.allowedIpRanges = normalizeAllowedIpRanges(body.allowedIpRanges); }
    catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "รูปแบบ IP ไม่ถูกต้อง" }, { status: 400 });
    }
  }

  // ต้องมีผู้ใช้จริง
  const target = await prisma.user.findUnique({
    where: { id: params.id },
    include: { companyAssignments: { select: { companyId: true } } },
  });
  if (!target) return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });

  const willDeactivate = "isActive" in body && !body.isActive;
  const willDemote = body.role && body.role !== "ADMIN";

  // กันล็อกตัวเองออก: แอดมินห้ามปิดการใช้งาน/ลดสิทธิ์บัญชีตัวเอง
  if (me.id === target.id && (willDeactivate || willDemote)) {
    return NextResponse.json(
      { error: "ห้ามปิดการใช้งานหรือลดสิทธิ์บัญชีของตัวเอง" },
      { status: 400 }
    );
  }
  if (me.id === target.id && "allowedIpRanges" in body && !isIpAllowed(getClientIp(req.headers), data.allowedIpRanges as string | null)) {
    return NextResponse.json(
      { error: "บันทึกไม่ได้: IP ปัจจุบันของคุณต้องอยู่ในรายการ เพื่อป้องกันการล็อกตัวเองออกจากระบบ" },
      { status: 400 }
    );
  }

  // กันเหลือแอดมินที่ใช้งานได้ 0 คน
  if (target.role === "ADMIN" && target.isActive && (willDeactivate || willDemote)) {
    const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    if (activeAdmins <= 1) {
      return NextResponse.json(
        { error: "ต้องมีผู้ดูแลระบบ (ADMIN) ที่ใช้งานได้อย่างน้อย 1 คน" },
        { status: 400 }
      );
    }
  }

  const nextRole = (body.role || target.role) as string;
  const assignedCompanyIds: string[] = Array.isArray(body.companyIds)
    ? [...new Set<string>(body.companyIds.map((value: unknown) => String(value)))]
    : target.companyAssignments.map((item) => item.companyId);
  if (nextRole === "ADMIN_COMPANY" && assignedCompanyIds.length === 0)
    return NextResponse.json({ error: "แอดมินบริษัทต้องถูกมอบหมายอย่างน้อย 1 บริษัท" }, { status: 400 });
  if (nextRole === "ADMIN_COMPANY") {
    const validCompanies = await prisma.company.count({ where: { id: { in: assignedCompanyIds } } });
    if (validCompanies !== assignedCompanyIds.length)
      return NextResponse.json({ error: "พบบริษัทที่เลือกไม่ถูกต้อง" }, { status: 400 });
  }
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: params.id }, data,
      select: { id: true, name: true, username: true, role: true, isActive: true, allowedIpRanges: true },
    });
    if ("role" in body || "companyIds" in body) {
      await tx.userCompany.deleteMany({ where: { userId: params.id } });
      if (nextRole === "ADMIN_COMPANY") {
        await tx.userCompany.createMany({
          data: assignedCompanyIds.map((companyId) => ({ userId: params.id, companyId })),
        });
      }
    }
    return updated;
  });
  return NextResponse.json(user);
}
