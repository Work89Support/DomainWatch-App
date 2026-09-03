"use client";

import Link from "next/link";
import { useState } from "react";

type ResetResult = { user: { name: string; username: string }; temporaryPassword: string };

export default function AdminPasswordResetClient({ token }: { token: string }) {
  const [result, setResult] = useState<ResetResult | null>(null);
  const [error, setError] = useState<string | null>(token ? null : "ลิงก์ไม่ถูกต้อง");
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true); setError(null);
    const response = await fetch("/api/auth/admin-reset-password", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setError(data.error || "สร้างรหัสชั่วคราวไม่สำเร็จ");
    setResult(data);
  }

  async function copyPassword() {
    if (!result) return;
    await navigator.clipboard.writeText(result.temporaryPassword);
    alert("คัดลอกรหัสชั่วคราวแล้ว");
  }

  return <div className="p-6 md:p-8 max-w-xl mx-auto">
    <div className="card p-7">
      <h1 className="text-2xl font-semibold text-slate-800">คำขอรีเซ็ตรหัสผ่าน</h1>
      <p className="mt-2 text-sm text-slate-500">ตรวจสอบกับผู้ใช้ก่อนกดสร้าง รหัสเดิมจะถูกยกเลิกและ session เดิมจะหลุดทันที</p>
      {error && <div className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      {!result ? <button className="btn-primary mt-6 w-full disabled:opacity-60" disabled={busy || !token} onClick={approve}>
        {busy ? "กำลังสร้าง..." : "ยืนยันและสร้างรหัสผ่านชั่วคราว"}
      </button> : <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="font-semibold text-emerald-800">สร้างรหัสชั่วคราวเรียบร้อย</div>
        <div className="mt-2 text-sm text-slate-600">{result.user.name} · {result.user.username}</div>
        <code className="mt-3 block break-all rounded-lg bg-white p-3 text-base font-semibold text-slate-800">{result.temporaryPassword}</code>
        <button className="btn-primary mt-3" onClick={copyPassword}>คัดลอกรหัส</button>
        <div className="mt-3 text-xs text-amber-700">แสดงครั้งเดียว ส่งให้เจ้าของบัญชีโดยตรง และให้เปลี่ยนทันทีเมื่อเข้าสู่ระบบ</div>
      </div>}
      <div className="mt-5 text-center"><Link href="/users" className="text-sm text-brand-600 hover:underline">กลับหน้าจัดการผู้ใช้</Link></div>
    </div>
  </div>;
}
