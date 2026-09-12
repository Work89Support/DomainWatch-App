const DAY = 86400000;
export function bangkokDay(date: Date) {
  return new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 10);
}
export function reportPeriod(from?: string, to?: string, now = new Date()) {
  const endDay = to || bangkokDay(now);
  const startDay = from || bangkokDay(new Date(now.getTime() - 29 * DAY));
  const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
  if (!valid(startDay) || !valid(endDay)) throw new Error("กรุณาระบุวันที่ให้ถูกต้อง");
  const start = new Date(`${startDay}T00:00:00+07:00`);
  const end = new Date(`${endDay}T23:59:59.999+07:00`);
  if (start > end) throw new Error("วันเริ่มต้นต้องไม่เกินวันสิ้นสุด");
  if (end.getTime() - start.getTime() > 366 * DAY) throw new Error("เลือกช่วงเวลาได้ไม่เกิน 366 วันต่อรายงาน");
  return { from: startDay, to: endDay, start, end };
}
