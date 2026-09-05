import { prisma } from "@/lib/prisma";
import { elapsedMinutes } from "@/lib/caseActivity";

export type UserStat = {
  userId: string;
  name: string;
  role: string;
  adminCount: number;
  centralAdminCount: number;
  networkAdminCount: number;
  legacyNetworkCount: number;
  adminAvgMin: number | null;
  itCount: number;
  itAvgMin: number | null;
  totalHandled: number;
};

export type IncidentLogRow = {
  id: string;
  linkName: string;
  company: string;
  status: string;
  detectedAt: string;
  resolvedAt: string | null;
  adminName: string | null;
  adminMin: number | null;
  itName: string | null;
  itMin: number | null;
  source: "SYSTEM" | "MOBILE";
  agentName: string | null;
};

export type TrendPoint = {
  week: string; // MM/DD (จันทร์ต้นสัปดาห์)
  incidents: number;
  adminAvg: number | null;
  itAvg: number | null;
};

export type UserKpiData = {
  lifecycle: { received: number; missingAck: number; avgAck: number | null; avgResolution: number | null; paused: number };
  users: UserStat[];
  userOptions: { id: string; name: string; role: string }[];
  log: IncidentLogRow[];
  exportLog: IncidentLogRow[];
  trend: TrendPoint[];
  totals: { incidents: number; resolved: number; avgAdmin: number | null; avgIt: number | null };
};

export type UserKpiFilters = {
  userId?: string;
  from?: string;
  to?: string;
  source?: "ALL" | "SYSTEM" | "MOBILE";
};

const avg = (arr: number[]) =>
  arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

function startOfWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // 0 = จันทร์
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}

