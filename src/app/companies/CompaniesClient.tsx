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
  category: string | null;
  backupUrl: string | null;
  note: string | null;
  isActive: boolean;
};
type LineGroup = {
  id: string;
  name: string;
  note: string | null;
  isActive: boolean;
  expectedOaName: string | null;
  hasToken: boolean;
  oaStatus: string;
  oaDisplayName: string | null;
  oaHasPicture: boolean | null;
  oaLastCheckedAt: string | null;
  oaError: string | null;
};
type Company = {
  id: string;
  name: string;
  note: string | null;
  isActive: boolean;
  tgChatId: string | null;
  hasTelegram: boolean;
  lineGroups: LineGroup[];
  links: LinkLite[];
};

type ModalData = { link: LinkLite; companyId: string; company: string; room: string };

function statusMeta(status: string) {
  if (status === "UP") return { dot: "bg-emerald-500", text: "ใช้งานได้", cls: "text-emerald-600", pill: "bg-emerald-50 text-emerald-700" };
  if (status === "SLOW") return { dot: "bg-amber-400", text: "โหลดช้า", cls: "text-amber-600", pill: "bg-amber-50 text-amber-700" };
  if (status === "DOWN") return { dot: "bg-red-500", text: "ใช้ไม่ได้", cls: "text-red-600", pill: "bg-red-50 text-red-600" };
  return { dot: "bg-slate-300", text: "ยังไม่เช็ค / ไม่เฝ้าดู", cls: "text-slate-400", pill: "bg-slate-100 text-slate-500" };
}

function oaMeta(status: string) {
  switch (status) {
    case "OK": return { text: "OA ปกติ", cls: "bg-emerald-50 text-emerald-700" };
    case "MISMATCH": return { text: "ชื่อ OA ไม่ตรง", cls: "bg-red-50 text-red-600" };
    case "NO_PICTURE": return { text: "รูปโปรไฟล์หาย", cls: "bg-amber-50 text-amber-700" };
    case "TOKEN_INVALID": return { text: "token ใช้ไม่ได้", cls: "bg-red-50 text-red-600" };
    case "ERROR": return { text: "ตรวจ OA ไม่ได้", cls: "bg-amber-50 text-amber-700" };
    default: return { text: "ยังไม่ตรวจ OA", cls: "bg-slate-100 text-slate-500" };
  }
}

