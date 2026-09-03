"use client";

import { useState } from "react";

export default function ChangePasswordClient({ name }: { name: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) return setError("รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร");
    if (password !== confirm) return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(data.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    window.location.replace(data.redirectTo || "/");
  }

  return <div className="min-h-screen flex items-center justify-center bg-brand-800 p-4">
    <form onSubmit={submit} className="card w-full max-w-md p-8">
      <div className="text-xl font-semibold text-slate-800">ตั้งรหัสผ่านใหม่</div>
      <p className="mt-1 mb-6 text-sm text-slate-500">สวัสดี {name} กรุณาเปลี่ยนรหัสชั่วคราวก่อนเข้าใช้ระบบครั้งแรก</p>
      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <label className="label">รหัสผ่านใหม่</label>
      <input className="input mb-3" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      <label className="label">ยืนยันรหัสผ่านใหม่</label>
      <input className="input mb-2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <div className="mb-5 text-xs text-slate-400">อย่างน้อย 10 ตัวอักษร และไม่ควรใช้รหัสเดียวกับบริการอื่น</div>
      <button className="btn-primary w-full disabled:opacity-60" disabled={busy}>{busy ? "กำลังบันทึก..." : "บันทึกและเข้าใช้งาน"}</button>
    </form>
  </div>;
}
