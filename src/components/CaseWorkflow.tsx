"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDateTime } from "@/lib/format";
import { activeWaiting, WAIT_IMPACTS } from "@/lib/caseWaiting";
import { caseStage, CASE_STAGE_LABELS, CaseStage } from "@/lib/caseStage";

type Event = { id: string; createdAt: string; actorName: string; action: string; note: string; url: string; details: unknown };
export default function CaseWorkflow({ id, source, status, detectedAt, ackAt, owner, resolvedAt, adminUpdatedAt, canAct, waitingDetails, itResolvedAt, stage }: {
  id: string; source: "SYSTEM" | "MOBILE"; status: string; detectedAt: string; ackAt?: string | null;
  owner?: string | null; resolvedAt: string | null; adminUpdatedAt?: string | null; canAct: boolean;
  waitingDetails?: unknown; itResolvedAt?: string | null;
  stage?: CaseStage;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [waitingForm, setWaitingForm] = useState(false);
  const [forwardForm, setForwardForm] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [forwardNote, setForwardNote] = useState("");
  const [until, setUntil] = useState("");
  const [impact, setImpact] = useState(WAIT_IMPACTS[2]);
  const waiting = activeWaiting({ status, waitingDetails, adminUpdatedAt, itResolvedAt });
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
      const res = await fetch(`/api/cases/${source}/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note: action === "FORWARD" ? forwardNote : note, ...(action === "FORWARD" ? { recipient } : {}), ...(action === "WAIT" ? { until: until ? new Date(until).toISOString() : "", impact } : {}) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่ได้");
      setNote(""); setWaitingForm(false); setForwardForm(false); setExpanded(true); await load(); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "เชื่อมต่อไม่ได้"); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 rounded-xl border border-slate-200 p-3 text-xs">
    <div className="font-semibold text-slate-700">{CASE_STAGE_LABELS[stage || caseStage({ status, waitingDetails, adminUpdatedAt, itResolvedAt, adminAckAt: ackAt })]}</div>
    {waiting && <div className="my-2 rounded-lg bg-amber-50 p-3 text-amber-900">{waiting.kind === "forwarded" && <p className="break-words">ส่งให้: {waiting.recipient} · แอดมินเดิมติดตามเอง</p>}<p className="whitespace-pre-wrap break-words">{waiting.kind === "forwarded" ? "งานที่ส่งต่อ" : "เหตุผล"}: {waiting.reason}</p><p>ผู้บันทึก: {waiting.owner} · เวลา: {fmtDateTime(waiting.since)}</p>{waiting.until && <p>ติดตามครั้งถัดไป: {fmtDateTime(waiting.until)} {Date.parse(waiting.until) < Date.now() ? "⚠ เลยเวลาติดตามแล้ว" : ""}</p>}<p>{waiting.impact} · ยังนับเวลา KPI ตามปกติ</p></div>}
    <div className="mt-1 text-slate-500">ผู้รับผิดชอบ: {owner || "ยังไม่ระบุ"} · รับเรื่อง: {ackAt ? fmtDateTime(ackAt) : "ยังไม่มีเวลารับเรื่อง"}</div>
    <div className="mt-1 text-slate-500">ตรวจพบ: {fmtDateTime(detectedAt)} · ปิดเคส: {resolvedAt ? fmtDateTime(resolvedAt) : "ยังไม่ปิด"}</div>
    {adminUpdatedAt && <div className="mt-1 text-slate-600">แอดมินบันทึกแก้เสร็จ: {fmtDateTime(adminUpdatedAt)} · {status === "CLOSED" ? "ตรวจยืนยันแล้ว" : "รอเครื่องตรวจยืนยัน — ยังไม่รับรอง KPI"}</div>}
    <div className="mt-2 flex flex-wrap gap-2">
      {canAct && !closed && !ackAt && <button disabled={busy} className="btn-primary text-xs" onClick={() => act("ACK")}>รับเคสนี้</button>}
      {canAct && ackAt && ["OPEN", "IT_RESOLVED"].includes(status) && <button className="btn-primary text-xs" disabled={busy} onClick={() => { setRecipient(waiting?.recipient || ""); setForwardNote(waiting?.kind === "forwarded" ? waiting.reason : ""); setWaitingForm(false); setForwardForm(!forwardForm); }}>ส่งต่อแล้ว — รอติดตาม</button>}
      {canAct && ackAt && ["OPEN", "IT_RESOLVED"].includes(status) && <><button className="btn-ghost text-xs" disabled={busy} onClick={() => { setNote(waiting?.reason || ""); setWaitingForm(!waitingForm); }}> {waiting ? "แก้เหตุผล / เวลาติดตาม" : "ระบุรอแก้ไข"}</button>{waiting && <button className="btn-ghost text-xs" disabled={busy} onClick={() => act("RESUME")}>กลับมาดำเนินการต่อ</button>}</>}
      <button className="btn-ghost text-xs" disabled={busy} onClick={() => { setExpanded(!expanded); if (!expanded) void load(); }}> {expanded ? "ซ่อนประวัติ" : "ประวัติ / บันทึก / ส่งต่อ →"}</button>
    </div>
    {error && <p role="alert" className="mt-2 text-red-600">{error}</p>}
    {forwardForm && <div className="mt-3 space-y-2 rounded-lg bg-blue-50 p-3"><label className="block">ส่งให้ใคร / ทีมไหน<input className="input" maxLength={200} value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="เช่น ทีมไอที" /></label><label className="block">งานที่ส่งต่อ<textarea className="input" rows={4} maxLength={2000} value={forwardNote} onChange={e => setForwardNote(e.target.value)} placeholder="เช่น รอจดโดเมนใหม่และแจ้งลิงก์กลับ" /></label><p>บันทึกสถานะเท่านั้น แอดมินเดิมติดตามเอง ไม่แจ้งทีมปลายทางอัตโนมัติ ไม่เปลี่ยนเจ้าของ ไม่ปิดเคส และไม่หยุด KPI</p><div className="flex gap-2"><button className="btn-primary text-xs" disabled={busy || !recipient.trim() || !forwardNote.trim()} onClick={() => act("FORWARD")}>บันทึกส่งต่อแล้ว</button><button className="btn-ghost text-xs" disabled={busy} onClick={() => setForwardForm(false)}>ยกเลิก</button></div></div>}
    {waitingForm && <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3"><label className="block">เหตุผลที่รอ เช่น รอจดโดเมนใหม่ / รอไอที<textarea className="input" rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label><label className="block">เวลาติดตามครั้งถัดไป (เวลาของอุปกรณ์นี้)<input type="datetime-local" className="input" value={until} onChange={e => setUntil(e.target.value)} /></label><label className="block">ผลกระทบต่อลูกค้า<select className="input" value={impact} onChange={e => setImpact(e.target.value)}>{WAIT_IMPACTS.map(v => <option key={v}>{v}</option>)}</select></label><p>ผู้รับเคสเป็นผู้บันทึก · ไม่หยุด KPI · ไม่มีการปิดเคสหรือหยุดตรวจลิงก์</p><button disabled={busy || !note.trim() || !until} className="btn-primary text-xs" onClick={() => act("WAIT")}>บันทึกรอแก้ไข</button></div>}
    {expanded && <div className="mt-3 space-y-3">
      {busy && <p>กำลังโหลด...</p>}
      {!busy && !events.length && <p className="text-slate-500">ยังไม่มีบันทึกรายการแบบละเอียด ข้อมูลเก่าแสดงตามเวลาที่มีจริงด้านบน</p>}
      {events.map(e => <div key={e.id} className="border-l-2 border-brand-200 pl-3"><b>{e.actorName}</b> · {fmtDateTime(e.createdAt)}<p>{e.note}</p><p className="break-all text-slate-400">URL ขณะทำรายการ: {e.url}</p>{e.details != null && <details><summary className="cursor-pointer text-brand-600">หลักฐานก่อน / หลัง</summary><pre className="whitespace-pre-wrap break-all rounded bg-slate-50 p-2">{JSON.stringify(e.details, null, 2)}</pre></details>}</div>)}
      {total > 50 && <div className="flex gap-2"><button disabled={busy || page === 1} onClick={() => load(page - 1)}>← ก่อนหน้า</button><span>{page} / {Math.ceil(total / 50)}</span><button disabled={busy || page * 50 >= total} onClick={() => load(page + 1)}>ถัดไป →</button></div>}
      {canAct && !closed && <><label className="block">บันทึกงาน / ผลการติดตาม<textarea maxLength={2000} className="input mt-1" value={note} onChange={e => setNote(e.target.value)} /></label><button disabled={busy || !note.trim()} className="btn-ghost text-xs" onClick={() => act("NOTE")}>บันทึกประวัติ</button><p className="text-slate-500">หากต้องการเปลี่ยนสถานะส่งต่อ ให้ใช้ปุ่ม “ส่งต่อแล้ว — รอติดตาม” ด้านบน</p></>}
    </div>}
  </div>;
}