export default function CompaniesClient({ initial }: { initial: Company[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [groupInput, setGroupInput] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [linkModal, setLinkModal] = useState<ModalData | null>(null);
  const [tgModal, setTgModal] = useState<Company | null>(null);
  const [oaModal, setOaModal] = useState<{ group: LineGroup; company: string } | null>(null);

  function toggle(id: string) {
    setOpen((o) => ({ ...o, [id]: !(o[id] ?? false) }));
  }

  async function addCompany() {
    if (!newCompany.trim()) return;
    setBusy(true);
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCompany }),
    });
    setBusy(false);
    if (!res.ok) { alert("เพิ่มบริษัทไม่สำเร็จ"); return; }
    setNewCompany("");
    router.refresh();
  }

  async function renameCompany(c: Company) {
    const name = prompt("ชื่อบริษัทใหม่", c.name);
    if (!name || name === c.name) return;
    await fetch(`/api/companies/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
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
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, name }),
    });
    setGroupInput({ ...groupInput, [companyId]: "" });
    router.refresh();
  }

  async function renameGroup(g: LineGroup) {
    const name = prompt("ชื่อห้อง LINE ใหม่", g.name);
    if (!name || name === g.name) return;
    await fetch(`/api/linegroups/${g.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
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

      <div className="card p-4 mb-6 bg-brand-50/40 border-brand-100">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="badge bg-white text-brand-700 border border-brand-100">🏢 บริษัท</span>
          <span className="text-slate-400">›</span>
          <span className="badge bg-white text-brand-700 border border-brand-100">💬 ห้อง LINE</span>
          <span className="text-slate-400">›</span>
          <span className="badge bg-white text-brand-700 border border-brand-100">🔗 ลิงก์</span>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          กดที่บริษัทเพื่อกาง/พับ · กดที่ลิงก์เพื่อดูรายละเอียด/เปิดลิงก์ · ปุ่ม 🔔 ตั้งกลุ่ม Telegram ต่อบริษัท ·
          ปุ่ม ⚙️ ที่ห้องเพื่อใส่ token ตรวจ LINE OA / ดึงลิงก์จาก Rich Menu · เพิ่ม/แก้ลิงก์ทำที่หน้า{" "}
          <Link href="/links" className="text-brand-600 hover:underline font-medium">Master Data ลิงก์</Link>
        </p>
      </div>

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
          <button className="btn-primary whitespace-nowrap disabled:opacity-60" disabled={busy} onClick={addCompany}>
            {busy ? "กำลังเพิ่ม..." : "+ เพิ่มบริษัท"}
          </button>
        </div>
      </div>

      {initial.length === 0 && (
        <div className="card p-10 text-center text-slate-400">ยังไม่มีบริษัท — เพิ่มบริษัทแรกด้านบน</div>
      )}

      <div className="space-y-3">
        {initial.map((c) => {
          const isOpen = open[c.id] ?? false;
          const linksByGroup = (gid: string) => c.links.filter((l) => l.lineGroupId === gid);
          const unassigned = c.links.filter((l) => !l.lineGroupId);
          const downCount = c.links.filter((l) => l.lastStatus === "DOWN").length;
          const slowCount = c.links.filter((l) => l.lastStatus === "SLOW").length;

          return (
            <div key={c.id} className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-4">
                <button className="flex items-center gap-3 min-w-0 text-left flex-1" onClick={() => toggle(c.id)}>
                  <span className={`text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>▸</span>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 text-lg">🏢</div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{c.name}</div>
                    <div className="text-xs text-slate-400">
                      {c.lineGroups.length} ห้อง LINE · {c.links.length} ลิงก์
                      {downCount > 0 && <span className="text-red-500 font-medium"> · 🔴 {downCount} ใช้ไม่ได้</span>}
                      {slowCount > 0 && <span className="text-amber-500 font-medium"> · 🟡 {slowCount} โหลดช้า</span>}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    className={`text-xs hover:underline ${c.hasTelegram ? "text-emerald-600" : "text-slate-400"}`}
                    title="ตั้งกลุ่ม Telegram ของบริษัทนี้"
                    onClick={() => setTgModal(c)}
                  >
                    🔔 {c.hasTelegram ? "Telegram ✓" : "Telegram"}
                  </button>
                  <button className="text-xs text-brand-600 hover:underline" onClick={() => renameCompany(c)}>เปลี่ยนชื่อ</button>
                  <button className="text-xs text-red-500 hover:underline" onClick={() => deleteCompany(c)}>ลบ</button>
                </div>
              </div>

              {isOpen && (
                <div className="p-4 pt-0 space-y-3">
                  {c.lineGroups.length === 0 && unassigned.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
                      ยังไม่มีห้อง LINE ในบริษัทนี้ — เพิ่มห้องแรกด้านล่าง 👇
                    </div>
                  )}

                  {c.lineGroups.map((g) => {
                    const gl = linksByGroup(g.id);
                    const oa = oaMeta(g.oaStatus);
                    return (
                      <div key={g.id} className="rounded-xl border border-slate-100 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="text-base">💬</span>
                            <span className="font-medium text-slate-700 truncate">{g.name}</span>
                            <span className="badge bg-white text-slate-500 border border-slate-200 text-[11px]">{gl.length} ลิงก์</span>
                            {g.hasToken && <span className={`badge text-[11px] ${oa.cls}`}>{oa.text}</span>}
                          </div>
                          <div className="flex gap-3 shrink-0">
                            <button className="text-xs text-slate-400 hover:text-brand-600" title="ตั้งค่า LINE OA / Rich Menu" onClick={() => setOaModal({ group: g, company: c.name })}>⚙️ OA</button>
                            <button className="text-xs text-slate-400 hover:text-brand-600" onClick={() => renameGroup(g)}>เปลี่ยนชื่อ</button>
                            <button className="text-xs text-slate-400 hover:text-red-500" onClick={() => deleteGroup(g.id, g.name)}>ลบห้อง</button>
                          </div>
                        </div>
                        {gl.length === 0 ? (
                          <div className="text-xs text-slate-400 px-3 py-2.5">ยังไม่มีลิงก์ในห้องนี้ — เพิ่มที่ Master Data หรือดึงจาก Rich Menu (⚙️ OA)</div>
                        ) : (
                          <div className="divide-y divide-slate-50">
                            {gl.map((l) => (
                              <LinkItem key={l.id} link={l} onClick={() => setLinkModal({ link: l, companyId: c.id, company: c.name, room: g.name })} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {unassigned.length > 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 overflow-hidden">
                      <div className="flex items-center gap-2 bg-slate-50/60 px-3 py-2">
                        <span className="text-base">🔗</span>
                        <span className="font-medium text-slate-500">ลิงก์ที่ยังไม่ระบุห้อง</span>
                        <span className="badge bg-white text-slate-500 border border-slate-200 text-[11px]">{unassigned.length} ลิงก์</span>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {unassigned.map((l) => (
                          <LinkItem key={l.id} link={l} onClick={() => setLinkModal({ link: l, companyId: c.id, company: c.name, room: "ไม่ระบุห้อง" })} />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <input
                      className="input py-1.5 text-sm"
                      placeholder="ชื่อห้อง LINE ใหม่ เช่น ห้องแอดมิน A"
                      value={groupInput[c.id] || ""}
                      onChange={(e) => setGroupInput({ ...groupInput, [c.id]: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && addGroup(c.id)}
                    />
                    <button className="btn-primary text-sm whitespace-nowrap" onClick={() => addGroup(c.id)}>+ เพิ่มห้อง LINE</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {linkModal && <LinkDetailModal data={linkModal} onClose={() => setLinkModal(null)} />}
      {tgModal && <CompanyTgModal company={tgModal} onClose={() => setTgModal(null)} onSaved={() => { setTgModal(null); router.refresh(); }} />}
      {oaModal && <RoomOaModal group={oaModal.group} company={oaModal.company} onClose={() => setOaModal(null)} onSaved={() => { setOaModal(null); router.refresh(); }} />}
    </div>
  );
}

function LinkItem({ link, onClick }: { link: LinkLite; onClick: () => void }) {
  const s = statusMeta(link.lastStatus);
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-brand-50/50 transition-colors group">
      <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${s.dot}`} title={s.text} />
      <span className="text-sm text-slate-700 truncate flex-1">{link.name}</span>
      {link.category && <span className="badge bg-slate-100 text-slate-400 text-[10px] hidden sm:inline">{link.category}</span>}
      {!link.isActive && <span className="badge bg-slate-100 text-slate-400 text-[10px]">ไม่เฝ้าดู</span>}
      <span className="text-slate-300 group-hover:text-brand-500 text-xs shrink-0">รายละเอียด ›</span>
    </button>
  );
}

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button className="text-slate-400 hover:text-slate-600 text-2xl leading-none" onClick={onClose}>×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function LinkDetailModal({ data, onClose }: { data: ModalData; onClose: () => void }) {
  const { link, companyId, company, room } = data;
  const s = statusMeta(link.lastStatus);
  const editHref = `/links?company=${companyId}&edit=${link.id}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`badge ${s.pill} text-[11px]`}>● {s.text}</span>
              {link.category && <span className="badge bg-slate-100 text-slate-500 text-[11px]">{link.category}</span>}
              {!link.isActive && <span className="badge bg-slate-100 text-slate-400 text-[11px]">ไม่เฝ้าดู</span>}
            </div>
            <h3 className="text-lg font-semibold text-slate-800 break-words">{link.name}</h3>
            <div className="text-xs text-slate-400 mt-0.5">🏢 {company} · 💬 {room}</div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 text-2xl leading-none" onClick={onClose}>×</button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <div>
            <div className="text-xs text-slate-400 mb-1">ลิงก์ (URL)</div>
            <a href={link.url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline break-all">{link.url}</a>
          </div>
          {link.backupUrl && (
            <div>
              <div className="text-xs text-slate-400 mb-1">ลิงก์สำรอง</div>
              <a href={link.backupUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline break-all">{link.backupUrl}</a>
            </div>
          )}
          {link.note && (
            <div>
              <div className="text-xs text-slate-400 mb-1">หมายเหตุ</div>
              <div className="text-slate-600">{link.note}</div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 px-5 pb-5">
          <a href={link.url} target="_blank" rel="noreferrer" className="btn-primary text-sm flex-1 text-center">เปิดลิงก์ ↗</a>
          <Link href={editHref} className="btn-ghost text-sm flex-1 text-center">แก้ไขลิงก์นี้ →</Link>
        </div>
      </div>
    </div>
  );
}

function CompanyTgModal({ company, onClose, onSaved }: { company: Company; onClose: () => void; onSaved: () => void }) {
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState(company.tgChatId || "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const body: Record<string, string> = { tgChatId: chatId };
    if (botToken.trim()) body.tgBotToken = botToken.trim(); // ไม่กรอก = คงเดิม
    const res = await fetch(`/api/companies/${company.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) onSaved(); else alert("บันทึกไม่สำเร็จ");
  }

  async function clearTg() {
    if (!confirm("ปิดการแจ้งเตือนแยกของบริษัทนี้? (กลับไปใช้กลุ่มกลาง)")) return;
    setBusy(true);
    await fetch(`/api/companies/${company.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tgBotToken: "", tgChatId: "" }),
    });
    setBusy(false);
    onSaved();
  }

  return (
    <ModalShell title={`🔔 Telegram — ${company.name}`} onClose={onClose}>
      <p className="text-xs text-slate-500 mb-3">
        ตั้ง bot กับกลุ่ม Telegram เฉพาะบริษัทนี้ เวลาลิงก์ในบริษัทนี้ล่ม/OA ผิดปกติ จะแจ้งเข้ากลุ่มนี้ (ไม่ตั้ง = ใช้กลุ่มกลาง)
      </p>
      <label className="label">Bot Token</label>
      <input type="password" className="input mb-2" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder={company.hasTelegram ? "•••••• (ไม่กรอก = คงเดิม)" : "123456:ABC-DEF..."} autoComplete="off" />
      <label className="label">Chat ID (คั่นด้วย , ได้)</label>
      <input className="input mb-1" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="-1001234567890" />
      <div className="flex justify-between gap-2 mt-4">
        {company.hasTelegram ? <button className="btn-ghost text-xs" disabled={busy} onClick={clearTg}>ปิดการแจ้งเตือนแยก</button> : <span />}
        <div className="flex gap-2">
          <button className="btn-ghost text-sm" onClick={onClose}>ยกเลิก</button>
          <button className="btn-primary text-sm disabled:opacity-60" disabled={busy} onClick={save}>{busy ? "กำลังบันทึก..." : "บันทึก"}</button>
        </div>
      </div>
    </ModalShell>
  );
}

function RoomOaModal({ group, company, onClose, onSaved }: { group: LineGroup; company: string; onClose: () => void; onSaved: () => void }) {
  const [token, setToken] = useState("");
  const [expectedName, setExpectedName] = useState(group.expectedOaName || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const oa = oaMeta(group.oaStatus);

  async function save() {
    setBusy(true); setMsg(null);
    const body: Record<string, string> = { expectedOaName: expectedName };
    if (token.trim()) body.channelAccessToken = token.trim();
    const res = await fetch(`/api/linegroups/${group.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) onSaved(); else setMsg("บันทึกไม่สำเร็จ");
  }

  async function checkNow() {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/linegroups/${group.id}/check-oa`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setMsg(`ผลตรวจ: ${oaMeta(data.result?.status).text}${data.result?.displayName ? ` (${data.result.displayName})` : ""}`); onSaved(); }
    else setMsg(data.error || "ตรวจไม่สำเร็จ");
  }

  async function importMenu() {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/linegroups/${group.id}/import-richmenu`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setMsg(`ดึงลิงก์แล้ว: เพิ่มใหม่ ${data.added} · มีอยู่แล้ว ${data.skipped}`); onSaved(); }
    else setMsg(data.error || "ดึงไม่สำเร็จ");
  }

  return (
    <ModalShell title={`⚙️ LINE OA — ${group.name}`} onClose={onClose}>
      <div className="text-xs text-slate-400 mb-3">🏢 {company}</div>
      {group.hasToken && (
        <div className="mb-3 text-sm">
          <span className={`badge text-[11px] ${oa.cls}`}>{oa.text}</span>
          {group.oaDisplayName && <span className="text-slate-500 ml-2">ชื่อจริง: {group.oaDisplayName}</span>}
          {group.oaError && <div className="text-xs text-red-500 mt-1">{group.oaError}</div>}
        </div>
      )}
      <label className="label">Channel Access Token</label>
      <input type="password" className="input mb-2" value={token} onChange={(e) => setToken(e.target.value)} placeholder={group.hasToken ? "•••••• (ไม่กรอก = คงเดิม)" : "วาง token ของ OA นี้"} autoComplete="off" />
      <label className="label">ชื่อ OA ที่คาดหวัง (ไว้เทียบว่าถูกเปลี่ยนไหม)</label>
      <input className="input mb-1" value={expectedName} onChange={(e) => setExpectedName(e.target.value)} placeholder="เช่น AD3 free" />
      {msg && <div className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 mt-2">{msg}</div>}
      <div className="flex flex-wrap gap-2 mt-4">
        <button className="btn-primary text-sm disabled:opacity-60" disabled={busy} onClick={save}>{busy ? "..." : "บันทึก"}</button>
        <button className="btn-ghost text-sm disabled:opacity-60" disabled={busy || !group.hasToken} onClick={checkNow} title={group.hasToken ? "" : "ใส่ token ก่อน"}>ตรวจ OA ตอนนี้</button>
        <button className="btn-ghost text-sm disabled:opacity-60" disabled={busy || !group.hasToken} onClick={importMenu} title={group.hasToken ? "" : "ใส่ token ก่อน"}>ดึงลิงก์จาก Rich Menu</button>
      </div>
      <div className="text-[11px] text-slate-400 mt-3">บันทึก token ก่อน แล้วค่อยกด &quot;ตรวจ&quot; / &quot;ดึงลิงก์&quot;</div>
    </ModalShell>
  );
}
