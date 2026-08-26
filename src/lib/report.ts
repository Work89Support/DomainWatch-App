import { prisma } from "@/lib/prisma";

// รายงานสรุปรอบวัน แบ่ง 3 รอบ (เวลาไทย):
//   รอบเช้า 06:00–14:00 · รอบเย็น 14:00–22:00 · รอบกลางคืน 22:00–06:00 (ข้ามวัน)

const H = 3600 * 1000;

export type ShiftReport = {
  key: string;
  label: string;
  time: string;
  incidents: number; // เคสที่เกิดในรอบนี้
  resolved: number; // แก้/ปิดแล้ว
  open: number; // ยังค้าง
  problemLinks: number; // จำนวนลิงก์ที่มีปัญหา (ไม่ซ้ำ)
  normalLinks: number; // ลิงก์ที่ไม่มีปัญหาในรอบ (โดยประมาณ = เฝ้าดูทั้งหมด - ที่มีปัญหา)
  allFixed: boolean;
};

export type DailyReport = {
  date: string; // YYYY-MM-DD
  dateLabel: string;
  scopeLabel?: string;
  isToday: boolean; // true = ตัวเลขสถานะสด (ล่มตอนนี้/OA) ใช้ได้จริง; false = ดูย้อนหลัง อย่าโชว์สถานะสด
  activeLinks: number;
  upNow: number;
  slowNow: number;
  downNow: number;
  downNowUnique: number;
  currentOpenIncidents: number;
  currentOpenDetails: {
    id: string;
    name: string;
    company: string;
    room: string | null;
    url: string;
    detectedAt: string;
    openMinutes: number;
    carriedOver: boolean;
  }[];
  oaIssues: number;
  mobileTotals: {
    agents: number;
    online: number;
    up: number;
    slow: number;
    down: number;
    unknown: number;
    openIncidents: number;
  };
  mobileAgents: {
    id: string;
    name: string;
    carrier: string;
    reportedCarrier: string | null;
    deviceLabel: string | null;
    appVersion: string | null;
    isActive: boolean;
    online: boolean;
    lastSeenAt: string | null;
    lastCheckedAt: string | null;
    totalUrls: number;
    up: number;
    slow: number;
    down: number;
    unknown: number;
    newIncidents: number;
    resolvedIncidents: number;
    openIncidents: number;
  }[];
  mobileOpenDetails: {
    id: string;
    agentId: string;
    agentName: string;
    carrier: string;
    name: string;
    company: string;
    room: string | null;
    url: string;
    detectedAt: string;
    openMinutes: number;
  }[];
  totalIncidents: number;
  totalResolved: number;
  totalOpen: number;
  avgAdminMin: number | null;
  avgItMin: number | null;
  allClear: boolean;
  shifts: ShiftReport[];
  incidents: {
    name: string;
    company: string;
    shift: string;
    detectedAt: string;
    status: string;
    adminResponseMin: number | null;
    itResponseMin: number | null;
  }[];
};

