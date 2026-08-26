import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hashSecret } from "@/lib/mobileAgent";

export const dynamic = "force-dynamic";

export default async function AgentEnrollPage({ searchParams }: { searchParams: { code?: string } }) {
  const code = typeof searchParams.code === "string" ? searchParams.code : "";
  const enrollment = code ? await prisma.mobileEnrollment.findUnique({
    where: { codeHash: hashSecret(code) },
    include: { agent: { select: { name: true, carrier: true, isActive: true } } },
  }) : null;
  const valid = Boolean(enrollment && !enrollment.usedAt && enrollment.expiresAt > new Date() && enrollment.agent.isActive);
  const base = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const appUrl = `domainwatch-agent://enroll?base=${encodeURIComponent(base)}&code=${encodeURIComponent(code)}`;

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      <div className="card w-full max-w-md p-7 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-700 text-3xl font-bold text-white">D</div>
        <h1 className="text-2xl font-semibold text-slate-800">ผูกเครื่องตรวจ DomainWatch</h1>
        {valid && enrollment ? (
          <>
            <p className="mt-2 text-slate-500">เครื่อง: <b>{enrollment.agent.name}</b> · ซิม {enrollment.agent.carrier}</p>
            <div className="my-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              QR นี้ใช้ได้ครั้งเดียว และหมดอายุเวลา {enrollment.expiresAt.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok" })} น.
            </div>
            <a href={appUrl} className="btn-primary w-full py-3 text-base">เปิดแอป DomainWatch Agent</a>
            <p className="mt-4 text-xs leading-5 text-slate-400">หากปุ่มไม่เปิด ให้ติดตั้ง APK ก่อน แล้วสแกน QR เดิมอีกครั้ง</p>
          </>
        ) : (
          <>
            <div className="my-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">QR หมดอายุ ถูกใช้แล้ว หรือเครื่องถูกปิดใช้งาน</div>
            <p className="text-sm text-slate-500">ให้แอดมินสร้าง QR ใหม่จากเมนู “เครื่องตรวจเครือข่าย”</p>
          </>
        )}
        <Link href="/login" className="mt-6 inline-block text-xs text-brand-600 hover:underline">เข้าสู่ระบบผู้ดูแล</Link>
      </div>
    </main>
  );
}
