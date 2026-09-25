// KPI belongs to the person who explicitly claimed the case, never the last editor.
// Keep audit history immutable; legacy rows without claim evidence are not guessed.
export type ClaimEvidence = { action: string; actorId: string | null; actorName: string; createdAt: Date };
export function claimedWork(status: string, acknowledgedAt: Date | null, completedAt: Date | null,
  evidence: ClaimEvidence[], resolvedAt?: Date | null) {
  if (!acknowledgedAt) return { userId: null, name: null, minutes: null };
  const claims = evidence.filter(e => e.action === "ACK" && e.actorId && e.createdAt.getTime() === acknowledgedAt.getTime());
  const owners = new Set(claims.map(e => e.actorId));
  if (owners.size !== 1) return { userId: null, name: null, minutes: null };
  const claim = claims[0];
  const valid = status !== "PAUSED" && completedAt && completedAt >= acknowledgedAt
    && (resolvedAt === undefined || (status === "CLOSED" && resolvedAt && resolvedAt >= completedAt));
  return { userId: claim.actorId, name: claim.actorName,
    minutes: valid && completedAt ? Math.round((completedAt.getTime() - acknowledgedAt.getTime()) / 60_000) : null };
}
