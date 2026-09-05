import { requireUser } from "@/lib/auth";
import { getUserKpi } from "@/lib/userkpi";
import { PageHeader, StatCard, IncidentStatusBadge } from "@/components/ui";
import { fmtDateTime, fmtMinutes } from "@/lib/format";
import KpiTrend from "@/components/KpiTrend";
import { canViewKpi, ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import KpiExportActions from "@/components/KpiExportActions";

export const dynamic = "force-dynamic";

export default async function KpiPage({ searchParams }: { searchParams: { userId?: string; from?: string; to?: string; source?: string } }) {
  const me = await requireUser();
  if (!canViewKpi(me.role)) redirect("/");
  const source = searchParams.source === "SYSTEM" || searchParams.source === "MOBILE" ? searchParams.source : "ALL";
  const d = await getUserKpi({
    userId: searchParams.userId || undefined,
    from: searchParams.from || undefined,
    to: searchParams.to || undefined,
    source,
  });
  const selectedUser = d.userOptions.find((u) => u.id === searchParams.userId);
  const fileLabel = [selectedUser?.name || "ทุกคน", searchParams.from || "เริ่มต้น", searchParams.to || "ปัจจุบัน"]
    .join("-")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-");
  const exportRows = d.exportLog.map((row) => ({
    id: row.id,
    source: row.source === "MOBILE" ? "เครือข่ายซิม" : "ระบบกลาง",
    agent: row.agentName || "",
    link: row.linkName,
    company: row.company,
    detectedAt: fmtDateTime(row.detectedAt),
    status: row.status,
    admin: row.adminName || "",
    adminMinutes: row.adminMin,
    it: row.itName || "",
    itMinutes: row.itMin,
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="KPI รายคน"
        subtitle="ตั้งแต่ระบบตรวจพบปัญหา → ใครเป็นคนแก้ → ใช้เวลาเท่าไหร่"
        action={<KpiExportActions rows={exportRows} fileLabel={fileLabel} />}
      />

      <form method="get" className="card p-4 mb-6 print:hidden">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm text-slate-600">
            <span className="mb-1 block text-xs font-medium text-slate-500">ผู้ใช้งาน</span>
            <select name="userId" defaultValue={searchParams.userId || ""} className="input w-full">
              <option value="">ทุกคน</option>
              {d.userOptions.map((user) => <option key={user.id} value={user.id}>{user.name} · {ROLE_LABELS[user.role as AppRole] || user.role}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            <span className="mb-1 block text-xs font-medium text-slate-500">ตั้งแต่วันที่</span>
            <input type="date" name="from" defaultValue={searchParams.from || ""} className="input w-full" />
          </label>
          <label className="text-sm text-slate-600">
            <span className="mb-1 block text-xs font-medium text-slate-500">ถึงวันที่</span>
            <input type="date" name="to" defaultValue={searchParams.to || ""} className="input w-full" />
          </label>
          <label className="text-sm text-slate-600">
            <span className="mb-1 block text-xs font-medium text-slate-500">แหล่งงาน</span>
            <select name="source" defaultValue={source} className="input w-full">
              <option value="ALL">ทั้งหมด</option>
              <option value="SYSTEM">ระบบกลาง</option>
              <option value="MOBILE">เครือข่ายซิม</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="btn-primary flex-1">แสดงผล</button>
            <Link href="/kpi" className="btn-ghost">ล้าง</Link>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-400">
          กำลังแสดง: {selectedUser?.name || "ทุกคน"} · {searchParams.from || "เริ่มต้น"} ถึง {searchParams.to || "ปัจจุบัน"} · {source === "SYSTEM" ? "ระบบกลาง" : source === "MOBILE" ? "เครือข่ายซิม" : "ทุกแหล่งงาน"}
        </div>
      </form>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="เหตุการณ์ทั้งหมด" value={d.totals.incidents} tone="brand" />
        <StatCard label="ปิดเคสแล้ว" value={d.totals.resolved} tone="green" />
        <StatCard label="KPI แอดมินเฉลี่ย" value={fmtMinutes(d.totals.avgAdmin)} hint="ตรวจพบ → อัพเดตลิงก์" tone="brand" />
        <StatCard label="KPI ไอทีเฉลี่ย" value={fmtMinutes(d.totals.avgIt)} hint="ตรวจพบ → ชี้แจง/สำรอง" tone="amber" />
      </div>

      {/* กราฟแนวโน้ม */}
      <div className="card p-5 mb-6">
        <h2 className="font-semibold mb-3">การรับเรื่องและปิดเคสตามช่วงเวลาที่เลือก</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="มีเวลารับเรื่องแอดมิน" value={d.lifecycle.received} tone="brand" />
          <StatCard label="ตรวจพบ → รับเรื่องเฉลี่ย" value={fmtMinutes(d.lifecycle.avgAck)} tone="brand" />
          <StatCard label="ตรวจพบ → ปิดเคสเฉลี่ย" value={fmtMinutes(d.lifecycle.avgResolution)} tone="green" />
          <StatCard label="ไม่มีเวลารับเรื่อง" value={d.lifecycle.missingAck} tone="amber" />
        </div>
        <p className="mt-3 text-xs text-slate-500">ช่วงเวลายึดวันตรวจพบ · พักการเฝ้าดู {d.lifecycle.paused} เคส ไม่รวมเวลาแก้สำเร็จ · เวลาปิดรวมการปิดอัตโนมัติและเวลารอเครื่องตรวจยืนยัน ไม่ใช่เวลาทำงานของพนักงานทั้งหมด · เคสเก่าที่ไม่ทราบผู้ทำรายการไม่ถูกเดาชื่อผู้รับผิดชอบ</p>
        <Link href="/case-history" className="mt-3 inline-block text-brand-600">ตรวจหลักฐานการดำเนินการย้อนหลัง →</Link>
      </div>
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
                    <td className="py-2.5 pr-4">
                      <div className="font-semibold text-slate-800">{u.totalHandled}</div>
                      <div className="text-xs text-slate-400">
                        ระบบกลาง {u.centralAdminCount + u.itCount} · เครือข่ายซิม {u.networkAdminCount}
                        {u.legacyNetworkCount > 0 ? ` (ย้อนหลัง ${u.legacyNetworkCount})` : ""}
                      </div>
                    </td>
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
        <h2 className="text-lg font-semibold text-slate-800 mb-1">ประวัติรายเคส</h2>
        <p className="mb-4 text-xs text-slate-400">แสดงล่าสุดไม่เกิน 100 เคส · ไฟล์ Export รวมทุกเคสตามตัวกรอง</p>
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
                      <Link href={`/incidents?incident=${r.id}`} className="font-medium text-brand-600 hover:underline">{r.linkName} →</Link>
                      <div className="text-xs text-slate-400">
                        {r.company} · {r.source === "MOBILE" ? `เครือข่ายซิม${r.agentName ? ` (${r.agentName})` : ""}` : "ระบบกลาง"}
                      </div>
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
