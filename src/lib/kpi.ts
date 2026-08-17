import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type DashboardData = {
  totalLinks: number;
  activeLinks: number;
  upCount: number;
  slowCount: number;
  downCount: number;
  downUniqueCount: number;
  unknownCount: number;
  openIncidents: number;
  incidents30d: number;
  avgAdminMin: number | null;
  avgItMin: number | null;
  categoryBreakdown: { category: string; up: number; slow: number; down: number; total: number }[];
  companyBreakdown: {
    companyId: string;
    company: string;
    total: number;
    up: number;
    slow: number;
    down: number;
    openIncidents: number;
  }[];
  incidentsPerDay: { date: string; count: number }[];
  recentIncidents: {
    id: string;
    linkName: string;
    company: string;
    url: string;
    status: string;
    detectedAt: string;
    adminResponseMin: number | null;
    itResponseMin: number | null;
  }[];
  // มิติไอที: ลิงก์สำรอง
  linksWithBackup: number;
  linksWithoutBackup: { id: string; name: string; company: string }[];
  // มิติแอดมิน: คิวที่ต้องอัพเดต (ลิงก์ที่ล่ม)
  updateQueue: {
    incidentId: string;
    linkName: string;
    company: string;
    room: string | null;
    url: string;
    hasBackup: boolean;
    detectedAt: string;
  }[];
};

