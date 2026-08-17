import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDailyReport, todayBangkok, shiftDate, type DailyReport } from "@/lib/report";
import { PageHeader, StatCard } from "@/components/ui";
import { fmtDateTime, fmtMinutes } from "@/lib/format";
import ReportActions from "@/components/ReportActions";
import { canViewReport } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const SHIFT_ICON: Record<string, string> = { morning: "🌅", evening: "🌆", night: "🌙" };
const SHIFT_LABEL: Record<string, string> = { morning: "เช้า", evening: "เย็น", night: "กลางคืน" };

export default async function ReportPage({ searchParams }: { searchParams: { date?: string } }) {
  const me = await requireUser();
  if (!canViewReport(me.role)) redirect("/");
  const date = searchParams.date || todayBangkok();
  const r = await getDailyReport(date);
  const prev = shiftDate(date, -1);
  const next = shiftDate(date, 1);
  const isToday = date === todayBangkok();

  return (
    <>
    <div id="report-capture" className="p-6 md:p-8 max-w-5xl mx-auto bg-slate-50 print:hidden">
      <PageHeader
        title="รายงานสรุปรอบวัน"
        subtitle="สรุปปัญหา/การแก้ไข แบ่ง 3 รอบ (เช้า · เย็น · กลางคืน) สำหรับ Management และทีม"
        action={<ReportActions date={date} canSend={me.role === "ADMIN"} />}
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
            : (r.isToday
              ? `⚠️ ค้างสะสม ${r.currentOpenIncidents} เคส / ใช้ไม่ได้ ${r.downNowUnique} URLจริง (${r.downNow} รายการตามห้อง)`
              : `⚠️ วันนั้นมี ${r.totalOpen} เคสที่ปิดไม่ครบ`)}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="ลิงก์ที่เฝ้าดู" value={r.activeLinks} hint={r.isToday ? `ใช้ได้ ${r.upNow} · ช้า ${r.slowNow} · ใช้ไม่ได้ ${r.downNow} รายการ / ${r.downNowUnique} URLจริง` : "จำนวนที่เฝ้าดูปัจจุบัน"} tone="slate" />
        <StatCard label="เคสทั้งวัน" value={r.totalIncidents} tone="brand" />
        <StatCard label="แก้ไขแล้ว" value={r.totalResolved} tone="green" />
        <StatCard
          label="ค้างจากเคสวันนี้"
          value={r.totalOpen}
          hint={r.isToday ? `ค้างสะสมทุกวัน ${r.currentOpenIncidents} เคส` : undefined}
          tone={r.totalOpen > 0 ? "red" : "green"}
        />
      </div>

      {r.isToday && r.currentOpenDetails.length > 0 && (
        <div className="card p-5 mb-6 border-red-100">
          <h2 className="text-lg font-semibold text-slate-800">เคสที่ค้างอยู่ตอนนี้ ({r.currentOpenDetails.length})</h2>
          <p className="text-xs text-slate-400 mt-1 mb-4">แสดงแยกตามห้อง LINE แม้ใช้ URL เดียวกัน</p>
          <div className="space-y-3">
            {r.currentOpenDetails.map((incident) => (
              <div key={incident.id} className="rounded-xl border border-red-100 bg-red-50/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-800">
                      {incident.name} · {incident.company}
                    </div>
                    {incident.room && <div className="text-xs text-slate-600">💬 ห้อง LINE: {incident.room}</div>}
                    <div className="text-[11px] text-slate-500">เคส #{incident.id.slice(-8).toUpperCase()}</div>
                  </div>
                  {incident.carriedOver && <span className="badge bg-amber-50 text-amber-700">ค้างจากวันก่อน</span>}
                </div>
                <a href={incident.url} target="_blank" rel="noreferrer" className="block text-xs text-brand-600 hover:underline break-all mt-1">
                  {incident.url} ↗
                </a>
                <div className="text-xs text-red-600 mt-1">
                  ค้างตั้งแต่ {fmtDateTime(incident.detectedAt)} · นาน {fmtMinutes(incident.openMinutes)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
    <ExportReportView report={r} />
    </>
  );
}

function ExportReportView({ report: r }: { report: DailyReport }) {
  return (
    <div
      id="report-export"
      className="fixed left-[-100000px] top-0 w-[1120px] bg-white p-10 text-slate-800 print:static print:w-full print:p-6"
    >
      <div className="flex items-start justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="text-3xl font-bold">รายงานสรุปรอบวัน</div>
          <div className="mt-1 text-base text-slate-500">DomainWatch · สำหรับ Management และทีมปฏิบัติการ</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold">{r.dateLabel}</div>
          <div className="text-sm text-slate-500">รอบ 06:00–06:00 น. วันถัดไป</div>
        </div>
      </div>

      <div className={`mt-5 rounded-2xl border p-4 ${r.allClear ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className={`text-lg font-semibold ${r.allClear ? "text-emerald-700" : "text-amber-800"}`}>
          {r.allClear
            ? "✅ สถานะเรียบร้อย ไม่มีเคสค้าง"
            : `⚠️ ค้างสะสม ${r.currentOpenIncidents} เคส · ใช้ไม่ได้ ${r.downNowUnique} URLจริง (${r.downNow} รายการตามห้อง)`}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-5 gap-3">
        <ExportMetric label="ลิงก์ที่เฝ้าดู" value={r.activeLinks} detail={`ใช้ได้ ${r.upNow} · ช้า ${r.slowNow}`} />
        <ExportMetric label="เคสในรอบวัน" value={r.totalIncidents} detail="เกิดใหม่ในรอบนี้" />
        <ExportMetric label="แก้ไขแล้ว" value={r.totalResolved} detail="เฉพาะเคสในรอบ" tone="green" />
        <ExportMetric label="ค้างจากวันนี้" value={r.totalOpen} detail="ยังไม่ปิดจากรอบนี้" tone={r.totalOpen ? "red" : "green"} />
        <ExportMetric label="ค้างสะสม" value={r.currentOpenIncidents} detail="รวมเคสจากวันก่อน" tone={r.currentOpenIncidents ? "red" : "green"} />
      </div>

      {r.currentOpenDetails.length > 0 && (
        <div className="mt-5 rounded-2xl border border-red-100 p-5">
          <div className="text-lg font-semibold">เคสที่ค้างอยู่ตอนนี้ ({r.currentOpenDetails.length})</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {r.currentOpenDetails.map((incident) => (
              <div key={incident.id} className="rounded-xl bg-red-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold">{incident.name} · {incident.company}</div>
                  <div className="text-xs font-medium text-red-600">#{incident.id.slice(-8).toUpperCase()}</div>
                </div>
                {incident.room && <div className="text-sm text-slate-600">ห้อง LINE: {incident.room}</div>}
                <div className="mt-1 break-all text-xs text-blue-700">{incident.url}</div>
                <div className="mt-1 text-sm font-medium text-red-700">
                  ค้างตั้งแต่ {fmtDateTime(incident.detectedAt)} · {fmtMinutes(incident.openMinutes)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-3">
        {r.shifts.map((shift) => (
          <div key={shift.key} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">{SHIFT_ICON[shift.key]} {shift.label}</div>
              <div className="text-xs text-slate-500">{shift.time}</div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <ExportSmall label="เกิดปัญหา" value={shift.incidents} />
              <ExportSmall label="แก้แล้ว" value={shift.resolved} tone="green" />
              <ExportSmall label="ยังค้าง" value={shift.open} tone={shift.open ? "red" : "green"} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <ExportMetric label="KPI แอดมินเฉลี่ย" value={fmtMinutes(r.avgAdminMin)} detail="แจ้งเตือน → อัปเดตลิงก์" />
        <ExportMetric label="KPI ไอทีเฉลี่ย" value={fmtMinutes(r.avgItMin)} detail="แจ้งเตือน → ชี้แจง/สำรอง" />
      </div>

      <div className="mt-6 border-t border-slate-200 pt-3 text-center text-xs text-slate-400">
        รายละเอียดเหตุการณ์ทั้งหมด {r.totalIncidents} เคส ดูได้ในระบบ DomainWatch · เอกสารนี้สรุปเฉพาะข้อมูลสำคัญสำหรับการอ่านและส่งต่อ
      </div>
    </div>
  );
}

function ExportMetric({
  label,
  value,
  detail,
  tone = "blue",
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  tone?: "blue" | "green" | "red";
}) {
  const color = tone === "green" ? "text-emerald-600" : tone === "red" ? "text-red-600" : "text-blue-700";
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-400">{detail}</div>
    </div>
  );
}

function ExportSmall({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "green" | "red" }) {
  const color = tone === "green" ? "text-emerald-600" : tone === "red" ? "text-red-600" : "text-slate-800";
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-3">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
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
