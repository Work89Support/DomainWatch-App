// Report-only filter. Never delete or mutate excluded case history.
export function visibleInStaffKpi(i: { status: string; adminAckAt: Date | null; adminResponseMin: number | null; itAckAt?: Date | null; itResponseMin?: number | null }) {
  return i.status !== "PAUSED" && Boolean(i.adminAckAt || i.itAckAt || i.adminResponseMin != null || i.itResponseMin != null);
}
