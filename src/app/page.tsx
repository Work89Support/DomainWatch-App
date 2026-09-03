import { getDashboardData } from "@/lib/kpi";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader, StatCard, IncidentStatusBadge } from "@/components/ui";
import { fmtDateTime, fmtMinutes } from "@/lib/format";
import DashboardCharts from "@/components/DashboardCharts";
import RunCheckButton from "@/components/RunCheckButton";
import CompanyFilter from "@/components/CompanyFilter";
import ItBackupCard from "@/components/ItBackupCard";
import AdminQueueCard from "@/components/AdminQueueCard";
import Link from "next/link";
import { canActAsAdmin, canEditBackup, canRunCheck, canViewKpi } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { company?: string };
}) {
  const me = await requireUser();
  if (me.role === "SITE_STAFF") redirect("/agents");
  const requestedCompany = searchParams.company || undefined;
  const companyId = requestedCompany;
  const allowedCompanyIds = undefined;
  const [d, companies, companyTelegramRoutes] = await Promise.all([
    getDashboardData(companyId, allowedCompanyIds),
    prisma.company.findMany({
      where: allowedCompanyIds ? { id: { in: allowedCompanyIds } } : {},
      orderBy: { createdAt: "asc" }, select: { id: true, name: true },
    }),
    prisma.company.count({
      where: {
        ...(allowedCompanyIds ? { id: { in: allowedCompanyIds } } : {}),
        NOT: [{ tgBotToken: null }, { tgChatId: null }],
      },
    }),
  ]);
  const globalTelegramOn = !!(
    process.env.TELEGRAM_BOT_TOKEN &&
    (process.env.TELEGRAM_ADMIN_CHAT_ID || process.env.TELEGRAM_IT_CHAT_ID)
  );
  const telegramOn = globalTelegramOn || companyTelegramRoutes > 0;
  const notMonitored = d.totalLinks - d.activeLinks; // ลิงก์ LINE ที่ไม่เอาไปเช็คสถานะ

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="แดชบอร์ดภาพรวม"
        subtitle="สถานะ + งานของไอทีและแอดมิน ในหน้าเดียว"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <CompanyFilter companies={companies} value={companyId} />
            {canRunCheck(me.role) && <RunCheckButton />}
          </div>
        }
      />

      {/* สถานะรวม */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="ลิงก์ทั้งหมด" value={d.totalLinks} hint={`เว็บที่เฝ้าดู ${d.activeLinks} · ลิงก์ LINE ${notMonitored}`} tone="slate" />
        <StatCard label="ใช้งานได้" value={d.upCount} hint={`จาก ${d.activeLinks} ที่เฝ้าดู`} tone="green" />
        <StatCard
          label="โหลดช้า / ยืนยันไม่ทัน"
          value={d.slowCount}
          hint="ตอบช้า หรือ monitor ถูกเว็บปลายทางจำกัด"
          tone="amber"
        />
        <StatCard
          label="ใช้ไม่ได้"
          value={d.downCount}
          hint={`${d.downUniqueCount} URLจริง · ${d.openIncidents} เคสเปิด`}
          tone="red"
        />
        <StatCard
          label="มีลิงก์สำรองแล้ว"
          value={`${d.linksWithBackup} / ${d.activeLinks}`}
          hint="มิติไอที (เฉพาะเว็บที่เฝ้าดู)"
          tone={d.linksWithBackup < d.activeLinks ? "amber" : "green"}
        />
      </div>

      {/* มุมมองไอที + แอดมิน */}
      {(canEditBackup(me.role) || canActAsAdmin(me.role)) && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {canEditBackup(me.role) && <ItBackupCard items={d.linksWithoutBackup} withBackup={d.linksWithBackup} total={d.activeLinks} />}
        {canActAsAdmin(me.role) && <AdminQueueCard queue={d.updateQueue} />}
      </div>}

      {/* Telegram */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600 text-lg">📢</div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-800">การแจ้งเตือน Telegram</h2>
            <div className="text-xs text-slate-400">เมื่อลิงก์ล่ม ระบบจะส่งข้อความเข้ากลุ่มแอดมินและไอทีอัตโนมัติ</div>
          </div>
          <span className={`badge ${telegramOn ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {telegramOn ? "เชื่อมต่อแล้ว" : "ยังไม่ได้ตั้งค่า"}
          </span>
        </div>
        {!telegramOn && (
          <div className="text-xs text-slate-500 mt-3 bg-slate-50 rounded-lg p-3">
            ตั้งค่าโดยเพิ่ม <code>TELEGRAM_BOT_TOKEN</code>, <code>TELEGRAM_ADMIN_CHAT_ID</code>, <code>TELEGRAM_IT_CHAT_ID</code> ใน Environment Variables (ดูวิธีใน README)
          </div>
        )}
      </div>

      {/* KPI ย่อ */}
      {canViewKpi(me.role) && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="เหตุการณ์เปิดค้าง" value={d.openIncidents} hint="รวมระบบกลางและเครือข่ายซิม" tone={d.openIncidents > 0 ? "amber" : "green"} />
        <StatCard label="เหตุการณ์ 30 วัน" value={d.incidents30d} tone="brand" />
        <StatCard label="KPI แอดมิน (เฉลี่ย)" value={fmtMinutes(d.avgAdminMin)} tone="brand" />
        <StatCard label="KPI ไอที (เฉลี่ย)" value={fmtMinutes(d.avgItMin)} tone="brand" />
      </div>}

      <DashboardCharts
        incidentsPerDay={d.incidentsPerDay}
        categoryBreakdown={d.categoryBreakdown}
        up={d.upCount}
        slow={d.slowCount}
        down={d.downCount}
        unknown={d.unknownCount}
      />

      {!companyId && d.companyBreakdown.length > 0 && (
        <div className="card p-5 mt-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">สรุปแยกตามบริษัท</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-4 font-medium">บริษัท</th>
                  <th className="py-2 pr-4 font-medium">ลิงก์</th>
                  <th className="py-2 pr-4 font-medium">ใช้ได้</th>
                  <th className="py-2 pr-4 font-medium">โหลดช้า</th>
                  <th className="py-2 pr-4 font-medium">ใช้ไม่ได้</th>
                  <th className="py-2 pr-4 font-medium">เคสเปิดค้าง</th>
                  <th className="py-2 pr-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {d.companyBreakdown.map((c) => (
                  <tr key={c.companyId} className="border-b border-slate-50">
                    <td className="py-2.5 pr-4 font-medium text-slate-700">{c.company}</td>
                    <td className="py-2.5 pr-4 text-slate-500">{c.total}</td>
                    <td className="py-2.5 pr-4 text-emerald-600">{c.up}</td>
                    <td className="py-2.5 pr-4 text-amber-600">{c.slow}</td>
                    <td className="py-2.5 pr-4 text-red-600">{c.down}</td>
                    <td className="py-2.5 pr-4"><span className={c.openIncidents > 0 ? "text-amber-600 font-medium" : "text-slate-400"}>{c.openIncidents}</span></td>
                    <td className="py-2.5 pr-4 text-right"><Link href={`/?company=${c.companyId}`} className="text-xs text-brand-600 hover:underline">ดูเฉพาะบริษัทนี้ →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card p-5 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">เหตุการณ์ล่าสุด</h2>
          {canViewKpi(me.role) && <Link href="/kpi" className="text-sm text-brand-600 hover:underline">ดู KPI รายคน →</Link>}
        </div>
        {d.recentIncidents.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">ยังไม่มีเหตุการณ์ — ทุกลิงก์ปกติ 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-4 font-medium">ลิงก์ / บริษัท</th>
                  <th className="py-2 pr-4 font-medium">สถานะ</th>
                  <th className="py-2 pr-4 font-medium">ตรวจพบ</th>
                  {canViewKpi(me.role) && <th className="py-2 pr-4 font-medium">KPI แอดมิน</th>}
                  {canViewKpi(me.role) && <th className="py-2 pr-4 font-medium">KPI ไอที</th>}
                </tr>
              </thead>
              <tbody>
                {d.recentIncidents.map((i) => (
                  <tr key={i.id} className="border-b border-slate-50">
                    <td className="py-2.5 pr-4">
                      <div className="font-medium text-slate-700">{i.linkName}</div>
                      <div className="text-xs text-slate-400">
                        {i.company} · {i.source === "MOBILE" ? `เครือข่ายซิม${i.agentName ? ` (${i.agentName})` : ""}` : "ระบบกลาง"}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4"><IncidentStatusBadge status={i.status} /></td>
                    <td className="py-2.5 pr-4 text-slate-500">{fmtDateTime(i.detectedAt)}</td>
                    {canViewKpi(me.role) && <td className="py-2.5 pr-4 text-slate-500">{fmtMinutes(i.adminResponseMin)}</td>}
                    {canViewKpi(me.role) && <td className="py-2.5 pr-4 text-slate-500">{fmtMinutes(i.itResponseMin)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
