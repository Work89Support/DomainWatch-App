import { prisma } from "@/lib/prisma";

export type UserStat = {
  userId: string;
  name: string;
  role: string;
  adminCount: number;
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
};

export type TrendPoint = {
  week: string; // MM/DD (จันทร์ต้นสัปดาห์)
  incidents: number;
  adminAvg: number | null;
  itAvg: number | null;
};

export type UserKpiData = {
  users: UserStat[];
  log: IncidentLogRow[];
  trend: TrendPoint[];
  totals: { incidents: number; resolved: number; avgAdmin: number | null; avgIt: number | null };
};

const avg = (arr: number[]) =>
  arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

function startOfWeek(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; // 0 = จันทร์
  x.setUTCDate(x.getUTCDate() - day);
  return x;
}

export async function getUserKpi(): Promise<UserKpiData> {
  const [users, incidents] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.incident.findMany({
      orderBy: { detectedAt: "desc" },
      include: { link: { include: { company: true } }, adminUser: true, itUser: true },
    }),
  ]);

  // ---- สรุปรายคน ----
  const users_ = users.map((u) => {
    const asAdmin = incidents.filter(
      (i) => i.adminUserId === u.id && i.adminResponseMin !== null
    );
    const asIt = incidents.filter(
      (i) => i.itUserId === u.id && i.itResponseMin !== null
    );
    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      adminCount: asAdmin.length,
      adminAvgMin: avg(asAdmin.map((i) => i.adminResponseMin as number)),
      itCount: asIt.length,
      itAvgMin: avg(asIt.map((i) => i.itResponseMin as number)),
      totalHandled: asAdmin.length + asIt.length,
    };
  })
    .sort((a, b) => b.totalHandled - a.totalHandled);

  // ---- ประวัติรายเคส ----
  const log: IncidentLogRow[] = incidents.slice(0, 60).map((i) => ({
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
  }));

  // ---- แนวโน้ม 8 สัปดาห์ ----
  const now = new Date();
  const thisWeek = startOfWeek(now);
  const buckets: { key: number; label: string; inc: number[]; adm: number[]; it: number[] }[] = [];
  for (let i = 7; i >= 0; i--) {
    const ws = new Date(thisWeek);
    ws.setUTCDate(ws.getUTCDate() - i * 7);
    const mm = String(ws.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(ws.getUTCDate()).padStart(2, "0");
    buckets.push({ key: ws.getTime(), label: `${mm}/${dd}`, inc: [], adm: [], it: [] });
  }
  for (const i of incidents) {
    const ws = startOfWeek(i.detectedAt).getTime();
    const b = buckets.find((x) => x.key === ws);
    if (b) {
      b.inc.push(1);
      if (i.adminResponseMin !== null) b.adm.push(i.adminResponseMin);
      if (i.itResponseMin !== null) b.it.push(i.itResponseMin);
    }
  }
  const trend: TrendPoint[] = buckets.map((b) => ({
    week: b.label,
    incidents: b.inc.length,
    adminAvg: avg(b.adm),
    itAvg: avg(b.it),
  }));

  const allAdmin = incidents.map((i) => i.adminResponseMin).filter((v): v is number => v !== null);
  const allIt = incidents.map((i) => i.itResponseMin).filter((v): v is number => v !== null);

  return {
    users: users_,
    log,
    trend,
    totals: {
      incidents: incidents.length,
      resolved: incidents.filter((i) => i.status === "CLOSED").length,
      avgAdmin: avg(allAdmin),
      avgIt: avg(allIt),
    },
  };
}
