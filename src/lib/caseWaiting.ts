export type WaitingDetails = { reason: string; until: string; since: string; owner: string; impact: string };
export const WAIT_IMPACTS = ["ลูกค้ายังใช้ลิงก์สำรองได้", "ลูกค้ายังใช้งานไม่ได้", "กำลังตรวจสอบผลกระทบ"];
export function parseWaiting(value: unknown): WaitingDetails | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!["reason", "until", "since", "owner", "impact"].every(k => typeof v[k] === "string")) return null;
  if (!Number.isFinite(Date.parse(v.until as string)) || !Number.isFinite(Date.parse(v.since as string))) return null;
  return v as WaitingDetails;
}
export function activeWaiting(c: { status: string; waitingDetails?: unknown; adminUpdatedAt?: string | Date | null; itResolvedAt?: string | Date | null }): WaitingDetails | null {
  if (!["OPEN", "IT_RESOLVED"].includes(c.status)) return null;
  const w = parseWaiting(c.waitingDetails);
  if (!w) return null;
  if ([c.adminUpdatedAt, c.itResolvedAt].some(d => d && new Date(d).getTime() >= Date.parse(w.since))) return null;
  return w;
}
export function waitingInput(body: Record<string, unknown>, now = new Date()) {
  const reason = typeof body.note === "string" ? body.note.trim() : "";
  const until = typeof body.until === "string" ? new Date(body.until) : new Date(NaN);
  if (!reason || reason.length > 2000) throw new Error("กรุณาระบุเหตุผลที่รอ ไม่เกิน 2,000 ตัวอักษร");
  if (!Number.isFinite(until.getTime()) || until <= now) throw new Error("กรุณาระบุเวลาติดตามครั้งถัดไปในอนาคต");
  if (typeof body.impact !== "string" || !WAIT_IMPACTS.includes(body.impact)) throw new Error("กรุณาระบุผลกระทบต่อลูกค้า");
  return { reason, until: until.toISOString(), impact: body.impact };
}
