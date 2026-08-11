"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";

type U = { id: string; name: string; username: string; role: string; isActive: boolean };

export default function UsersClient({ initial }: { initial: U[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "ADMIN" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
      setForm({ name: "", username: "", password: "", role: "ADMIN" });
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

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <PageHeader title="จัดการผู้ใช้" subtitle="เพิ่มทีมงาน กำหนดบทบาท (แอดมิน/ไอที) — ใช้ผูก KPI รายคน" />

      <div className="card p-5 mb-6">
        <div className="text-sm font-semibold text-slate-700 mb-3">เพิ่มผู้ใช้ใหม่</div>
        {msg && <div className="mb-3 text-sm text-red-600">{msg}</div>}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input className="input" placeholder="ชื่อ-นามสกุล" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input className="input" type="password" placeholder="รหัสผ่าน" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="ADMIN">แอดมิน</option>
            <option value="IT">ไอที</option>
          </select>
          <button className="btn-primary disabled:opacity-60" disabled={busy} onClick={add}>
            {busy ? "กำลังเพิ่ม..." : "+ เพิ่ม"}
          </button>
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
                    {u.role === "ADMIN" ? "แอดมิน" : "ไอที"}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={`badge ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                    {u.isActive ? "ใช้งาน" : "ปิด"}
                  </span>
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <button className="text-brand-600 hover:underline text-xs mr-3" onClick={() => resetPwd(u)}>รีเซ็ตรหัส</button>
                  <button className="text-slate-500 hover:underline text-xs" onClick={() => toggle(u)}>{u.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
