import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashSecret, randomSecret } from "@/lib/mobileAgent";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim().slice(0, 160) : "";
  const deviceLabel = typeof body.deviceLabel === "string" ? body.deviceLabel.trim().slice(0, 160) : null;
  const appVersion = typeof body.appVersion === "string" ? body.appVersion.trim().slice(0, 40) : null;
  if (!code || !deviceId) return NextResponse.json({ error: "ข้อมูลผูกเครื่องไม่ครบ" }, { status: 400 });
  const enrollment = await prisma.mobileEnrollment.findUnique({
    where: { codeHash: hashSecret(code) },
    include: { agent: true },
  });
  if (!enrollment || enrollment.usedAt || enrollment.expiresAt <= new Date() || !enrollment.agent.isActive) {
    return NextResponse.json({ error: "QR หมดอายุหรือถูกใช้แล้ว กรุณาสร้าง QR ใหม่" }, { status: 410 });
  }
  const token = randomSecret(40);
  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.mobileEnrollment.updateMany({
        where: { id: enrollment.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new Error("enrollment_claimed");
      await tx.mobileAgent.update({
        where: { id: enrollment.agentId },
        data: {
          tokenHash: hashSecret(token),
          deviceId,
          deviceLabel,
          appVersion,
          enrolledAt: now,
          lastSeenAt: now,
        },
      });
    });
  } catch {
    return NextResponse.json({ error: "QR ถูกใช้งานไปแล้ว กรุณาสร้าง QR ใหม่" }, { status: 409 });
  }
  return NextResponse.json({
    token,
    agent: { id: enrollment.agent.id, name: enrollment.agent.name, carrier: enrollment.agent.carrier },
    intervalSeconds: 300,
  });
}
