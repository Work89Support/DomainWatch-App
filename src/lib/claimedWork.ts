// KPI belongs to the person who explicitly claimed the case, never the last editor.
// Keep audit history immutable; legacy rows without claim evidence are not guessed.
export type ClaimEvidence = { action: string; actorId: string | null; actorName: string; createdAt: Date; details?: unknown };
export function completionEvidence(e: ClaimEvidence, done: Date, it = false) {
  if (!e.actorId || !(it ? ["it_resolve"] : ["admin_update", "admin_use_backup", "mark_updated", "BULK_LINK_UPDATED"]).includes(e.action)) return false;
  const d = e.details as { editedAt?: string; after?: { adminUpdatedAt?: string; itResolvedAt?: string } } | null;
  const stamp = d?.editedAt || (it ? d?.after?.itResolvedAt : d?.after?.adminUpdatedAt);
  return stamp ? new Date(stamp).getTime() === done.getTime() : e.createdAt.getTime() === done.getTime();
}
export function claimedWork(status: string, acknowledgedAt: Date | null, completedAt: Date | null,
  evidence: ClaimEvidence[], resolvedAt?: Date | null, detectedAt?: Date, it = false) {
  if (!acknowledgedAt) {
    const repairs = completedAt ? evidence.filter(e => completionEvidence(e, completedAt, it)) : [];
    const owners = new Set(repairs.map(e => e.actorId));
    const valid = owners.size === 1 && detectedAt && completedAt && completedAt >= detectedAt && status !== "PAUSED"
      && (resolvedAt === undefined || (status === "CLOSED" && resolvedAt && resolvedAt >= completedAt));
    return { userId: owners.size === 1 ? repairs[0].actorId : null, name: owners.size === 1 ? repairs[0].actorName : null,
      minutes: valid ? Math.round((completedAt!.getTime()-detectedAt!.getTime())/60_000) : null };
  }
  const claims = evidence.filter(e => e.action === "ACK" && e.actorId && e.createdAt.getTime() === acknowledgedAt.getTime());
  const owners = new Set(claims.map(e => e.actorId));
  if (owners.size !== 1) return { userId: null, name: null, minutes: null };
  const claim = claims[0];
  const valid = status !== "PAUSED" && completedAt && completedAt >= acknowledgedAt
    && (resolvedAt === undefined || (status === "CLOSED" && resolvedAt && resolvedAt >= completedAt));
  return { userId: claim.actorId, name: claim.actorName,
    minutes: valid && completedAt ? Math.round((completedAt.getTime() - acknowledgedAt.getTime()) / 60_000) : null };
}