// companyId = undefined => รวมทุกบริษัท
export async function getDashboardData(companyId?: string, allowedCompanyIds?: string[]): Promise<DashboardData> {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const companyScope = companyId ? { equals: companyId } : allowedCompanyIds ? { in: allowedCompanyIds } : undefined;
  const linkWhere: Prisma.LinkWhereInput = companyScope ? { companyId: companyScope } : {};
  const incWhere: Prisma.IncidentWhereInput = companyScope ? { link: { companyId: companyScope } } : {};

  const [links, companies, incidents30d, closedWithKpi, recent] =
    await Promise.all([
      prisma.link.findMany({ where: linkWhere, include: { company: true } }),
      prisma.company.findMany({
        where: allowedCompanyIds ? { id: { in: allowedCompanyIds } } : {},
        orderBy: { createdAt: "asc" },
      }),
      prisma.incident.count({ where: { ...incWhere, detectedAt: { gte: since30 } } }),
      prisma.incident.findMany({
        where: { ...incWhere, detectedAt: { gte: since30 } },
        select: { adminResponseMin: true, itResponseMin: true },
      }),
      prisma.incident.findMany({
        where: incWhere,
        orderBy: { detectedAt: "desc" },
        take: 8,
        include: { link: { include: { company: true } } },
      }),
    ]);

  // นับเฉพาะลิงก์ที่ "เฝ้าดูอยู่" (isActive) — ลิงก์ LINE ที่ตั้งไม่เฝ้าดูจะไม่ถูกนับสถานะ/สำรอง
  const activeArr = links.filter((l) => l.isActive);

  // มิติไอที: ลิงก์สำรอง (เฉพาะลิงก์ที่เฝ้าดู)
  const hasBk = (l: (typeof links)[number]) => !!(l.backupUrl && l.backupUrl.trim());
  const linksWithBackup = activeArr.filter(hasBk).length;
  const linksWithoutBackup = activeArr
    .filter((l) => !hasBk(l))
    .map((l) => ({ id: l.id, name: l.name, company: l.company.name }));

  // มิติแอดมิน: คิวลิงก์ที่ล่ม (เคสที่ยังไม่ปิด)
  const openQueueList = await prisma.incident.findMany({
    where: { ...incWhere, status: { not: "CLOSED" } },
    orderBy: { detectedAt: "desc" },
    include: { link: { include: { company: true, lineGroup: true } } },
  });
  // URL เดียวกันแต่คนละห้อง LINE ต้องเป็นคนละงานของแอดมิน
  const updateQueue = openQueueList.map((i) => ({
    incidentId: i.id,
    linkName: i.link.name,
    company: i.link.company.name,
    room: i.link.lineGroup?.name || null,
    url: i.link.url,
    hasBackup: !!(i.link.backupUrl && i.link.backupUrl.trim()),
    detectedAt: i.detectedAt.toISOString(),
  }));
  const openIncidents = openQueueList.length;

  const upCount = activeArr.filter((l) => l.lastStatus === "UP").length;
  const slowCount = activeArr.filter((l) => l.lastStatus === "SLOW").length;
  const downCount = activeArr.filter((l) => l.lastStatus === "DOWN").length;
  const downUniqueCount = new Set(
    activeArr
      .filter((l) => l.lastStatus === "DOWN")
      .map((l) => `${l.companyId}\u0000${normalizeDashboardUrl(l.url)}`)
  ).size;
  const unknownCount = activeArr.filter((l) => l.lastStatus === "UNKNOWN").length;
  const activeLinks = activeArr.length;

  const adminVals = closedWithKpi
    .map((i) => i.adminResponseMin)
    .filter((v): v is number => v !== null);
  const itVals = closedWithKpi
    .map((i) => i.itResponseMin)
    .filter((v): v is number => v !== null);
  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  // แยกตามหมวด (เฉพาะลิงก์ที่เฝ้าดู)
  const catMap = new Map<string, { up: number; slow: number; down: number; total: number }>();
  for (const l of activeArr) {
    const c = l.category || "ทั่วไป";
    const cur = catMap.get(c) || { up: 0, slow: 0, down: 0, total: 0 };
    cur.total++;
    if (l.lastStatus === "UP") cur.up++;
    if (l.lastStatus === "SLOW") cur.slow++;
    if (l.lastStatus === "DOWN") cur.down++;
    catMap.set(c, cur);
  }
  const categoryBreakdown = Array.from(catMap.entries()).map(([category, v]) => ({
    category,
    ...v,
  }));

  // แยกตามบริษัท (เฉพาะเมื่อดูรวมทุกบริษัท จะได้เห็นภาพเทียบกัน)
  const openByCompany = new Map<string, number>();
  const openList = await prisma.incident.findMany({
    where: { ...incWhere, status: { not: "CLOSED" } },
    select: { link: { select: { companyId: true, url: true } } },
  });
  for (const o of openList) {
    const cid = o.link.companyId;
    openByCompany.set(cid, (openByCompany.get(cid) || 0) + 1);
  }
  const companyBreakdown = companies
    .map((co) => {
      const cl = activeArr.filter((l) => l.companyId === co.id);
      return {
        companyId: co.id,
        company: co.name,
        total: cl.length,
        up: cl.filter((l) => l.lastStatus === "UP").length,
        slow: cl.filter((l) => l.lastStatus === "SLOW").length,
        down: cl.filter((l) => l.lastStatus === "DOWN").length,
        openIncidents: openByCompany.get(co.id) || 0,
      };
    })
    .filter((c) => (companyId ? c.companyId === companyId : true));

  // incident ต่อวัน 14 วันล่าสุด
  const since14 = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
  const incs14 = await prisma.incident.findMany({
    where: { ...incWhere, detectedAt: { gte: since14 } },
    select: { detectedAt: true },
  });
  const dayMap = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since14.getTime() + i * 24 * 60 * 60 * 1000);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const inc of incs14) {
    const key = inc.detectedAt.toISOString().slice(0, 10);
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) || 0) + 1);
  }
  const incidentsPerDay = Array.from(dayMap.entries()).map(([date, count]) => ({
    date: date.slice(5),
    count,
  }));

  return {
    totalLinks: links.length,
    activeLinks,
    upCount,
    slowCount,
    downCount,
    downUniqueCount,
    unknownCount,
    openIncidents,
    incidents30d,
    avgAdminMin: avg(adminVals),
    avgItMin: avg(itVals),
    categoryBreakdown,
    companyBreakdown,
    incidentsPerDay,
    recentIncidents: recent.map((i) => ({
      id: i.id,
      linkName: i.link.name,
      company: i.link.company.name,
      url: i.link.url,
      status: i.status,
      detectedAt: i.detectedAt.toISOString(),
      adminResponseMin: i.adminResponseMin,
      itResponseMin: i.itResponseMin,
    })),
    linksWithBackup,
    linksWithoutBackup,
    updateQueue,
  };
}

function normalizeDashboardUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}
