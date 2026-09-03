import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { canManageUserRole, canManageUsers, isAppRole } from "@/lib/permissions";
import { getClientIp, isIpAllowed, normalizeAllowedIpRanges } from "@/lib/ipAccess";

export const dynamic = "force-dynamic";

// PATCH /api/users/[id] — รีเซ็ตรหัส / เปิด-ปิดการใช้งาน / เปลี่ยนบทบาท (แอดมินเท่านั้น)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getCurrentUser();
  if (!me || !canManageUsers(me.role))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.password) {
    if (String(body.password).length < 10)
      return NextResponse.json({ error: "รหัสผ่านอย่างน้อย 10 ตัวอักษร" }, { status: 400 });
    data.passwordHash = hashPassword(String(body.password));
    data.mustChangePassword = true;
    data.passwordChangedAt = null;
  }
  if ("isActive" in body) data.isActive = !!body.isActive;
  if ("role" in body) {
    if (!isAppRole(body.role)) return NextResponse.json({ error: "บทบาทไม่ถูกต้อง" }, { status: 400 });
    data.role = body.role;
  }
  if (body.name) data.name = String(body.name).trim();
  if ("email" in body) {
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });
    const duplicate = await prisma.user.findFirst({ where: { email, id: { not: params.id } }, select: { id: true } });
    if (duplicate) return NextResponse.json({ error: "อีเมลนี้ผูกกับบัญชีอื่นแล้ว" }, { status: 400 });
    data.email = email;
  }
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

  // มีเพียงหัวหน้าแอดมินเท่านั้นที่จัดการบัญชีและบทบาทผู้ใช้ได้
  if (!canManageUserRole(me.role, target.role) || (body.role && !canManageUserRole(me.role, body.role))) {
    return NextResponse.json(
      { error: "เฉพาะหัวหน้าแอดมินเท่านั้นที่จัดการบัญชีและบทบาทผู้ใช้ได้" },
      { status: 403 }
    );
  }

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

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: params.id }, data,
      select: { id: true, name: true, username: true, email: true, role: true, isActive: true, allowedIpRanges: true, mustChangePassword: true },
    });
    if (body.password) {
      await tx.passwordResetToken.updateMany({
        where: { userId: params.id, usedAt: null }, data: { usedAt: new Date() },
      });
    }
    if ("role" in body || "companyIds" in body) {
      await tx.userCompany.deleteMany({ where: { userId: params.id } });
    }
    return updated;
  });
  return NextResponse.json(user);
}
