"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { ROLE_LABELS, ROLES, type AppRole } from "@/lib/permissions";

type U = { id: string; name: string; username: string; role: AppRole; isActive: boolean; companyAssignments: { companyId: string }[] };
type Company = { id: string; name: string };

export default function UsersClient({ initial, companies, currentUserId }: { initial: U[]; companies: Company[]; currentUserId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<{ name: string; username: string; password: string; role: AppRole; companyIds: string[] }>({ name: "", username: "", password: "", role: "ADMIN", companyIds: [] });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<U | null>(null);
  const [accessForm, setAccessForm] = useState<{ role: AppRole; companyIds: string[] }>({ role: "IT", companyIds: [] });

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
      setForm({ name: "", username: "", password: "", role: "ADMIN", companyIds: [] });
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
    setEditing(u);
    setAccessForm({ role: u.role, companyIds: u.companyAssignments.map((item) => item.companyId) });
  }

  async function saveAccess() {
    if (!editing) return;
    if (accessForm.role === "ADMIN_COMPANY" && !accessForm.companyIds.length)
      return alert("ADMIN_COMPANY ต้องเลือกอย่างน้อย 1 บริษัท");
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

  function toggleCompany(id: string) {
    setForm((value) => ({
      ...value,
      companyIds: value.companyIds.includes(id)
        ? value.companyIds.filter((companyId) => companyId !== id)
        : [...value.companyIds, id],
    }));
  }

  function toggleAccessCompany(id: string) {
    setAccessForm((value) => ({
      ...value,
      companyIds: value.companyIds.includes(id)
        ? value.companyIds.filter((companyId) => companyId !== id)
        : [...value.companyIds, id],
    }));
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <PageHeader title="จัดการผู้ใช้" subtitle="กำหนดบทบาทและขอบเขตบริษัท — สิทธิ์มีผลทั้งเมนูและ API" />

      <div className="card p-5 mb-6">
        <div className="text-sm font-semibold text-slate-700 mb-3">เพิ่มผู้ใช้ใหม่</div>
        {msg && <div className="mb-3 text-sm text-red-600">{msg}</div>}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input className="input" placeholder="ชื่อ-นามสกุล" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input className="input" type="password" placeholder="รหัสผ่าน" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AppRole, companyIds: [] })}>
            {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
          </select>
          <button className="btn-primary disabled:opacity-60" disabled={busy} onClick={add}>
            {busy ? "กำลังเพิ่ม..." : "+ เพิ่ม"}
          </button>
        </div>
        {form.role === "ADMIN_COMPANY" && (
          <div className="mt-3 rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-medium text-slate-600 mb-2">บริษัทที่มอบหมาย *</div>
            <div className="flex flex-wrap gap-3">
              {companies.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 text-sm text-slate-600">
                  <input type="checkbox" checked={form.companyIds.includes(c.id)} onChange={() => toggleCompany(c.id)} /> {c.name}
                </label>
              ))}
            </div>
          </div>
        )}
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
                  {u.role === "ADMIN_COMPANY" && (
                    <div className="text-[11px] text-slate-400 mt-1">
                      {u.companyAssignments.map((a) => companies.find((c) => c.id === a.companyId)?.name).filter(Boolean).join(", ") || "ยังไม่ผูกบริษัท"}
                    </div>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className={`badge ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                    {u.isActive ? "ใช้งาน" : "ปิด"}
                  </span>
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <button className="text-brand-600 hover:underline text-xs mr-3" onClick={() => openAccess(u)}>สิทธิ์/บริษัท</button>
                  <button className="text-brand-600 hover:underline text-xs mr-3" onClick={() => resetPwd(u)}>รีเซ็ตรหัส</button>
                  <button disabled={u.id === currentUserId} className="text-slate-500 hover:underline text-xs disabled:opacity-30" onClick={() => toggle(u)}>{u.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}</button>
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
            <p className="text-xs text-slate-400 mt-1 mb-4">เลือกบทบาทก่อน หากเป็นแอดมินบริษัทให้เลือกบริษัทที่รับผิดชอบ</p>
            <label className="label">บทบาท</label>
            <select
              className="input"
              value={accessForm.role}
              onChange={(e) => setAccessForm({ role: e.target.value as AppRole, companyIds: [] })}
              disabled={editing.id === currentUserId}
            >
              {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]} ({role})</option>)}
            </select>
            {editing.id === currentUserId && <div className="text-xs text-amber-600 mt-1">ไม่สามารถลดสิทธิ์บัญชีที่กำลังใช้งานอยู่</div>}
            {accessForm.role === "ADMIN_COMPANY" && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <div className="text-xs font-medium text-slate-600 mb-2">บริษัทที่มอบหมาย *</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                  {companies.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={accessForm.companyIds.includes(c.id)} onChange={() => toggleAccessCompany(c.id)} /> {c.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
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
