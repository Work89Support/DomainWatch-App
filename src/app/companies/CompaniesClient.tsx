"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";

type LinkLite = {
  id: string;
  name: string;
  url: string;
  lineGroupId: string | null;
  lastStatus: string;
};
type LineGroup = { id: string; name: string; note: string | null; isActive: boolean };
type Company = {
  id: string;
  name: string;
  note: string | null;
  isActive: boolean;
  lineGroups: LineGroup[];
  links: LinkLite[];
};

function StatusDot({ status }: { status: string }) {
  const cls =
    status === "UP"
      ? "bg-emerald-500"
      : status === "DOWN"
      ? "bg-red-500"
      : "bg-slate-300";
  const label =
    status === "UP" ? "ใช้งานได้" : status === "DOWN" ? "ใช้ไม่ได้" : "ยังไม่เช็ค";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} title={label} />;
}

export default function CompaniesClient({ initial }: { initial: Company[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [groupInput, setGroupInput] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initial.map((c) => [c.id, true]))
  );

  function toggle(id: string) {
    setOpen((o) => ({ ...o, [id]: !o[id] }));
  }

  async function addCompany() {
    if (!newCompany.trim()) return;
    setBusy(true);
    await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCompany }),
    });
    setBusy(false);
    setNewCompany("");
    router.refresh();
  }

  async function renameCompany(c: Company) {
    const name = prompt("ชื่อบริษัทใหม่", c.name);
    if (!name || name === c.name) return;
    await fetch(`/api/companies/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    router.refresh();
  }

  async function deleteCompany(c: Company) {
    if (!confirm(`ลบบริษัท "${c.name}"? ลิงก์และห้อง LINE ทั้งหมดในบริษัทนี้จะถูกลบด้วย`)) return;
    await fetch(`/api/companies/${c.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function addGroup(companyId: string) {
    const name = (groupInput[companyId] || "").trim();
    if (!name) return;
    await fetch("/api/linegroups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, name }),
    });
    setGroupInput({ ...groupInput, [companyId]: "" });
    router.refresh();
  }

  async function renameGroup(g: LineGroup) {
    const name = prompt("ชื่อห้อง LINE ใหม่", g.name);
    if (!name || name === g.name) return;
    await fetch(`/api/linegroups/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    router.refresh();
  }

  async function deleteGroup(id: string, name: string) {
    if (!confirm(`ลบห้อง "${name}"? ลิงก์ที่อยู่ในห้องนี้จะยังอยู่ในบริษัท (แต่ไม่ผูกห้อง)`)) return;
    await fetch(`/api/linegroups/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="บริษัท / ห้อง LINE"
        subtitle="โครงสร้างข้อมูลของระบบ — จัดกลุ่มลิงก์ตามบริษัทและห้อง LINE ให้ทีมรู้ว่าลิงก์ไหนของใคร"
      />

      {/* คำอธิบายโครงสร้าง 3 ชั้น */}
      <div className="card p-4 mb-6 bg-brand-50/40 border-brand-100">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="badge bg-white text-brand-700 border border-brand-100">🏢 บริษัท</span>
          <span className="text-slate-400">›</span>
          <span className="badge bg-white text-brand-700 border border-brand-100">💬 ห้อง LINE</span>
          <span className="text-slate-400">›</span>
          <span className="badge bg-white text-brand-700 border border-brand-100">🔗 ลิงก์</span>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          แต่ละบริษัทมีได้หลายห้อง LINE และแต่ละห้องมีได้หลายลิงก์ · หน้านี้ใช้จัดโครงสร้างบริษัทกับห้อง
          ส่วนการเพิ่ม/แก้ลิงก์ให้ทำที่หน้า{" "}
          <Link href="/links" className="text-brand-600 hover:underline font-medium">
            Master Data ลิงก์
          </Link>
        </p>
      </div>

      {/* เพิ่มบริษัท */}
      <div className="card p-4 mb-6">
        <div className="text-xs font-medium text-slate-500 mb-2">เพิ่มบริษัทใหม่</div>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="เช่น บริษัท A, แบรนด์ B..."
            value={newCompany}
            onChange={(e) => setNewCompany(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCompany()}
          />
          <button
            className="btn-primary whitespace-nowrap disabled:opacity-60"
            disabled={busy}
            onClick={addCompany}
          >
            + เพิ่มบริษัท
          </button>
        </div>
      </div>

      {initial.length === 0 && (
        <div className="card p-10 text-center text-slate-400">
          ยังไม่มีบริษัท — เพิ่มบริษัทแรกด้านบน
        </div>
      )}

      <div className="space-y-4">
        {initial.map((c) => {
          const isOpen = open[c.id];
          const linksByGroup = (gid: string) =>
            c.links.filter((l) => l.lineGroupId === gid);
          const unassigned = c.links.filter((l) => !l.lineGroupId);
          const downCount = c.links.filter((l) => l.lastStatus === "DOWN").length;

          return (
            <div key={c.id} className="card overflow-hidden">
              {/* หัวบริษัท */}
              <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-100">
                <button
                  className="flex items-center gap-3 min-w-0 text-left"
                  onClick={() => toggle(c.id)}
                >
                  <span
                    className={`text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  >
                    ▸
                  </span>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 text-lg">
                    🏢
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{c.name}</div>
                    <div className="text-xs text-slate-400">
                      {c.lineGroups.length} ห้อง LINE · {c.links.length} ลิงก์
                      {downCount > 0 && (
                        <span className="text-red-500 font-medium"> · 🔴 {downCount} ใช้ไม่ได้</span>
                      )}
                    </div>
                  </div>
                </button>
                <div className="flex gap-3 shrink-0">
                  <button
                    className="text-xs text-brand-600 hover:underline"
                    onClick={() => renameCompany(c)}
                  >
                    เปลี่ยนชื่อ
                  </button>
                  <button
                    className="text-xs text-red-500 hover:underline"
                    onClick={() => deleteCompany(c)}
                  >
                    ลบ
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 space-y-3">
                  {c.lineGroups.length === 0 && unassigned.length === 0 && (
                    <div className="text-sm text-slate-400 py-2">
                      ยังไม่มีห้อง LINE — เพิ่มห้องแรกด้านล่าง
                    </div>
                  )}

                  {/* ห้อง LINE แต่ละห้อง */}
                  {c.lineGroups.map((g) => {
                    const gl = linksByGroup(g.id);
                    return (
                      <div
                        key={g.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 p-3"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base">💬</span>
                            <span className="font-medium text-slate-700 truncate">{g.name}</span>
                            <span className="badge bg-white text-slate-500 border border-slate-200 text-[11px]">
                              {gl.length} ลิงก์
                            </span>
                          </div>
                          <div className="flex gap-3 shrink-0">
                            <button
                              className="text-xs text-slate-400 hover:text-brand-600"
                              onClick={() => renameGroup(g)}
                            >
                              เปลี่ยนชื่อ
                            </button>
                            <button
                              className="text-xs text-slate-400 hover:text-red-500"
                              onClick={() => deleteGroup(g.id, g.name)}
                            >
                              ลบห้อง
                            </button>
                          </div>
                        </div>
                        {gl.length === 0 ? (
                          <div className="text-xs text-slate-400 pl-7">ยังไม่มีลิงก์ในห้องนี้</div>
                        ) : (
                          <div className="pl-7 space-y-1">
                            {gl.map((l) => (
                              <div key={l.id} className="flex items-center gap-2 text-sm">
                                <StatusDot status={l.lastStatus} />
                                <span className="text-slate-700 truncate">{l.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* ลิงก์ที่ยังไม่ระบุห้อง */}
                  {unassigned.length > 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-base">🔗</span>
                        <span className="font-medium text-slate-500">ลิงก์ที่ยังไม่ระบุห้อง</span>
                        <span className="badge bg-white text-slate-500 border border-slate-200 text-[11px]">
                          {unassigned.length} ลิงก์
                        </span>
                      </div>
                      <div className="pl-7 space-y-1">
                        {unassigned.map((l) => (
                          <div key={l.id} className="flex items-center gap-2 text-sm">
                            <StatusDot status={l.lastStatus} />
                            <span className="text-slate-700 truncate">{l.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* เพิ่มห้อง */}
                  <div className="flex gap-2 pt-1">
                    <input
                      className="input py-1.5 text-sm"
                      placeholder="เพิ่มห้อง LINE เช่น ห้องแอดมิน A"
                      value={groupInput[c.id] || ""}
                      onChange={(e) => setGroupInput({ ...groupInput, [c.id]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && addGroup(c.id)}
                    />
                    <button
                      className="btn-ghost text-sm whitespace-nowrap"
                      onClick={() => addGroup(c.id)}
                    >
                      + เพิ่มห้อง
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