// วันที่ปัจจุบันตามเวลาไทย (YYYY-MM-DD)
export function todayBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export function shiftDate(dateStr: string, deltaDays: number): string {
  const base = new Date(`${dateStr}T12:00:00+07:00`);
  const d = new Date(base.getTime() + deltaDays * 24 * H);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export async function getDailyReport(
  dateStr: string,
  options?: { companyIds?: string[]; scopeLabel?: string }
): Promise<DailyReport> {
  const companyIds = options?.companyIds?.filter(Boolean);
  const scoped = Boolean(companyIds?.length);
  const dayStart = new Date(`${dateStr}T06:00:00+07:00`);
  const bounds = [
    { key: "morning", label: "รอบเช้า", time: "06:00–14:00", start: dayStart, end: new Date(dayStart.getTime() + 8 * H) },
    { key: "evening", label: "รอบเย็น", time: "14:00–22:00", start: new Date(dayStart.getTime() + 8 * H), end: new Date(dayStart.getTime() + 16 * H) },
    { key: "night", label: "รอบกลางคืน", time: "22:00–06:00", start: new Date(dayStart.getTime() + 16 * H), end: new Date(dayStart.getTime() + 24 * H) },
  ];
  const dayEnd = new Date(dayStart.getTime() + 24 * H);

  const [incs, activeLinks, upNow, slowNow, downLinksNow, openIncidentsNow, oaIssues, mobileAgentRows, scopedUrlRows] = await Promise.all([
    prisma.incident.findMany({
      where: {
        detectedAt: { gte: dayStart, lt: dayEnd },
        ...(scoped ? { link: { companyId: { in: companyIds } } } : {}),
      },
      include: { link: { include: { company: true } } },
      orderBy: { detectedAt: "asc" },
    }),
    prisma.link.count({ where: { isActive: true, ...(scoped ? { companyId: { in: companyIds } } : {}) } }),
    prisma.link.count({ where: { isActive: true, lastStatus: "UP", ...(scoped ? { companyId: { in: companyIds } } : {}) } }),
    prisma.link.count({ where: { isActive: true, lastStatus: "SLOW", ...(scoped ? { companyId: { in: companyIds } } : {}) } }),
    prisma.link.findMany({
      where: { isActive: true, lastStatus: "DOWN", ...(scoped ? { companyId: { in: companyIds } } : {}) },
      select: { companyId: true, url: true },
    }),
    prisma.incident.findMany({
      where: {
        status: { not: "CLOSED" },
        ...(scoped ? { link: { companyId: { in: companyIds } } } : {}),
      },
      orderBy: { detectedAt: "asc" },
      include: {
        link: { include: { company: true, lineGroup: true } },
      },
    }),
    prisma.lineGroup.count({
      where: {
        isActive: true,
        ...(scoped ? { companyId: { in: companyIds } } : {}),
        NOT: { channelAccessToken: null },
        oaStatus: { notIn: ["OK", "UNKNOWN"] },
      },
    }),
    prisma.mobileAgent.findMany({
      orderBy: [{ carrier: "asc" }, { name: "asc" }],
      include: {
        urlStatuses: true,
        networkIncidents: {
          where: {
            ...(scoped ? { link: { companyId: { in: companyIds } } } : {}),
            OR: [
              { status: { not: "CLOSED" } },
              { detectedAt: { gte: dayStart, lt: dayEnd } },
              { resolvedAt: { gte: dayStart, lt: dayEnd } },
            ],
          },
          include: {
            link: {
              include: {
                company: true,
                lineGroup: true,
              },
            },
          },
        },
      },
    }),
    prisma.link.findMany({
      where: { isActive: true, ...(scoped ? { companyId: { in: companyIds } } : {}) },
      select: { url: true },
    }),
  ]);
  const scopedUrls = new Set(scopedUrlRows.map((link) => normalizeReportUrl(link.url)));
  const downNow = downLinksNow.length;
  const downNowUnique = countUniqueCompanyUrls(downLinksNow);
  const currentOpenIncidents = openIncidentsNow.length;
  const reportNow = new Date();
  const currentOpenDetails = openIncidentsNow.map((incident) => ({
    id: incident.id,
    name: incident.link.name,
    company: incident.link.company.name,
    room: incident.link.lineGroup?.name || null,
    url: incident.link.url,
    detectedAt: incident.detectedAt.toISOString(),
    openMinutes: Math.max(
      1,
      Math.round((reportNow.getTime() - incident.detectedAt.getTime()) / 60000)
    ),
    carriedOver: incident.detectedAt < dayStart,
  }));

  const mobileAgents = mobileAgentRows.map((agent) => {
    const urlStatuses = agent.urlStatuses.filter((item) => scopedUrls.has(normalizeReportUrl(item.url)));
    const count = (status: "UP" | "SLOW" | "DOWN" | "UNKNOWN") =>
      urlStatuses.filter((item) => item.status === status).length;
    const latestCheck = urlStatuses.reduce<Date | null>((latest, item) =>
      !latest || item.checkedAt > latest ? item.checkedAt : latest, null);
    return {
      id: agent.id,
      name: agent.name,
      carrier: agent.carrier,
      reportedCarrier: agent.reportedCarrier,
      deviceLabel: agent.deviceLabel,
      appVersion: agent.appVersion,
      isActive: agent.isActive,
      online: Boolean(agent.isActive && agent.lastSeenAt && reportNow.getTime() - agent.lastSeenAt.getTime() < 12 * 60_000),
      lastSeenAt: agent.lastSeenAt?.toISOString() || null,
      lastCheckedAt: latestCheck?.toISOString() || null,
      totalUrls: urlStatuses.length,
      up: count("UP"),
      slow: count("SLOW"),
      down: count("DOWN"),
      unknown: count("UNKNOWN"),
      newIncidents: agent.networkIncidents.filter((item) => item.detectedAt >= dayStart && item.detectedAt < dayEnd).length,
      resolvedIncidents: agent.networkIncidents.filter((item) => item.resolvedAt && item.resolvedAt >= dayStart && item.resolvedAt < dayEnd).length,
      openIncidents: agent.networkIncidents.filter((item) => item.status !== "CLOSED").length,
    };
  });
  const mobileOpenDetails = mobileAgentRows.flatMap((agent) =>
    agent.networkIncidents
      .filter((incident) => incident.status !== "CLOSED")
      .map((incident) => ({
        id: incident.id,
        agentId: agent.id,
        agentName: agent.name,
        carrier: agent.reportedCarrier || agent.carrier,
        name: incident.link.name,
        company: incident.link.company.name,
        room: incident.link.lineGroup?.name || null,
        url: incident.link.url,
        detectedAt: incident.detectedAt.toISOString(),
        openMinutes: Math.max(1, Math.round((reportNow.getTime() - incident.detectedAt.getTime()) / 60000)),
      }))
  ).sort((a, b) => a.detectedAt.localeCompare(b.detectedAt));
  const mobileTotals = mobileAgents.reduce((total, agent) => ({
    agents: total.agents + 1,
    online: total.online + (agent.online ? 1 : 0),
    up: total.up + agent.up,
    slow: total.slow + agent.slow,
    down: total.down + agent.down,
    unknown: total.unknown + agent.unknown,
    openIncidents: total.openIncidents + agent.openIncidents,
  }), { agents: 0, online: 0, up: 0, slow: 0, down: 0, unknown: 0, openIncidents: 0 });

  const shiftOf = (d: Date): string => {
    const t = d.getTime();
    for (const b of bounds) if (t >= b.start.getTime() && t < b.end.getTime()) return b.key;
    return "night";
  };

  const shifts: ShiftReport[] = bounds.map((b) => {
    const inShift = incs.filter((i) => i.detectedAt.getTime() >= b.start.getTime() && i.detectedAt.getTime() < b.end.getTime());
    const resolved = inShift.filter((i) => i.status === "CLOSED").length;
    const problemLinks = new Set(inShift.map((i) => i.linkId)).size;
    const open = inShift.length - resolved;
    return {
      key: b.key,
      label: b.label,
      time: b.time,
      incidents: inShift.length,
      resolved,
      open,
      problemLinks,
      normalLinks: Math.max(0, activeLinks - problemLinks),
      allFixed: open === 0,
    };
  });

  const adminVals = incs.map((i) => i.adminResponseMin).filter((v): v is number => v !== null);
  const itVals = incs.map((i) => i.itResponseMin).filter((v): v is number => v !== null);
  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);

  const totalResolved = incs.filter((i) => i.status === "CLOSED").length;
  const totalOpen = incs.length - totalResolved;

  const dateLabel = new Date(`${dateStr}T12:00:00+07:00`).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const isToday = dateStr === todayBangkok();

  return {
    date: dateStr,
    dateLabel,
    scopeLabel: options?.scopeLabel,
    isToday,
    activeLinks,
    upNow,
    slowNow,
    downNow,
    downNowUnique,
    currentOpenIncidents,
    currentOpenDetails,
    oaIssues,
    mobileTotals,
    mobileAgents,
    mobileOpenDetails,
    totalIncidents: incs.length,
    totalResolved,
    totalOpen,
    avgAdminMin: avg(adminVals),
    avgItMin: avg(itVals),
    // ดูย้อนหลัง: ตัดสินจากเคสในวันนั้นเท่านั้น (ไม่เอาสถานะ "ล่มตอนนี้" มาปน)
    allClear: isToday
      ? currentOpenIncidents === 0 && downNowUnique === 0 && mobileTotals.openIncidents === 0
      : totalOpen === 0,
    shifts,
    incidents: incs.map((i) => ({
      name: i.link.name,
      company: i.link.company.name,
      shift: shiftOf(i.detectedAt),
      detectedAt: i.detectedAt.toISOString(),
      status: i.status,
      adminResponseMin: i.adminResponseMin,
      itResponseMin: i.itResponseMin,
    })),
  };
}

export function countUniqueCompanyUrls(
  links: Array<{ companyId: string; url: string }>
): number {
  return new Set(
    links.map((link) => `${link.companyId}\u0000${normalizeReportUrl(link.url)}`)
  ).size;
}

function normalizeReportUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}
