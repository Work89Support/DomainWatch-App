"use client";

import { ROLE_LABELS, type AppRole } from "@/lib/permissions";

type SessionUser = { id: string; name: string; username: string; role: AppRole };

export default function Topbar({
  user,
  onMenuClick,
}: {
  user: SessionUser;
  onMenuClick?: () => void;
}) {
  async function logout() {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (res.ok) {
      // บังคับขอ Layout ใหม่จาก server หลังลบ session แล้ว
      // จึงไม่มี Sidebar จากหน้าก่อนหน้าค้างบนหน้า Login
      window.location.replace("/login");
    }
  }
  return (
    <header className="flex items-center gap-2 border-b border-slate-100 bg-white px-3 py-3 sm:gap-3 sm:px-6">
      <button
        type="button"
        aria-label="เปิดเมนู"
        aria-haspopup="true"
        onClick={onMenuClick}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-2xl text-brand-700 hover:bg-brand-100 md:hidden"
      >
        ☰
      </button>
      <div className="flex-1" />
      <div className="text-right leading-tight">
        <div className="text-sm font-medium text-slate-700">{user.name}</div>
        <div className="text-xs text-slate-400">
          {ROLE_LABELS[user.role]} · @{user.username}
        </div>
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-semibold">
        {user.name.slice(0, 1)}
      </div>
      <button onClick={logout} className="btn-ghost shrink-0 px-2.5 py-1.5 text-xs sm:px-4">
        <span className="hidden sm:inline">ออกจากระบบ</span>
        <span className="sm:hidden">ออก</span>
      </button>
    </header>
  );
}
