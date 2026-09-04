import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashSecret, resolvePublicBaseUrl } from "@/lib/mobileAgent";

export const dynamic = "force-dynamic";

export default async function AgentEnrollPage({ searchParams }: { searchParams: { code?: string } }) {
  const code = typeof searchParams.code === "string" ? searchParams.code : "";
  const enrollment = code ? await prisma.mobileEnrollment.findUnique({
    where: { codeHash: hashSecret(code) },
    include: { agent: { select: { name: true, carrier: true, isActive: true } } },
  }) : null;
  const valid = Boolean(enrollment && !enrollment.usedAt && enrollment.expiresAt > new Date() && enrollment.agent.isActive);
  const requestHeaders = headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto === "http" || forwardedProto === "https"
    ? forwardedProto
    : host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const base = resolvePublicBaseUrl(host ? `${protocol}://${host}` : undefined);
  const appUrl = `domainwatch-agent://enroll?base=${encodeURIComponent(base)}&code=${encodeURIComponent(code)}`;
  const apkUrl = `${base}/downloads/DomainWatch-Agent-v1.0.7.apk`;
  const intentUrl = `intent://enroll?base=${encodeURIComponent(base)}&code=${encodeURIComponent(code)}#Intent;scheme=domainwatch-agent;package=app.domainwatch.agent;S.browser_fallback_url=${encodeURIComponent(apkUrl)};end`;

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
      <div className="card w-full max-w-md p-7 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-700 text-3xl font-bold text-white">D</div>
        <h1 className="text-2xl font-semibold text-slate-800">ติดตั้งและผูกเครื่อง DomainWatch</h1>
        {valid && enrollment ? (
          <>
            <p className="mt-2 text-slate-500">เครื่อง: <b>{enrollment.agent.name}</b> · ซิม {enrollment.agent.carrier}</p>
            <div className="my-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              ลิงก์นี้รวมทั้งการดาวน์โหลดและผูกเครื่อง ใช้ได้ครั้งเดียว และหมดอายุเวลา {enrollment.expiresAt.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok" })} น.
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-left text-sm text-slate-600">
              <div className="font-semibold text-slate-700">ทำตาม 3 ขั้นตอนบนมือถือเครื่องนี้</div>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-xs leading-5">
                <li>กดปุ่มสีน้ำเงินด้านล่าง หากยังไม่มีแอป ระบบจะดาวน์โหลด APK 1.0.7 ให้</li>
                <li>กดยืนยันติดตั้งจาก Android แล้วกลับมาหน้านี้</li>
                <li>กดปุ่มเดิมอีกครั้ง แอปจะรับชื่อเครื่อง เครือข่าย และค่าระบบให้อัตโนมัติ</li>
              </ol>
            </div>
            <a href={intentUrl} className="btn-primary mt-4 w-full py-3 text-base">ติดตั้งหรือเปิดแอป แล้วผูกเครื่อง</a>
            <a href={apkUrl} download className="btn-ghost mt-2 w-full py-3 text-sm">ดาวน์โหลด APK โดยตรง</a>
            <a href={appUrl} className="mt-4 inline-block text-xs text-brand-600 hover:underline">แอปติดตั้งแล้ว แต่ปุ่มด้านบนไม่เปิด? กดผูกเครื่องโดยตรง</a>
            <p className="mt-4 text-xs leading-5 text-slate-400">ไม่ต้องกรอก URL, token, ชื่อเครื่อง หรือเครือข่ายเอง และไม่ต้องติดตั้ง Termux</p>
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
