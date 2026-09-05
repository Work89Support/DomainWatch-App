"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDateTime } from "@/lib/format";

type Event = { id: string; createdAt: string; actorName: string; action: string; note: string; url: string; details: unknown };
export default function CaseWorkflow({ id, source, status, detectedAt, ackAt, owner, resolvedAt, canAct }: {
  id: string; source: "SYSTEM" | "MOBILE"; status: string; detectedAt: string; ackAt?: string | null;
  owner?: string | null; resolvedAt: string | null; canAct: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const closed = status === "CLOSED" || status === "PAUSED";
  async function load(p = 1) {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/case-history?caseId=${id}&source=${source}&page=${p}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดประวัติไม่ได้");
      setEvents(data.events); setTotal(data.total); setPage(p);
    } catch (e) { setError(e instanceof Error ? e.message : "เชื่อมต่อไม่ได้"); }
    finally { setBusy(false); }
  }
  async function act(action: string) {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/cases/${source}/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่ได้");
      setNote(""); setExpanded(true); await load(); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "เชื่อมต่อไม่ได้"); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 rounded-xl border border-slate-200 p-3 text-xs">
    <div className="font-semibold text-slate-700">{closed ? status === "PAUSED" ? "พักการเฝ้าดู · เก็บประวัติ" : "ปิดเคสแล้ว" : status === "ADMIN_UPDATED" ? "ปรับแก้แล้ว · รอตรวจยืนยัน" : ackAt ? "รับเรื่องแล้ว · กำลังดำเนินการ" : "รอรับเรื่อง"}</div>
    <div className="mt-1 text-slate-500">ผู้รับผิดชอบ: {owner || "ยังไม่ระบุ"} · รับเรื่อง: {ackAt ? fmtDateTime(ackAt) : "ยังไม่มีเวลารับเรื่อง"}</div>
    <div className="mt-1 text-slate-500">ตรวจพบ: {fmtDateTime(detectedAt)} · ปิดเคส: {resolvedAt ? fmtDateTime(resolvedAt) : "ยังไม่ปิด"}</div>
    <div className="mt-2 flex flex-wrap gap-2">
      {canAct && !closed && !ackAt && <button disabled={busy} className="btn-primary text-xs" onClick={() => act("ACK")}>รับเคสนี้</button>}
      <button className="btn-ghost text-xs" disabled={busy} onClick={() => { setExpanded(!expanded); if (!expanded) void load(); }}> {expanded ? "ซ่อนประวัติ" : "ประวัติ / บันทึก / ส่งต่อ →"}</button>
    </div>
    {error && <p role="alert" className="mt-2 text-red-600">{error}</p>}
    {expanded && <div className="mt-3 space-y-3">
      {busy && <p>กำลังโหลด...</p>}
      {!busy && !events.length && <p className="text-slate-500">ยังไม่มีบันทึกรายการแบบละเอียด ข้อมูลเก่าแสดงตามเวลาที่มีจริงด้านบน</p>}
      {events.map(e => <div key={e.id} className="border-l-2 border-brand-200 pl-3"><b>{e.actorName}</b> · {fmtDateTime(e.createdAt)}<p>{e.note}</p><p className="break-all text-slate-400">URL ขณะทำรายการ: {e.url}</p>{e.details != null && <details><summary className="cursor-pointer text-brand-600">หลักฐานก่อน / หลัง</summary><pre className="whitespace-pre-wrap break-all rounded bg-slate-50 p-2">{JSON.stringify(e.details, null, 2)}</pre></details>}</div>)}
      {total > 50 && <div className="flex gap-2"><button disabled={busy || page === 1} onClick={() => load(page - 1)}>← ก่อนหน้า</button><span>{page} / {Math.ceil(total / 50)}</span><button disabled={busy || page * 50 >= total} onClick={() => load(page + 1)}>ถัดไป →</button></div>}
      {canAct && !closed && <><label className="block">บันทึกงาน / ส่งต่อ (ระบุผู้รับและเหตุผล)<textarea maxLength={2000} className="input mt-1" value={note} onChange={e => setNote(e.target.value)} /></label><div className="flex gap-2"><button disabled={busy || !note.trim()} className="btn-ghost text-xs" onClick={() => act("NOTE")}>บันทึกประวัติ</button><button disabled={busy || !note.trim()} className="btn-primary text-xs" onClick={() => act("ESCALATE")}>บันทึกส่งต่อผู้รับผิดชอบ</button></div><p className="text-slate-500">การส่งต่อเป็นบันทึกในระบบ กรุณาติดต่อผู้รับโดยตรงด้วย</p></>}
    </div>}
  </div>;
}
