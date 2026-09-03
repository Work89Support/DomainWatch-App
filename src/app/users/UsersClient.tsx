"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { canManageUserRole, ROLE_LABELS, ROLES, type AppRole } from "@/lib/permissions";

type U = {
  id: string; name: string; username: string; role: AppRole; isActive: boolean;
  allowedIpRanges: string | null; lastLoginIp: string | null; lastLoginAt: string | null;
  companyAssignments: { companyId: string }[];
};

export default function UsersClient({ initial, currentUserId, currentUserRole, currentIp }: { initial: U[]; currentUserId: string; currentUserRole: AppRole; currentIp: string | null }) {
  const router = useRouter();
  const availableRoles = ROLES.filter((role) => canManageUserRole(currentUserRole, role));
  const [form, setForm] = useState<{ name: string; username: string; password: string; role: AppRole; allowedIpRanges: string }>({ name: "", username: "", password: "", role: "SITE_STAFF", allowedIpRanges: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<U | null>(null);
  const [accessForm, setAccessForm] = useState<{ role: AppRole; allowedIpRanges: string }>({ role: "IT", allowedIpRanges: "" });

  async function add() {
    if (!form.name || !form.username || !form.password) return alert("กรอกให้ครบ");
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (res.ok) {
      setForm({ name: "", username: "", password: "", role: "SITE_STAFF", allowedIpRanges: "" });
      router.refresh();
    } else {
      const e = await res.json();
      setMsg(e.error || "เพิ่มไม่สำเร็จ");
    }
  }

  async function resetPwd(u: U) {
    const p = prompt(`ตั้งรหัสผ่านใหม่ให้ ${u.name} (อย่างน้อย 6 ตัว)`);
    if (!p) return;
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: p }),
    });
    if (res.ok) alert("เปลี่ยนรหัสแล้ว");
    else alert("ไม่สำเร็จ");
  }

  async function toggle(u: U) {
    await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    router.refresh();
  }

  function openAccess(u: U) {
    if (!canManageUserRole(currentUserRole, u.role)) return;
    setEditing(u);
    setAccessForm({ role: u.role, allowedIpRanges: u.allowedIpRanges || "" });
  }

  async function saveAccess() {
    if (!editing) return;
    setBusy(true);
    const res = await fetch(`/api/users/${editing.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accessForm),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return alert(data.error || "บันทึกไม่สำเร็จ");
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <PageHeader title="จัดการผู้ใช้" subtitle="กำหนดบทบาทใช้งานทุกบริษัท — สิทธิ์มีผลทั้งเมนูและ API" />

      <div className="card p-5 mb-6">
        <div className="text-sm font-semibold text-slate-700 mb-3">เพิ่มผู้ใช้ใหม่</div>
        {msg && <div className="mb-3 text-sm text-red-600">{msg}</div>}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input className="input" placeholder="ชื่อ-นามสกุล" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input className="input" type="password" placeholder="รหัสผ่าน" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}>
            {availableRoles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
          </select>
          <button className="btn-primary disabled:opacity-60" disabled={busy} onClick={add}>
            {busy ? "กำลังเพิ่ม..." : "+ เพิ่ม"}
          </button>
        </div>
        <div className="mt-3">
          <label className="label">จำกัด IP สำหรับเข้าใช้ (ไม่กรอก = เข้าได้จากทุก IP)</label>
          <textarea
            className="input min-h-20"
            placeholder={`ตัวอย่าง: ${currentIp || "203.0.113.10"}\nหรือวง IP: 203.0.113.0/24`}
            value={form.allowedIpRanges}
            onChange={(e) => setForm({ ...form, allowedIpRanges: e.target.value })}
          />
          <div className="mt-1 text-xs text-slate-400">ใส่ได้หลายค่า แยกบรรทัด · IP ที่ระบบเห็นตอนนี้: <b>{currentIp || "ตรวจไม่พบ (local)"}</b></div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 bg-slate-50">
              <th className="py-3 px-4 font-medium">ชื่อ</th>
              <th className="py-3 px-4 font-medium">username</th>
              <th className="py-3 px-4 font-medium">บทบาท</th>
              <th className="py-3 px-4 font-medium">สถานะ</th>
              <th className="py-3 px-4 font-medium text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {initial.map((u) => (
              <tr key={u.id} className="border-t border-slate-50">
                <td className="py-3 px-4 font-medium text-slate-700">{u.name}</td>
                <td className="py-3 px-4 text-slate-500">@{u.username}</td>
                <td className="py-3 px-4">
                  <span className={`badge ${u.role === "ADMIN" ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700"}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                  <div className="text-[11px] text-slate-400 mt-1">ทุกบริษัท</div>
                </td>
                <td className="py-3 px-4">
                  <span className={`badge ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                    {u.isActive ? "ใช้งาน" : "ปิด"}
                  </span>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {u.allowedIpRanges ? `🔒 ${u.allowedIpRanges.split(/\s+/).filter(Boolean).length} IP/วง` : "🌐 ทุก IP"}
                    {u.lastLoginIp ? ` · ล่าสุด ${u.lastLoginIp}` : ""}
                  </div>
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <button disabled={!canManageUserRole(currentUserRole, u.role)} className="text-brand-600 hover:underline text-xs mr-3 disabled:opacity-30" onClick={() => openAccess(u)}>กำหนดสิทธิ์</button>
                  <button disabled={!canManageUserRole(currentUserRole, u.role)} className="text-brand-600 hover:underline text-xs mr-3 disabled:opacity-30" onClick={() => resetPwd(u)}>รีเซ็ตรหัส</button>
                  <button disabled={u.id === currentUserId || !canManageUserRole(currentUserRole, u.role)} className="text-slate-500 hover:underline text-xs disabled:opacity-30" onClick={() => toggle(u)}>{u.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setEditing(null)}>
          <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-800">กำหนดสิทธิ์ — {editing.name}</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">กำหนดบทบาทสำหรับทุกบริษัท และ IP ที่อนุญาตให้เข้าใช้</p>
            <label className="label">บทบาท</label>
            <select
              className="input"
              value={accessForm.role}
              onChange={(e) => setAccessForm({ ...accessForm, role: e.target.value as AppRole })}
              disabled={editing.id === currentUserId}
            >
              {availableRoles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
            </select>
            {editing.id === currentUserId && <div className="text-xs text-amber-600 mt-1">ไม่สามารถลดสิทธิ์บัญชีที่กำลังใช้งานอยู่</div>}
            <div className="mt-4">
              <label className="label">IP/CIDR ที่อนุญาต</label>
              <textarea
                className="input min-h-28"
                value={accessForm.allowedIpRanges}
                onChange={(e) => setAccessForm({ ...accessForm, allowedIpRanges: e.target.value })}
                placeholder={`${currentIp || "203.0.113.10"}\n203.0.113.0/24`}
              />
              <div className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                เว้นว่าง = เข้าได้ทุก IP · แนะนำให้ใช้ IP คงที่ของ VPN/สำนักงาน
                <br />IP ที่ระบบเห็นตอนนี้: <b>{currentIp || "ตรวจไม่พบ"}</b>
                {editing.id === currentUserId && <> · บัญชีตัวเองต้องใส่ IP ปัจจุบันไว้ด้วย</>}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-ghost" onClick={() => setEditing(null)}>ยกเลิก</button>
              <button className="btn-primary disabled:opacity-60" disabled={busy} onClick={saveAccess}>{busy ? "กำลังบันทึก..." : "บันทึกสิทธิ์"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
