"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";

export default function KpiTrend({
  data,
}: {
  data: { week: string; incidents: number; adminAvg: number | null; itAvg: number | null }[];
}) {
  return (
    <>
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 32, right: 18, bottom: 14, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#94a3b8" }} />
        <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "#94a3b8" }} unit="น." />
        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar isAnimationActive={false} yAxisId="left" dataKey="incidents" name="จำนวนเหตุการณ์" fill="#93c5fd" radius={[6, 6, 0, 0]}>
          <LabelList dataKey="incidents" position="top" fill="#334155" fontSize={11} fontWeight={600} />
        </Bar>
        <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="adminAvg" name="KPI แอดมิน (นาที)" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} connectNulls>
          <LabelList dataKey="adminAvg" position="top" offset={18} fill="#1d4ed8" fontSize={11} formatter={(value: number | null) => value == null ? "" : `${value} น.`} />
        </Line>
        <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="itAvg" name="KPI ไอที (นาที)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} connectNulls>
          <LabelList dataKey="itAvg" position="bottom" offset={12} fill="#b45309" fontSize={11} formatter={(value: number | null) => value == null ? "" : `${value} น.`} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
    <div className="overflow-x-auto mt-3"><table className="w-full text-sm text-left"><thead><tr><th>สัปดาห์</th><th>เหตุการณ์ (เคส)</th><th>แอดมิน (นาที)</th><th>ไอที (นาที)</th></tr></thead><tbody>{data.map(d => <tr key={d.week}><td>{d.week}</td><td>{d.incidents}</td><td>{d.adminAvg ?? "—"}</td><td>{d.itAvg ?? "—"}</td></tr>)}</tbody></table></div>
    </>
  );
}
