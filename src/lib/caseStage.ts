import { activeWaiting } from "./caseWaiting";

export type CaseStageInput = Parameters<typeof activeWaiting>[0] & {
  adminAckAt?: string | Date | null;
  itAckAt?: string | Date | null;
};
export const CASE_STAGE_LABELS = {
  unclaimed: "ยังไม่รับเคส",
  working: "รับแล้ว — กำลังดำเนินการ",
  waiting: "รับแล้ว — รอแก้ไข",
  forwarded: "ส่งต่อแล้ว — รอติดตาม",
  verification: "รอตรวจยืนยัน",
  closed: "ปิดเคสแล้ว",
  paused: "พักการเฝ้าดู",
} as const;
export type CaseStage = keyof typeof CASE_STAGE_LABELS;
export function caseStage(c: CaseStageInput): CaseStage {
  if (c.status === "CLOSED") return "closed";
  if (c.status === "PAUSED") return "paused";
  const waiting = activeWaiting(c);
  if (waiting) return waiting.kind === "forwarded" ? "forwarded" : "waiting";
  if (c.status === "ADMIN_UPDATED" || c.status === "IT_RESOLVED") return "verification";
  return c.adminAckAt || c.itAckAt ? "working" : "unclaimed";
}
export type CaseFilter = "open" | "all" | "unclaimed" | "working" | "waiting" | "forwarded" | "verification";
export function matchesCaseFilter(c: CaseStageInput, filter: CaseFilter) {
  const stage = caseStage(c);
  return filter === "all" || (filter === "open" ? stage !== "closed" && stage !== "paused" : stage === filter);
}
