"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LabelList,
} from "recharts";

const BRAND = "#2563eb";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const SLATE = "#cbd5e1";

export default function DashboardCharts({
  incidentsPerDay,
  categoryBreakdown,
  up,
  slow,
  down,
  unknown,
  showOverview = true,
}: {
  incidentsPerDay: { date: string; count: number }[];
  categoryBreakdown: { category: string; up: number; slow: number; down: number; total: number }[];
  up: number;
  slow: number;
  down: number;
  unknown: number;
  showOverview?: boolean;
}) {
  const pieData = [
    { name: "ใช้งานได้", value: up, color: GREEN },
    { name: "โหลดช้า", value: slow, color: AMBER },
    { name: "ใช้ไม่ได้", value: down, color: RED },
    { name: "ยังไม่เช็ค", value: unknown, color: SLATE },
  ].filter((d) => d.value > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* เหตุการณ์ต่อวัน */}
      {showOverview && <>
      <div className="card p-5 lg:col-span-2">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          เหตุการณ์ระบบกลาง + เครือข่ายซิม (ช่วงเวลาที่เลือก)
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={incidentsPerDay} margin={{ top: 28, right: 12, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
              labelStyle={{ color: "#334155" }}
            />
            <Bar isAnimationActive={false} dataKey="count" name="เหตุการณ์" fill={BRAND} radius={[6, 6, 0, 0]}>
              {incidentsPerDay.length <= 31 && <LabelList dataKey="count" position="top" fill="#1e40af" fontSize={11} fontWeight={600} />}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {incidentsPerDay.length > 31 && <div className="mt-3 text-sm">
          <p className="text-slate-500 mb-2">จำนวนรายวัน (ช่วงยาวแสดงตัวเลขใต้กราฟเพื่อไม่ให้ทับกัน)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{incidentsPerDay.map(d => <div key={d.date}>{d.date}: <strong>{d.count.toLocaleString("th-TH")}</strong></div>)}</div>
        </div>}
      </div>

      {/* สัดส่วนสถานะ */}
      <div className="card p-5">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">สัดส่วนสถานะลิงก์ ณ เวลาสร้างรายงาน</h2>
        {pieData.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-16">ยังไม่มีข้อมูล</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                isAnimationActive={false}
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
        {pieData.length > 0 && <div className="space-y-2 text-sm" aria-label="จำนวนลิงก์แยกตามสถานะ">
          {pieData.map(entry => <div key={entry.name} className="flex items-center justify-between gap-2">
            <span><span style={{ backgroundColor: entry.color }} className="inline-block w-3 h-3 rounded-sm mr-2" />{entry.name}</span>
            <strong>{entry.value.toLocaleString("th-TH")} ลิงก์ ({(entry.value / (up + slow + down + unknown) * 100).toFixed(1)}%)</strong>
          </div>)}
        </div>}
      </div>

      {/* แยกตามหมวด */}
      </>}
      {categoryBreakdown.length > 0 && (
        <div className="card p-5 lg:col-span-3">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">สถานะแยกตามหมวด</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={categoryBreakdown} margin={{ top: 24, right: 12, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="category" tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar isAnimationActive={false} dataKey="up" name="ใช้งานได้" stackId="a" fill={GREEN} radius={[0, 0, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="slow" name="โหลดช้า" stackId="a" fill={AMBER} radius={[0, 0, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="down" name="ใช้ไม่ได้" stackId="a" fill={RED} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th>หมวด</th><th>ใช้งานได้</th><th>โหลดช้า</th><th>ใช้ไม่ได้</th></tr></thead><tbody>{categoryBreakdown.map(c => <tr key={c.category}><td>{c.category}</td><td>{c.up}</td><td>{c.slow}</td><td>{c.down}</td></tr>)}</tbody></table></div>
        </div>
      )}
    </div>
  );
}
