export type AckCase = { id: string; source: string; name: string; detectedAt: Date; adminAckAt: Date | null };
export type AckExtreme = { id: string; source: string; name: string; milliseconds: number; ties: number };
export function ackRange(cases: AckCase[]): { fastest: AckExtreme | null; slowest: AckExtreme | null } {
  const rows = cases.flatMap(c => {
    const milliseconds = c.adminAckAt ? c.adminAckAt.getTime() - c.detectedAt.getTime() : NaN;
    return Number.isFinite(milliseconds) && milliseconds >= 0 ? [{ id: c.id, source: c.source, name: c.name, milliseconds }] : [];
  }).sort((a,b) => a.milliseconds-b.milliseconds || a.source.localeCompare(b.source) || a.id.localeCompare(b.id));
  const pick = (row: typeof rows[number] | undefined): AckExtreme | null => row ? { ...row, ties: rows.filter(r => r.milliseconds === row.milliseconds).length } : null;
  return { fastest: pick(rows[0]), slowest: pick(rows.at(-1)) };
}
export function fmtAckDuration(ms: number | undefined) {
  if (ms === undefined) return "—";
  if (ms < 1000) return "น้อยกว่า 1 วินาที";
  const seconds = Math.floor(ms/1000);
  const h = Math.floor(seconds/3600), m = Math.floor(seconds%3600/60), s = seconds%60;
  return [h ? `${h} ชม.` : "", m ? `${m} นาที` : "", s ? `${s} วินาที` : ""].filter(Boolean).join(" ");
}