export async function getUserKpi(filters: UserKpiFilters = {}): Promise<UserKpiData> {
  const [users, allIncidents, allNetworkIncidents] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.incident.findMany({
      orderBy: { detectedAt: "desc" },
      include: { link: { include: { company: true } }, adminUser: true, itUser: true },
    }),
    prisma.networkIncident.findMany({
      orderBy: { detectedAt: "desc" },
      include: { link: { include: { company: true } }, agent: true, adminUser: true },
    }),
  ]);
  const from = filters.from ? new Date(`${filters.from}T00:00:00+07:00`) : null;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999+07:00`) : null;
  const inPeriod = (date: Date) => (!from || date >= from) && (!to || date <= to);
  const incidents = filters.source === "MOBILE"
    ? []
    : allIncidents.filter((i) => inPeriod(i.detectedAt));
  const networkIncidents = filters.source === "SYSTEM"
    ? []
    : allNetworkIncidents.filter((i) => inPeriod(i.detectedAt));

  // Only recorded user attribution counts toward individual performance.
  const isLegacyHandledNetworkIncident = (_i: (typeof networkIncidents)[number]) => false;
  const networkOwnerId = (i: (typeof networkIncidents)[number]) =>
    i.adminUserId;
  const networkResponseMinutes = (i: (typeof networkIncidents)[number]) =>
    i.adminResponseMin ?? (i.adminUpdatedAt ? Math.max(0, Math.round((i.adminUpdatedAt.getTime() - i.detectedAt.getTime()) / 60_000)) : null);
  const scopedIncidents = filters.userId
    ? incidents.filter((i) => i.adminUserId === filters.userId || i.itUserId === filters.userId)
    : incidents;
  const scopedNetworkIncidents = filters.userId
    ? networkIncidents.filter((i) => networkOwnerId(i) === filters.userId)
    : networkIncidents;

  // ---- สรุปรายคน ----
  const users_ = users.filter((u) => !filters.userId || u.id === filters.userId).map((u) => {
    const asAdmin = scopedIncidents.filter(
      (i) => i.adminUserId === u.id && i.adminResponseMin !== null && i.status !== "PAUSED"
    );
    const asIt = scopedIncidents.filter(
      (i) => i.itUserId === u.id && i.itResponseMin !== null && i.status !== "PAUSED"
    );
    const asNetworkAdmin = scopedNetworkIncidents.filter(
      (i) => networkOwnerId(i) === u.id && !!i.adminUpdatedAt && i.status !== "PAUSED"
    );
    const legacyNetworkCount = asNetworkAdmin.filter(isLegacyHandledNetworkIncident).length;
    const adminMinutes = [
      ...asAdmin.map((i) => i.adminResponseMin as number),
      ...asNetworkAdmin.map(networkResponseMinutes).filter((v): v is number => v !== null),
    ];
    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      adminCount: asAdmin.length + asNetworkAdmin.length,
      centralAdminCount: asAdmin.length,
      networkAdminCount: asNetworkAdmin.length,
      legacyNetworkCount,
      adminAvgMin: avg(adminMinutes),
      itCount: asIt.length,
      itAvgMin: avg(asIt.map((i) => i.itResponseMin as number)),
      totalHandled: new Set([...asAdmin.map(i => `SYSTEM:${i.id}`), ...asIt.map(i => `SYSTEM:${i.id}`), ...asNetworkAdmin.map(i => `MOBILE:${i.id}`)]).size,
    };
  })
    .sort((a, b) => b.totalHandled - a.totalHandled);

  // ---- ประวัติรายเคส ----
  const exportLog: IncidentLogRow[] = [
    ...scopedIncidents.map((i) => ({
      id: i.id,
      linkName: i.link.name,
      company: i.link.company.name,
      status: i.status,
      detectedAt: i.detectedAt.toISOString(),
      resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
      adminName: i.adminUser?.name ?? null,
      adminMin: i.adminResponseMin,
      itName: i.itUser?.name ?? null,
      itMin: i.itResponseMin,
      source: "SYSTEM" as const,
      agentName: null,
    })),
    ...scopedNetworkIncidents.map((i) => ({
      id: i.id,
      linkName: i.link.name,
      company: i.link.company.name,
      status: i.status,
      detectedAt: i.detectedAt.toISOString(),
      resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
      adminName: i.adminUser?.name ?? null,
      adminMin: i.adminResponseMin,
      itName: null,
      itMin: null,
      source: "MOBILE" as const,
      agentName: i.agent.name,
    })),
  ]
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  const log = exportLog.slice(0, 100);

  // ---- แนวโน้ม 8 สัปดาห์ ----
  const now = to || new Date();
  const thisWeek = startOfWeek(now);
  const buckets: { key: number; label: string; inc: number[]; adm: number[]; it: number[] }[] = [];
  for (let i = 7; i >= 0; i--) {
    const ws = new Date(thisWeek);
    ws.setUTCDate(ws.getUTCDate() - i * 7);
    const mm = String(ws.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(ws.getUTCDate()).padStart(2, "0");
    buckets.push({ key: ws.getTime(), label: `${mm}/${dd}`, inc: [], adm: [], it: [] });
  }
  for (const i of scopedIncidents) {
    const ws = startOfWeek(i.detectedAt).getTime();
    const b = buckets.find((x) => x.key === ws);
    if (b) {
      b.inc.push(1);
      if (i.status !== "PAUSED" && i.adminResponseMin !== null) b.adm.push(i.adminResponseMin);
      if (i.status !== "PAUSED" && i.itResponseMin !== null) b.it.push(i.itResponseMin);
    }
  }
  for (const i of scopedNetworkIncidents) {
    const ws = startOfWeek(i.detectedAt).getTime();
    const b = buckets.find((x) => x.key === ws);
    if (b) {
      b.inc.push(1);
      if (i.status !== "PAUSED" && i.adminUpdatedAt && i.adminResponseMin !== null) b.adm.push(i.adminResponseMin);
    }
  }
  const trend: TrendPoint[] = buckets.map((b) => ({
    week: b.label,
    incidents: b.inc.length,
    adminAvg: avg(b.adm),
    itAvg: avg(b.it),
  }));

  const allAdmin = [
    ...scopedIncidents.filter(i => i.status !== "PAUSED").map((i) => i.adminResponseMin),
    ...scopedNetworkIncidents
      .filter((i) => !!networkOwnerId(i) && !!i.adminUpdatedAt && i.status !== "PAUSED")
      .map(networkResponseMinutes),
  ].filter((v): v is number => v !== null);
  const allIt = scopedIncidents.filter(i => i.status !== "PAUSED").map((i) => i.itResponseMin).filter((v): v is number => v !== null);

  return {
    lifecycle: (() => {
      const cases = [...scopedIncidents, ...scopedNetworkIncidents];
      const active = cases.filter(i => i.status !== "PAUSED");
      const ack = active.map(i => elapsedMinutes(i.detectedAt, i.adminAckAt)).filter((n): n is number => n !== null);
      const resolved = active.filter(i => i.status === "CLOSED").map(i => elapsedMinutes(i.detectedAt, i.resolvedAt)).filter((n): n is number => n !== null);
      return { received: ack.length, missingAck: active.length - ack.length, avgAck: avg(ack), avgResolution: avg(resolved), paused: cases.length - active.length };
    })(),
    users: users_,
    userOptions: users.map((u) => ({ id: u.id, name: u.name, role: u.role })),
    log,
    exportLog,
    trend,
    totals: {
      incidents: scopedIncidents.length + scopedNetworkIncidents.length,
      resolved:
        scopedIncidents.filter((i) => i.status === "CLOSED").length +
        scopedNetworkIncidents.filter((i) => i.status === "CLOSED").length,
      avgAdmin: avg(allAdmin),
      avgIt: avg(allIt),
    },
  };
}
