"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/auth/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const e = await res.json().catch(() => ({}));
      setErr(e.error || "สร้างผู้ดูแลไม่สำเร็จ");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-800 p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <div className="text-lg font-semibold text-slate-800 mb-1">ตั้งค่าครั้งแรก</div>
        <div className="text-xs text-slate-400 mb-5">สร้างบัญชีผู้ดูแลระบบคนแรก</div>
        {err && <div className="mb-3 rounded-lg bg-red-50 text-red-600 text-sm px-3 py-2">{err}</div>}
        <label className="label">ชื่อ-นามสกุล (แสดงใน KPI)</label>
        <input className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น สมชาย" autoFocus />
        <label className="label">ชื่อผู้ใช้ (username)</label>
        <input className="input mb-3" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="เช่น admin" />
        <label className="label">รหัสผ่าน (อย่างน้อย 6 ตัว)</label>
        <input type="password" className="input mb-5" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn-primary w-full disabled:opacity-60" disabled={busy}>
          {busy ? "กำลังสร้าง..." : "สร้างบัญชี + เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}
