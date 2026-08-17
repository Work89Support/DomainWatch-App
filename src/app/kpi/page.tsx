import { requireUser } from "@/lib/auth";
import { getUserKpi } from "@/lib/userkpi";
import { PageHeader, StatCard, IncidentStatusBadge } from "@/components/ui";
import { fmtDateTime, fmtMinutes } from "@/lib/format";
import KpiTrend from "@/components/KpiTrend";
import { canViewKpi, ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function KpiPage() {
  const me = await requireUser();
  if (!canViewKpi(me.role)) redirect("/");
  const d = await getUserKpi();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="KPI รายคน"
        subtitle="ตั้งแต่ระบบตรวจพบปัญหา → ใครเป็นคนแก้ → ใช้เวลาเท่าไหร่"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="เหตุการณ์ทั้งหมด" value={d.totals.incidents} tone="brand" />
        <StatCard label="ปิดเคสแล้ว" value={d.totals.resolved} tone="green" />
        <StatCard label="KPI แอดมินเฉลี่ย" value={fmtMinutes(d.totals.avgAdmin)} hint="ตรวจพบ → อัพเดตลิงก์" tone="brand" />
        <StatCard label="KPI ไอทีเฉลี่ย" value={fmtMinutes(d.totals.avgIt)} hint="ตรวจพบ → ชี้แจง/สำรอง" tone="amber" />
      </div>

      {/* กราฟแนวโน้ม */}
      <div className="card p-5 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">แนวโน้ม 8 สัปดาห์</h2>
        <KpiTrend data={d.trend} />
      </div>

      {/* สรุปรายคน (leaderboard) */}
      <div className="card p-5 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">สรุปรายคน (ผลงาน)</h2>
        {d.users.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">ยังไม่มีผู้ใช้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-4 font-medium">อันดับ</th>
                  <th className="py-2 pr-4 font-medium">ชื่อ</th>
                  <th className="py-2 pr-4 font-medium">บทบาท</th>
                  <th className="py-2 pr-4 font-medium">เคสที่จัดการ</th>
                  <th className="py-2 pr-4 font-medium">งานแอดมิน (เฉลี่ย)</th>
                  <th className="py-2 pr-4 font-medium">งานไอที (เฉลี่ย)</th>
                </tr>
              </thead>
              <tbody>
                {d.users.map((u, idx) => (
                  <tr key={u.userId} className="border-b border-slate-50">
                    <td className="py-2.5 pr-4 text-slate-500">{idx + 1}</td>
                    <td className="py-2.5 pr-4 font-medium text-slate-700">{u.name}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`badge ${u.role === "ADMIN" ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700"}`}>
                        {ROLE_LABELS[u.role as AppRole] || u.role}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-semibold text-slate-800">{u.totalHandled}</td>
                    <td className="py-2.5 pr-4 text-slate-600">
                      {u.adminCount > 0 ? `${u.adminCount} เคส · ${fmtMinutes(u.adminAvgMin)}` : "-"}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">
                      {u.itCount > 0 ? `${u.itCount} เคส · ${fmtMinutes(u.itAvgMin)}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ประวัติรายเคส (log) */}
      <div className="card p-5">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">ประวัติรายเคส</h2>
        {d.log.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">ยังไม่มีเหตุการณ์</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-4 font-medium">ลิงก์ / แบรนด์</th>
                  <th className="py-2 pr-4 font-medium">ตรวจพบ</th>
                  <th className="py-2 pr-4 font-medium">แอดมินที่แก้ (เวลา)</th>
                  <th className="py-2 pr-4 font-medium">ไอทีที่แก้ (เวลา)</th>
                  <th className="py-2 pr-4 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {d.log.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="py-2.5 pr-4">
                      <div className="font-medium text-slate-700">{r.linkName}</div>
                      <div className="text-xs text-slate-400">{r.company}</div>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500">{fmtDateTime(r.detectedAt)}</td>
                    <td className="py-2.5 pr-4 text-slate-600">
                      {r.adminName ? <>{r.adminName} <span className="text-slate-400">· {fmtMinutes(r.adminMin)}</span></> : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">
                      {r.itName ? <>{r.itName} <span className="text-slate-400">· {fmtMinutes(r.itMin)}</span></> : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-2.5 pr-4"><IncidentStatusBadge status={r.status} /></td>
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
