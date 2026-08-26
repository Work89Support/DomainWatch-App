import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";
import { canManageMobileAgents } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createEnrollment } from "@/lib/mobileAgent";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManageMobileAgents(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const agents = await prisma.mobileAgent.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ agents });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManageMobileAgents(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const carrier = typeof body.carrier === "string" ? body.carrier.trim().toUpperCase() : "TRUE";
  if (!name) return NextResponse.json({ error: "กรุณาระบุชื่อเครื่อง" }, { status: 400 });
  if (!["TRUE", "AIS", "DTAC", "3BB", "NT"].includes(carrier)) {
    return NextResponse.json({ error: "เครือข่ายไม่ถูกต้อง" }, { status: 400 });
  }
  const agent = await prisma.mobileAgent.create({ data: { name, carrier } });
  const enrollment = await createEnrollment(agent.id, new URL(req.url).origin);
  const qrDataUrl = await QRCode.toDataURL(enrollment.enrollmentUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 560,
    color: { dark: "#173FAD", light: "#FFFFFFFF" },
  });
  return NextResponse.json({ agent, enrollment: { ...enrollment, qrDataUrl } }, { status: 201 });
}
