import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";
import { canManageMobileAgents } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createEnrollment } from "@/lib/mobileAgent";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManageMobileAgents(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const agent = await prisma.mobileAgent.findUnique({ where: { id: params.id } });
  if (!agent) return NextResponse.json({ error: "ไม่พบเครื่องตรวจ" }, { status: 404 });
  if (!agent.isActive) return NextResponse.json({ error: "เครื่องนี้ถูกปิดใช้งาน" }, { status: 409 });
  const enrollment = await createEnrollment(agent.id, new URL(req.url).origin);
  const qrDataUrl = await QRCode.toDataURL(enrollment.enrollmentUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 560,
    color: { dark: "#173FAD", light: "#FFFFFFFF" },
  });
  return NextResponse.json({ agent, enrollment: { ...enrollment, qrDataUrl } });
}
