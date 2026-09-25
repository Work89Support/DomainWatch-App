"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AgentOwner({ agentId, ownerId, ownerName, staff, canManage }: {
  agentId: string; ownerId: string | null; ownerName: string | null;
  staff: { id: string; name: string }[]; canManage: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(ownerId || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/mobile-agents/${agentId}/owner`, { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: value || null, expectedOwnerId: ownerId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setMessage("บันทึกผู้ดูแลแล้ว"); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
    <p>ผู้ดูแลเครื่อง: <strong>{ownerName || "ยังไม่กำหนด"}</strong></p>
    {canManage && <div className="flex flex-wrap gap-2 mt-2">
      <select aria-label="ผู้ดูแลเครื่องตรวจ" className="input" value={value} disabled={busy} onChange={e => setValue(e.target.value)}>
        <option value="">ยังไม่กำหนด</option>
        {ownerId && !staff.some(u => u.id === ownerId) && <option value={ownerId}>{ownerName} (ไม่พร้อมรับงาน)</option>}
        {staff.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <button className="btn-primary" disabled={busy || value === (ownerId || "")} onClick={save}>บันทึกผู้ดูแล</button>
    </div>}
    <p className="text-xs text-slate-500 mt-2">ผูกกับเครื่อง ไม่เปลี่ยนผู้ดูแลเมื่อสลับซิม · ไม่ย้ายผลงานแก้เคสย้อนหลัง</p>
    {message && <p role="status" className="mt-2">{message}</p>}
  </div>;
}
