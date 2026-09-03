"use client";

import Link from "next/link";
import { useState } from "react";

export default function ResetPasswordClient({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(token ? null : "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) return setError("รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร");
    if (password !== confirm) return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    setBusy(true); setError(null);
    const response = await fetch("/api/auth/reset-password", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(data.error || "ตั้งรหัสผ่านไม่สำเร็จ");
    window.location.replace("/login?reset=1");
  }
  return <div className="min-h-screen flex items-center justify-center bg-brand-800 p-4">
    <form onSubmit={submit} className="card w-full max-w-md p-8">
      <div className="text-xl font-semibold text-slate-800">ตั้งรหัสผ่านใหม่</div>
      <p className="mt-1 mb-6 text-sm text-slate-500">ลิงก์นี้ใช้ได้ครั้งเดียว กรุณากำหนดรหัสผ่านอย่างน้อย 10 ตัวอักษร</p>
      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <label className="label">รหัสผ่านใหม่</label>
      <input className="input mb-3" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={!token} />
      <label className="label">ยืนยันรหัสผ่านใหม่</label>
      <input className="input mb-5" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={!token} />
      <button className="btn-primary w-full disabled:opacity-60" disabled={busy || !token}>{busy ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}</button>
      <div className="mt-4 text-center"><Link href="/forgot-password" className="text-sm text-brand-600 hover:underline">ขอลิงก์ใหม่</Link></div>
    </form>
  </div>;
}
