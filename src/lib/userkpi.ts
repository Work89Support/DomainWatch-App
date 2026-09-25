import { prisma } from "@/lib/prisma";
import { claimedWork } from "@/lib/claimedWork";
import { elapsedMinutes } from "@/lib/caseActivity";
import { offlineSpans, waitingOverlapMs, type OfflineSpan } from "@/lib/offlineKpi";

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
  receivedCount: number;
  receivedAvgMin: number | null;
  repairedWithoutAck: number;
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
  adminBasis: string;
  itBasis: string;
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
  siteStaff: { id: string; name: string; devices: { id: string; name: string }[] }[];
  offline: (OfflineSpan & { waitingMinutes: number })[];
  presenceSince: Date | null;
  lifecycle: { received: number; missingAck: number; repairedWithoutAck: number; avgAck: number | null; avgResolution: number | null; paused: number };
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
  const [users, rawIncidents, rawNetworkIncidents, claims, presence] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { siteDevices: { select: { id: true, name: true } } } }),
    prisma.incident.findMany({
      orderBy: { detectedAt: "desc" },
      include: { link: { include: { company: true } }, adminUser: true, itUser: true },
    }),
    prisma.networkIncident.findMany({
      orderBy: { detectedAt: "desc" },
      include: { link: { include: { company: true } }, agent: true, adminUser: true },
    }),
    prisma.caseActivity.findMany({ where: { actorId: { not: null } },
      select: { source: true, caseId: true, action: true, actorId: true, actorName: true, createdAt: true, note: true, details: true } }),
    prisma.agentPresence.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
  ]);
  const claimMap = new Map<string, typeof claims>();
  for (const claim of claims) {
    const key = `${claim.source}:${claim.caseId}`;
    claimMap.set(key, [...(claimMap.get(key) || []), claim]);
  }
  const allIncidents = rawIncidents.map(i => {
    const evidence = claimMap.get(`SYSTEM:${i.id}`) || [];
    const admin = claimedWork(i.status, i.adminAckAt, i.adminUpdatedAt, evidence.filter(e => e.action !== "ACK" || e.note === "แอดมินรับเรื่อง"), i.resolvedAt, i.detectedAt);
    const it = claimedWork(i.status, i.itAckAt, i.itResolvedAt, evidence.filter(e => e.action !== "ACK" || e.note === "ไอทีรับเรื่อง"), undefined, i.detectedAt, true);
    return { ...i, adminUserId: admin.userId, adminUser: admin.name ? { name: admin.name } : null, adminResponseMin: admin.minutes,
      itUserId: it.userId, itUser: it.name ? { name: it.name } : null, itResponseMin: it.minutes };
  });
  const allNetworkIncidents = rawNetworkIncidents.map(i => {
    const admin = claimedWork(i.status, i.adminAckAt, i.adminUpdatedAt, claimMap.get(`MOBILE:${i.id}`) || [], i.resolvedAt, i.detectedAt);
    return { ...i, adminUserId: admin.userId, adminUser: admin.name ? { name: admin.name } : null, adminResponseMin: admin.minutes };
  });
  const from = filters.from ? new Date(`${filters.from}T00:00:00+07:00`) : null;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999+07:00`) : null;
  const inPeriod = (date: Date) => (!from || date >= from) && (!to || date <= to);
  const offline = (filters.source === "SYSTEM" ? [] : offlineSpans(presence, new Date(), from, to))
    .filter(s => !filters.userId || s.ownerId === filters.userId)
    .map(s => ({ ...s, waitingMinutes: waitingOverlapMs(s, rawNetworkIncidents.filter(i => i.agentId === s.agentId && i.status !== "PAUSED")) / 60_000 }));
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
    i.adminResponseMin;
  const scopedIncidents = filters.userId
    ? incidents.filter((i) => i.adminUserId === filters.userId || i.itUserId === filters.userId)
    : incidents;
  const scopedNetworkIncidents = filters.userId
    ? networkIncidents.filter((i) => networkOwnerId(i) === filters.userId)
    : networkIncidents;

  // ---- สรุปรายคน ----
  const users_ = users.filter((u) => u.role !== "SITE_STAFF" && (!filters.userId || u.id === filters.userId)).map((u) => {
    const asAdmin = scopedIncidents.filter(
      (i) => i.adminUserId === u.id && i.adminResponseMin !== null && i.status !== "PAUSED"
    );
    const asIt = scopedIncidents.filter(
      (i) => i.itUserId === u.id && i.itResponseMin !== null && i.status !== "PAUSED"
    );
    const asNetworkAdmin = scopedNetworkIncidents.filter(
      (i) => networkOwnerId(i) === u.id && networkResponseMinutes(i) !== null
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
      receivedCount: [...scopedIncidents, ...scopedNetworkIncidents].filter(i => i.adminUserId === u.id && i.adminAckAt).length + scopedIncidents.filter(i => i.itUserId === u.id && i.itAckAt).length,
      receivedAvgMin: avg([
        ...[...scopedIncidents, ...scopedNetworkIncidents].filter(i => i.adminUserId === u.id).map(i => elapsedMinutes(i.detectedAt, i.adminAckAt)),
        ...scopedIncidents.filter(i => i.itUserId === u.id).map(i => elapsedMinutes(i.detectedAt, i.itAckAt)),
      ].filter((n): n is number => n !== null)),
      repairedWithoutAck: asAdmin.filter(i => !i.adminAckAt).length + asNetworkAdmin.filter(i => !i.adminAckAt).length + asIt.filter(i => !i.itAckAt).length,
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
      adminBasis: i.adminAckAt ? "รับเคส → แก้เสร็จ" : "ไม่รับเคส: ตรวจพบ → แก้เสร็จ",
      itBasis: i.itAckAt ? "รับเคส → งานเสร็จ" : "ไม่รับเคส: ตรวจพบ → งานเสร็จ",
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
      adminBasis: i.adminAckAt ? "รับเคส → แก้เสร็จ" : "ไม่รับเคส: ตรวจพบ → แก้เสร็จ",
      itBasis: "—",
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
      const minutes = networkResponseMinutes(i);
      if (networkOwnerId(i) && minutes !== null) b.adm.push(minutes);
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
      .filter((i) => !!networkOwnerId(i) && networkResponseMinutes(i) !== null)
      .map(networkResponseMinutes),
  ].filter((v): v is number => v !== null);
  const allIt = scopedIncidents.filter(i => i.status !== "PAUSED").map((i) => i.itResponseMin).filter((v): v is number => v !== null);

  return {
    offline,
    presenceSince: presence[0]?.createdAt ?? null,
    siteStaff: users.filter(u => u.role === "SITE_STAFF" && (!filters.userId || u.id === filters.userId)).map(u => ({ id: u.id, name: u.name, devices: u.siteDevices })),
    lifecycle: (() => {
      const cases = [...scopedIncidents, ...scopedNetworkIncidents];
      const active = cases.filter(i => i.status !== "PAUSED");
      const ack = active.map(i => elapsedMinutes(i.detectedAt, i.adminAckAt)).filter((n): n is number => n !== null);
      const resolved = active.filter(i => i.status === "CLOSED").map(i => elapsedMinutes(i.detectedAt, i.resolvedAt)).filter((n): n is number => n !== null);
      const repairedWithoutAck = active.filter(i => !i.adminAckAt && i.adminResponseMin !== null && i.adminUserId).length;
      return { received: ack.length, missingAck: active.length - ack.length - repairedWithoutAck, repairedWithoutAck, avgAck: avg(ack), avgResolution: avg(resolved), paused: cases.length - active.length };
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
