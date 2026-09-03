"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function LoginClient() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      // โหลด RootLayout ใหม่จาก server หลัง cookie ถูกตั้งแล้ว
      // ป้องกัน Layout ก่อนล็อกอินค้างและแสดงเมนูผิดสถานะ
      window.location.replace(data.redirectTo || "/");
    } else {
      const e = await res.json().catch(() => ({}));
      setErr(e.error || "เข้าสู่ระบบไม่สำเร็จ");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-800 p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white text-xl font-bold">D</div>
          <div>
            <div className="text-lg font-semibold text-slate-800">DomainWatch</div>
            <div className="text-xs text-slate-400">เข้าสู่ระบบ</div>
          </div>
        </div>
        {searchParams.get("reset") === "1" && <div className="mb-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm px-3 py-2">ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบ</div>}
        {err && <div className="mb-3 rounded-lg bg-red-50 text-red-600 text-sm px-3 py-2">{err}</div>}
        <label className="label">ชื่อผู้ใช้</label>
        <input className="input mb-3" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        <label className="label">รหัสผ่าน</label>
        <input type="password" className="input mb-5" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn-primary w-full disabled:opacity-60" disabled={busy}>
          {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
        <div className="mt-4 text-center">
          <Link href="/forgot-password" className="text-sm text-brand-600 hover:underline">ลืมรหัสผ่าน?</Link>
        </div>
      </form>
    </div>
  );
}
