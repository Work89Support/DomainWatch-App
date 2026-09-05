import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canViewIncidents } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export default async function CaseHistory({ searchParams: p }: { searchParams: { q?: string; from?: string; to?: string; source?: string; page?: string } }) {
  const me = await requireUser();
  if (!canViewIncidents(me.role)) redirect("/");
  const page = Math.max(1, parseInt(p.page || "1", 10) || 1);
  const start = p.from ? new Date(`${p.from}T00:00:00+07:00`) : undefined;
  const end = p.to ? new Date(`${p.to}T23:59:59.999+07:00`) : undefined;
  if ((start && isNaN(+start)) || (end && isNaN(+end)) || (start && end && start > end)) return <div className="p-8">ช่วงวันที่ไม่ถูกต้อง <Link href="/case-history">ล้างตัวกรอง</Link></div>;
  const where = {
    ...(p.source === "SYSTEM" || p.source === "MOBILE" ? { source: p.source } : {}),
    ...(p.q ? { OR: ["caseId", "actorName", "linkName", "companyName", "note"].map(key => ({ [key]: { contains: p.q!, mode: "insensitive" as const } })) } : {}),
    ...(start || end ? { createdAt: { gte: start, lte: end } } : {}),
  };
  const [total, events] = await prisma.$transaction([prisma.caseActivity.count({ where }), prisma.caseActivity.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 50, take: 50 })]);
  function pageUrl(n: number) { const query = new URLSearchParams(); for (const [k, v] of Object.entries(p)) if (v) query.set(k, v); query.set("page", String(n)); return `/case-history?${query}`; }
  return <main className="mx-auto max-w-7xl p-6 md:p-8">
    <h1 className="text-2xl font-bold">ประวัติการดำเนินการย้อนหลัง</h1>
    <p className="mt-2 text-sm text-slate-500">เก็บผู้ทำรายการ เวลา และข้อมูลขณะเกิดเหตุ · ประวัติยังอยู่แม้ลิงก์หรือเครื่องถูกลบ · เริ่มบันทึกละเอียดตั้งแต่เปิดใช้รุ่นนี้</p>
    <Link className="my-3 inline-block text-brand-600" href="/incidents">← กลับหน้าเหตุการณ์</Link>
    <form className="card mb-5 grid gap-3 p-4 md:grid-cols-5">
      <label className="text-sm">ค้นเคส / คน / บริษัท<input className="input" name="q" defaultValue={p.q} /></label>
      <label className="text-sm">จากวันที่<input className="input" type="date" name="from" defaultValue={p.from} /></label>
      <label className="text-sm">ถึงวันที่<input className="input" type="date" name="to" defaultValue={p.to} /></label>
      <label className="text-sm">แหล่งตรวจ<select className="input" name="source" defaultValue={p.source || ""}><option value="">ทั้งหมด</option><option value="SYSTEM">ระบบกลาง</option><option value="MOBILE">เครือข่ายซิม</option></select></label>
      <button className="btn-primary self-end">ค้นประวัติ</button>
    </form>
    <p className="mb-3 text-sm">ทั้งหมด {total.toLocaleString("th-TH")} รายการดำเนินการ · หน้า {page} / {Math.max(1, Math.ceil(total / 50))} (หนึ่งเคสมีได้หลายรายการ)</p>
    <div className="space-y-3">{events.map(e => <article key={e.id} className="card p-4 text-sm">
      <div className="font-semibold">{e.linkName} · {e.companyName} · {e.source === "MOBILE" ? "เครือข่ายซิม" : "ระบบกลาง"}</div>
      <p className="mt-1">{e.actorName} · {fmtDateTime(e.createdAt)}</p><p className="mt-2">{e.note}</p>
      <p className="mt-1 break-all text-xs text-slate-500">#{e.caseId} · URL ขณะทำรายการ: {e.url}</p>
      {e.details && <details className="mt-2"><summary className="cursor-pointer text-brand-600">ดูหลักฐานก่อน / หลัง</summary><pre className="whitespace-pre-wrap break-all rounded bg-slate-50 p-3 text-xs">{JSON.stringify(e.details, null, 2)}</pre></details>}
      <Link className="mt-2 inline-block text-brand-600" href={`/incidents?incident=${e.caseId}`}>เปิดเคส (หากยังอยู่ในระบบ) →</Link>
    </article>)}</div>
    {!events.length && <div className="card p-8">ไม่พบประวัติตามเงื่อนไข ข้อมูลเก่าที่ไม่มีบันทึกละเอียดดูได้จากหน้าเหตุการณ์</div>}
    <nav className="mt-5 flex gap-5">{page > 1 && <Link href={pageUrl(page - 1)}>← ก่อนหน้า</Link>}{page * 50 < total && <Link href={pageUrl(page + 1)}>ถัดไป →</Link>}</nav>
  </main>;
}
