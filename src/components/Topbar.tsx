"use client";

import { ROLE_LABELS, type AppRole } from "@/lib/permissions";

type SessionUser = { id: string; name: string; username: string; role: AppRole };

export default function Topbar({ user }: { user: SessionUser }) {
  async function logout() {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (res.ok) {
      // บังคับขอ Layout ใหม่จาก server หลังลบ session แล้ว
      // จึงไม่มี Sidebar จากหน้าก่อนหน้าค้างบนหน้า Login
      window.location.replace("/login");
    }
  }
  return (
    <header className="flex items-center justify-end gap-3 px-6 py-3 bg-white border-b border-slate-100">
      <div className="text-right leading-tight">
        <div className="text-sm font-medium text-slate-700">{user.name}</div>
        <div className="text-xs text-slate-400">
          {ROLE_LABELS[user.role]} · @{user.username}
        </div>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold">
        {user.name.slice(0, 1)}
      </div>
      <button onClick={logout} className="btn-ghost text-xs py-1.5">
        ออกจากระบบ
      </button>
    </header>
  );
}
