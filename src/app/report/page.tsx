import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDailyReport, todayBangkok, shiftDate } from "@/lib/report";
import { PageHeader, StatCard } from "@/components/ui";
import { fmtDateTime, fmtMinutes } from "@/lib/format";
import ReportActions from "@/components/ReportActions";

export const dynamic = "force-dynamic";

const SHIFT_ICON: Record<string, string> = { morning: "🌅", evening: "🌆", night: "🌙" };
const SHIFT_LABEL: Record<string, string> = { morning: "เช้า", evening: "เย็น", night: "กลางคืน" };

export default async function ReportPage({ searchParams }: { searchParams: { date?: string } }) {
  await requireUser();
  const date = searchParams.date || todayBangkok();
  const r = await getDailyReport(date);
  const prev = shiftDate(date, -1);
  const next = shiftDate(date, 1);
  const isToday = date === todayBangkok();

  return (
    <div id="report-capture" className="p-6 md:p-8 max-w-5xl mx-auto bg-slate-50">
      <PageHeader
        title="รายงานสรุปรอบวัน"
        subtitle="สรุปปัญหา/การแก้ไข แบ่ง 3 รอบ (เช้า · เย็น · กลางคืน) สำหรับผู้บริหารและทีม"
        action={<ReportActions date={date} />}
      />

      {/* แถบเลือกวัน */}
      <div className="card p-3 mb-6 flex items-center justify-between">
        <Link href={`/report?date=${prev}`} className="btn-ghost text-sm">‹ วันก่อนหน้า</Link>
        <div className="text-center">
          <div className="font-semibold text-slate-800">{r.dateLabel}</div>
          <div className="text-xs text-slate-400">รอบวัน 06:00 น. – 06:00 น. วันถัดไป</div>
        </div>
        {isToday ? <span className="btn-ghost text-sm opacity-40 pointer-events-none">วันถัดไป ›</span>
          : <Link href={`/report?date=${next}`} className="btn-ghost text-sm">วันถัดไป ›</Link>}
      </div>

      {/* สรุปทั้งวัน */}
      <div className={`card p-4 mb-6 ${r.allClear ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"}`}>
        <div className={`text-base font-semibold ${r.allClear ? "text-emerald-700" : "text-amber-700"}`}>
          {r.allClear
            ? (r.isToday ? "✅ วันนี้เรียบร้อย — ปิดครบทุกเคส และทุกลิงก์ปกติ" : "✅ วันนั้นเรียบร้อย — ปิดครบทุกเคส")
            : (r.isToday ? `⚠️ ยังมี ${r.totalOpen} เคสค้าง / ล่มอยู่ ${r.downNow} ลิงก์` : `⚠️ วันนั้นมี ${r.totalOpen} เคสที่ปิดไม่ครบ`)}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="ลิงก์ที่เฝ้าดู" value={r.activeLinks} hint={r.isToday ? `ใช้ได้ ${r.upNow} · ล่ม ${r.downNow} (สถานะสด)` : "จำนวนที่เฝ้าดูปัจจุบัน"} tone="slate" />
        <StatCard label="เคสทั้งวัน" value={r.totalIncidents} tone="brand" />
        <StatCard label="แก้ไขแล้ว" value={r.totalResolved} tone="green" />
        <StatCard label="ยังค้าง" value={r.totalOpen} tone={r.totalOpen > 0 ? "red" : "green"} />
      </div>

      {/* 3 รอบ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {r.shifts.map((s) => {
          const badge = s.incidents === 0
            ? { t: "🟢 ไม่มีปัญหา", c: "bg-emerald-50 text-emerald-700" }
            : s.allFixed
              ? { t: "✅ แก้ครบ", c: "bg-emerald-50 text-emerald-700" }
              : { t: `⚠️ ค้าง ${s.open}`, c: "bg-red-50 text-red-600" };
          return (
            <div key={s.key} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{SHIFT_ICON[s.key]}</span>
                  <div>
                    <div className="font-semibold text-slate-800">{s.label}</div>
                    <div className="text-xs text-slate-400">{s.time}</div>
                  </div>
                </div>
                <span className={`badge text-[11px] ${badge.c}`}>{badge.t}</span>
              </div>
              <div className="space-y-1.5 text-sm">
                <Row label="เกิดปัญหา" value={`${s.incidents} เคส`} strong={s.incidents > 0} />
                <Row label="แก้ไขแล้ว" value={`${s.resolved} เคส`} />
                <Row label="ยังค้าง" value={`${s.open} เคส`} danger={s.open > 0} />
                <Row label="ลิงก์ปกติในรอบ" value={`~${s.normalLinks} ลิงก์`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard label="KPI แอดมิน (เฉลี่ยทั้งวัน)" value={fmtMinutes(r.avgAdminMin)} hint="ตั้งแต่ระบบแจ้ง → อัพเดตลิงก์" tone="brand" />
        <StatCard label="KPI ไอที (เฉลี่ยทั้งวัน)" value={fmtMinutes(r.avgItMin)} hint="ตั้งแต่ระบบแจ้ง → ชี้แจง/สำรอง" tone="brand" />
      </div>

      {/* รายการเคสของวัน */}
      <div className="card p-5">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">รายการเคสของรอบวัน ({r.incidents.length})</h2>
        {r.incidents.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">ไม่มีเคสในรอบวันนี้ 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-4 font-medium">ลิงก์ / บริษัท</th>
                  <th className="py-2 pr-4 font-medium">รอบ</th>
                  <th className="py-2 pr-4 font-medium">ตรวจพบ</th>
                  <th className="py-2 pr-4 font-medium">สถานะ</th>
                  <th className="py-2 pr-4 font-medium">KPI แอดมิน</th>
                  <th className="py-2 pr-4 font-medium">KPI ไอที</th>
                </tr>
              </thead>
              <tbody>
                {r.incidents.map((i, idx) => (
                  <tr key={idx} className="border-b border-slate-50">
                    <td className="py-2.5 pr-4">
                      <div className="font-medium text-slate-700">{i.name}</div>
                      <div className="text-xs text-slate-400">{i.company}</div>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500">{SHIFT_ICON[i.shift]} {SHIFT_LABEL[i.shift]}</td>
                    <td className="py-2.5 pr-4 text-slate-500">{fmtDateTime(i.detectedAt)}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`badge text-[11px] ${i.status === "CLOSED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {i.status === "CLOSED" ? "ปิดแล้ว" : "ยังค้าง"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500">{fmtMinutes(i.adminResponseMin)}</td>
                    <td className="py-2.5 pr-4 text-slate-500">{fmtMinutes(i.itResponseMin)}</td>
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

function Row({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`${danger ? "text-red-600 font-semibold" : strong ? "text-slate-800 font-semibold" : "text-slate-700"}`}>{value}</span>
    </div>
  );
}
