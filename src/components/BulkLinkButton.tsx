"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id: string; name: string; room: string; url: string; backupUrl: string | null; updatedAt: string };
type Preview = { companyId: string; oldUrl: string; canMain: boolean; links: Item[] };

export default function BulkLinkButton({ linkId, companyName }: { linkId: string; companyName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [field, setField] = useState("backupUrl");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function load() {
    setOpen(true); setData(null); setBusy(true); setError(""); setSuccess(""); setReview(false); setValue(""); setNote(""); setField("backupUrl");
    try {
      const res = await fetch(`/api/links/bulk?id=${encodeURIComponent(linkId)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setData(body); setSelected(body.links.map((l: Item) => l.id));
    } catch (e) { setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!data || busy) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/links/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId: data.companyId, oldUrl: data.oldUrl, field, value, note, links: data.links.filter(l => selected.includes(l.id)).map(l => ({ id: l.id, updatedAt: l.updatedAt })) }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setSuccess(`บันทึก ${body.count} รายการแล้ว เคสที่เกี่ยวข้องรอตรวจยืนยัน`); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  function preview() {
    try { if (!["http:", "https:"].includes(new URL(value.trim()).protocol)) throw new Error(); }
    catch { setError("กรุณาใส่ URL เต็มที่ขึ้นต้นด้วย https:// หรือ http://"); return; }
    setError(""); setReview(true);
  }
  return <>
    <button type="button" className="text-brand-600 hover:underline text-xs mr-3" onClick={load}>แก้ลิงก์เดียวกันหลายห้อง</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 text-left whitespace-normal">
      <div role="dialog" aria-modal="true" aria-label="แก้ลิงก์พร้อมกัน" className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5">
        <h3 className="text-lg font-semibold">แก้ลิงก์พร้อมกัน — {companyName}</h3>
        <p className="my-2 text-sm text-slate-500">เฉพาะ URL เดียวกันในบริษัทนี้ ไม่รวมรายการที่พัก ไม่เปลี่ยน Rich Menu ใน LINE หรือสร้าง Redirect อัตโนมัติ</p>
        {error && <p role="alert" className="my-2 text-red-600">{error}</p>}
        {success ? <p role="status" className="my-4 text-emerald-700">{success}</p> : data && <>
          <p className="text-sm break-all mb-3">ลิงก์เดิม: {data.oldUrl}</p>
          {!review && <>
            <label className="label">ต้องการแก้อะไร</label>
            <select aria-label="ประเภทการแก้ไข" className="input" value={field} onChange={e => setField(e.target.value)}><option value="backupUrl">ตั้งลิงก์สำรอง</option>{data.canMain && <option value="url">เปลี่ยนลิงก์หลัก</option>}</select>
            <label className="label mt-3">URL ใหม่</label><input aria-label="URL ใหม่" className="input" value={value} onChange={e => setValue(e.target.value)} placeholder="https://…" />
            <label className="label mt-3">หมายเหตุการแก้ครั้งนี้ (ไม่ทับหมายเหตุเดิม)</label><textarea aria-label="หมายเหตุการแก้ครั้งนี้" className="input" rows={4} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} />
            <label className="flex gap-2 my-3"><input type="checkbox" checked={data.links.length > 0 && selected.length === data.links.length} onChange={e => setSelected(e.target.checked ? data.links.map(l => l.id) : [])} />เลือกทั้งหมด ({data.links.length} รายการ)</label>
          </>}
          <div className="space-y-2 my-3">{data.links.filter(l => !review || selected.includes(l.id)).map(l => <label key={l.id} className="block border rounded-xl p-3 text-sm break-all">
            {!review && <input type="checkbox" className="mr-2" checked={selected.includes(l.id)} onChange={e => setSelected(e.target.checked ? [...selected, l.id] : selected.filter(id => id !== l.id))} />}
            <strong>{l.room}</strong> · {l.name}
            <div className="text-slate-500">เดิม: {field === "url" ? l.url : l.backupUrl || "ยังไม่มีลิงก์สำรอง"}</div>
            {review && <div className="text-brand-700">ใหม่: {value.trim()}</div>}
          </label>)}</div>
          {review && <p className="text-sm my-3">ยืนยันแก้ {selected.length} รายการ เคสจะยังไม่ปิดจนกว่าระบบตรวจยืนยัน {note && `· หมายเหตุ: ${note}`}</p>}
          <div className="flex gap-2 justify-end">{review ? <><button disabled={busy} className="btn-ghost" onClick={() => setReview(false)}>กลับไปแก้</button><button disabled={busy} className="btn-primary" onClick={save}>{busy ? "กำลังบันทึก…" : "ยืนยันบันทึก"}</button></> : <button disabled={busy || !selected.length || !value.trim()} className="btn-primary" onClick={preview}>ตรวจสอบก่อนบันทึก</button>}</div>
        </>}
        <button disabled={busy} className="btn-ghost mt-3" onClick={() => setOpen(false)}>{success ? "ปิด" : "ยกเลิก"}</button>
        {busy && !data && <p>กำลังโหลด…</p>}
      </div>
    </div>}
  </>;
}
