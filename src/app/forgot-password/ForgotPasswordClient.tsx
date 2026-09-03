"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(data.message || "หากอีเมลนี้อยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ให้แล้ว");
  }
  return <div className="min-h-screen flex items-center justify-center bg-brand-800 p-4">
    <form onSubmit={submit} className="card w-full max-w-md p-8">
      <div className="text-xl font-semibold text-slate-800">ลืมรหัสผ่าน</div>
      <p className="mt-1 mb-6 text-sm text-slate-500">กรอกอีเมลที่ผูกกับบัญชี ระบบจะส่งคำขอไปยังแอดมินเพื่อสร้างรหัสผ่านชั่วคราว</p>
      {message && <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
      <label className="label">อีเมล</label>
      <input className="input mb-5" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      <button className="btn-primary w-full disabled:opacity-60" disabled={busy}>{busy ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}</button>
      <div className="mt-4 text-center"><Link href="/login" className="text-sm text-brand-600 hover:underline">กลับหน้าเข้าสู่ระบบ</Link></div>
    </form>
  </div>;
}
