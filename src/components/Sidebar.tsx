"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppRole } from "@/lib/permissions";

const baseNav = [
  { href: "/", label: "แดชบอร์ด", icon: "📊" },
  { href: "/companies", label: "บริษัท / ห้อง LINE", icon: "🏢" },
  { href: "/links", label: "Master Data ลิงก์", icon: "🔗" },
  { href: "/incidents", label: "เหตุการณ์", icon: "🚨" },
  { href: "/report", label: "รายงานรอบวัน", icon: "📅" },
  { href: "/kpi", label: "KPI รายคน", icon: "🏆" },
  { href: "/agents", label: "เครื่องตรวจเครือข่าย", icon: "📱" },
];

const allowedByRole: Record<AppRole, string[]> = {
  ADMIN: ["/", "/companies", "/links", "/incidents", "/report", "/kpi", "/agents", "/users"],
  ADMIN_LEAD: ["/", "/links", "/incidents", "/kpi", "/users"],
  ADMIN_COMPANY: ["/", "/links", "/incidents", "/kpi"],
  IT: ["/", "/links", "/incidents"],
  MANAGEMENT: ["/", "/incidents", "/report", "/kpi"],
  SITE_STAFF: ["/agents"],
};

export default function Sidebar({
  role,
  mobileOpen = false,
  onMobileClose,
}: {
  role: AppRole;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const allNav = [...baseNav, { href: "/users", label: "จัดการผู้ใช้", icon: "👥" }];
  const nav = allNav.filter((item) => allowedByRole[role].includes(item.href));

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="ปิดเมนู"
          className="fixed inset-0 z-40 bg-slate-950/45 md:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        aria-label="เมนูหลัก"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col bg-brand-800 text-white shadow-2xl transition-transform duration-200 md:static md:z-auto md:w-64 md:translate-x-0 md:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-6 py-6 border-b border-brand-700">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-700 text-xl font-bold">
            D
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold leading-tight">DomainWatch</div>
            <div className="text-xs text-brand-200">เฝ้าดูสถานะลิงก์</div>
          </div>
          <button
            type="button"
            aria-label="ปิดเมนู"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-2xl text-brand-100 hover:bg-brand-700 md:hidden"
            onClick={onMobileClose}
          >
            ×
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-white text-brand-800 shadow"
                    : "text-brand-100 hover:bg-brand-700"
                }`}
                onClick={onMobileClose}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-6 py-4 text-xs text-brand-300 border-t border-brand-700">
          เวอร์ชัน 2.0
        </div>
      </aside>
    </>
  );
}
