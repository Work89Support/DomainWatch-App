export function verifiedAdminMinutes(incident: {
  status: string;
  detectedAt: Date;
  adminUpdatedAt: Date | null;
  resolvedAt: Date | null;
}): number | null {
  const { status, detectedAt, adminUpdatedAt, resolvedAt } = incident;
  if (status !== "CLOSED" || !adminUpdatedAt || !resolvedAt) return null;
  if (adminUpdatedAt < detectedAt || resolvedAt < adminUpdatedAt) return null;
  return Math.round((adminUpdatedAt.getTime() - detectedAt.getTime()) / 60_000);
}
