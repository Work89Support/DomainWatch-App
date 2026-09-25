export const OFFLINE_AFTER_MS = 12 * 60_000;
export type Presence = { agentId: string; agentName: string; ownerId: string | null; kind: string; createdAt: Date };
export type OfflineSpan = { agentId: string; agentName: string; ownerId: string | null; start: Date; end: Date; ongoing: boolean };

// Do not infer old outages from status-change logs or the first observed heartbeat.
export function offlineSpans(events: Presence[], now: Date, from?: Date | null, to?: Date | null): OfflineSpan[] {
  const states = new Map<string, { event: Presence; lastBeat: number | null; cursor: number }>();
  const spans: OfflineSpan[] = [];
  const emit = (s: { event: Presence; lastBeat: number | null; cursor: number }, end: number, ongoing: boolean) => {
    if (s.lastBeat === null) return;
    const start = Math.max(s.lastBeat + OFFLINE_AFTER_MS, s.cursor, from?.getTime() ?? 0);
    end = Math.min(end, now.getTime(), to?.getTime() ?? Infinity);
    if (end > start) spans.push({ agentId: s.event.agentId, agentName: s.event.agentName, ownerId: s.event.ownerId, start: new Date(start), end: new Date(end), ongoing: ongoing && end === now.getTime() });
  };
  for (const e of [...events].sort((a,b) => a.createdAt.getTime()-b.createdAt.getTime())) {
    const t = e.createdAt.getTime();
    if (t > now.getTime()) continue;
    const s = states.get(e.agentId);
    if (s) emit(s, t, false);
    const lastBeat = e.kind === "HEARTBEAT" ? t : e.kind === "OWNER" ? s?.lastBeat ?? null : null;
    states.set(e.agentId, { event: e, lastBeat, cursor: t });
  }
  for (const s of states.values()) emit(s, now.getTime(), true);
  return spans;
}

export function overlapMs(start: Date, end: Date, otherStart: Date, otherEnd: Date) {
  return Math.max(0, Math.min(end.getTime(), otherEnd.getTime()) - Math.max(start.getTime(), otherStart.getTime()));
}

export function waitingOverlapMs(span: OfflineSpan, cases: { adminUpdatedAt: Date | null; resolvedAt: Date | null }[]) {
  const ranges = cases.filter(c => c.adminUpdatedAt).map(c => [Math.max(span.start.getTime(), c.adminUpdatedAt!.getTime()), Math.min(span.end.getTime(), c.resolvedAt?.getTime() ?? span.end.getTime())]).filter(([s,e]) => e > s).sort((a,b) => a[0]-b[0]);
  let total = 0, end = 0;
  for (const [s,e] of ranges) { total += Math.max(0,e-Math.max(s,end)); end = Math.max(end,e); }
  return total;
}
