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
} from "recharts";

export default function KpiTrend({
  data,
}: {
  data: { week: string; incidents: number; adminAvg: number | null; itAvg: number | null }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#94a3b8" }} />
        <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "#94a3b8" }} unit="น." />
        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="incidents" name="จำนวนเหตุการณ์" fill="#93c5fd" radius={[6, 6, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="adminAvg" name="KPI แอดมิน (นาที)" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line yAxisId="right" type="monotone" dataKey="itAvg" name="KPI ไอที (นาที)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
