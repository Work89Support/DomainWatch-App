"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

type LineGroup = { id: string; name: string };
type Company = { id: string; name: string; lineGroups: LineGroup[] };

type LinkRow = {
  id: string;
  companyId: string;
  lineGroupId: string | null;
  name: string;
  url: string;
  category: string | null;
  backupUrl: string | null;
  note: string | null;
  isActive: boolean;
  lastStatus: string;
  lastCheckedAt: string | null;
  lastResponseMs: number | null;
  company: { id: string; name: string };
  lineGroup: { id: string; name: string } | null;
};

type Form = {
  id: string;
  companyId: string;
  lineGroupId: string;
  name: string;
  url: string;
  category: string;
  backupUrl: string;
  note: string;
  isActive: boolean;
};

const DEFAULT_CATS = ["ทางเข้า", "ริชเมนู", "โปรโมชัน", "ทั่วไป"];

const emptyForm = (companyId: string): Form => ({
  id: "",
  companyId,
  lineGroupId: "",
  name: "",
  url: "",
  category: "ทางเข้า",
  backupUrl: "",
  note: "",
  isActive: true,
});

export default function LinksClient({
  initialLinks,
  companies,
  currentCompany,
  focusId,
  capabilities,
}: {
  initialLinks: LinkRow[];
  companies: Company[];
  currentCompany?: string;
  focusId?: string;
  capabilities: { create: boolean; edit: boolean; delete: boolean; editBackup: boolean; manageStructure: boolean };
}) {
  const router = useRouter();

  // ---- ฟิลเตอร์ ----
  const [q, setQ] = useState("");
  const [fCompany, setFCompany] = useState(currentCompany || "");
  const [fRoom, setFRoom] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fActive, setFActive] = useState("");

  const [modal, setModal] = useState<Form | null>(null);
  const [customCat, setCustomCat] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // เปิดฟอร์มแก้ไขอัตโนมัติ เมื่อถูกลิงก์มาจากหน้าบริษัท (?edit=<id>)
  useEffect(() => {
    if (!focusId) return;
    const l = initialLinks.find((x) => x.id === focusId);
    if (l) {
      setFCompany(l.companyId);
      openEdit(l);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const noCompany = companies.length === 0;
  const defaultCompany = fCompany || currentCompany || companies[0]?.id || "";

  // รายการหมวดหมู่ทั้งหมด (จากข้อมูลจริง + ค่าเริ่มต้น)
  const categoryOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATS);
    initialLinks.forEach((l) => l.category && set.add(l.category));
    return Array.from(set);
  }, [initialLinks]);

  // ห้อง LINE ให้เลือกในฟิลเตอร์ (ตามบริษัทที่เลือก ถ้าไม่เลือกบริษัท = ทุกห้อง)
  const roomFilterOptions = useMemo(() => {
    const list: { id: string; label: string }[] = [];
    companies
      .filter((c) => !fCompany || c.id === fCompany)
      .forEach((c) =>
        c.lineGroups.forEach((g) =>
          list.push({ id: g.id, label: fCompany ? g.name : `${c.name} · ${g.name}` })
        )
      );
    return list;
  }, [companies, fCompany]);

  const filtered = initialLinks.filter((l) => {
    if (fCompany && l.companyId !== fCompany) return false;
    if (fRoom) {
      if (fRoom === "__none__") {
        if (l.lineGroupId) return false;
      } else if (l.lineGroupId !== fRoom) return false;
    }
    if (fCategory && (l.category || "") !== fCategory) return false;
    if (fStatus && l.lastStatus !== fStatus) return false;
    if (fActive === "active" && !l.isActive) return false;
    if (fActive === "inactive" && l.isActive) return false;
    const s = q.trim().toLowerCase();
    if (s) {
      const hay =
        l.name.toLowerCase() +
        " " +
        l.url.toLowerCase() +
        " " +
        (l.category || "").toLowerCase() +
        " " +
        (l.company?.name || "").toLowerCase() +
        " " +
        (l.lineGroup?.name || "").toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const anyFilter = !!(q || fCompany || fRoom || fCategory || fStatus || fActive);
  function clearFilters() {
    setQ(""); setFCompany(""); setFRoom(""); setFCategory(""); setFStatus(""); setFActive("");
  }

  const modalGroups =
    companies.find((c) => c.id === modal?.companyId)?.lineGroups || [];

  const groupsFor = (companyId: string) => {
    const cl = filtered.filter((l) => l.companyId === companyId);
    const company = companies.find((c) => c.id === companyId);
    const groups: { key: string; name: string; links: LinkRow[] }[] = [];
    (company?.lineGroups || []).forEach((g) => {
      const gl = cl.filter((l) => l.lineGroupId === g.id);
      if (gl.length) groups.push({ key: g.id, name: g.name, links: gl });
    });
    const validIds = new Set((company?.lineGroups || []).map((g) => g.id));
    const none = cl.filter((l) => !l.lineGroupId || !validIds.has(l.lineGroupId));
    if (none.length) groups.push({ key: "none", name: "ไม่ระบุห้อง", links: none });
    return groups;
  };

  const visibleCompanies = companies.filter((c) =>
    filtered.some((l) => l.companyId === c.id)
  );

  function openAdd() {
    setCustomCat(false);
    setNewCompanyName("");
    setNewRoomName("");
    setModal(emptyForm(defaultCompany));
  }
  function openEdit(l: LinkRow) {
    setNewCompanyName("");
    setNewRoomName("");
    const cat = l.category || "";
    setCustomCat(!!cat && !categoryOptions.includes(cat));
    setModal({
      id: l.id,
      companyId: l.companyId,
      lineGroupId: l.lineGroupId || "",
      name: l.name,
      url: l.url,
      category: cat,
      backupUrl: l.backupUrl || "",
      note: l.note || "",
      isActive: l.isActive,
    });
  }

  async function editBackup(l: LinkRow) {
    const value = prompt(`ลิงก์สำรองสำหรับ ${l.name}`, l.backupUrl || "");
    if (value === null) return;
    const res = await fetch(`/api/links/${l.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backupUrl: value.trim() || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return alert(data.error || "บันทึกไม่สำเร็จ");
    router.refresh();
  }

  const renderRow = (l: LinkRow) => (
    <tr key={l.id} className="border-t border-slate-50 hover:bg-slate-50/50">
      <td className="py-3 px-4 pl-8">
        <div className="font-medium text-slate-700">{l.name}</div>
        <a href={l.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline break-all">
          {l.url}
        </a>
        {l.backupUrl && <div className="text-xs text-slate-400 break-all">สำรอง: {l.backupUrl}</div>}
      </td>
      <td className="py-3 px-4 text-slate-600">{l.category || "-"}</td>
      <td className="py-3 px-4"><StatusBadge status={l.lastStatus} /></td>
      <td className="py-3 px-4 text-slate-500 text-xs">
        <div>{fmtDateTime(l.lastCheckedAt)}</div>
        {l.lastResponseMs !== null && <div className={l.lastStatus === "SLOW" ? "text-amber-600" : "text-slate-400"}>{(l.lastResponseMs / 1000).toFixed(1)} วินาที</div>}
      </td>
      <td className="py-3 px-4">
        <button disabled={!capabilities.edit} onClick={() => toggleActive(l)} className={`badge disabled:cursor-default ${l.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
          {l.isActive ? "เฝ้าดู" : "ไม่เฝ้าดู"}
        </button>
      </td>
      <td className="py-3 px-4 text-right whitespace-nowrap">
        {capabilities.edit && <button className="text-brand-600 hover:underline text-xs mr-3" onClick={() => openEdit(l)}>แก้ไข</button>}
        {!capabilities.edit && capabilities.editBackup && <button className="text-brand-600 hover:underline text-xs mr-3" onClick={() => editBackup(l)}>ลิงก์สำรอง</button>}
        {capabilities.delete && <button className="text-red-500 hover:underline text-xs" onClick={() => remove(l.id, l.name)}>ลบ</button>}
      </td>
    </tr>
  );

  async function save() {
    if (!modal) return;
    if (!modal.name.trim() || !modal.url.trim()) return alert("กรุณากรอกชื่อและลิงก์");
    setSaving(true);
    try {
      let companyId = modal.companyId;
      let lineGroupId: string | null = modal.lineGroupId;

      // สร้างบริษัทใหม่ (ถ้าเลือก "เพิ่มบริษัทใหม่")
      if (companyId === "__new__") {
        if (!newCompanyName.trim()) { alert("กรุณากรอกชื่อบริษัทใหม่"); return; }
        const r = await fetch("/api/companies", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newCompanyName.trim() }),
        });
        if (!r.ok) { alert("เพิ่มบริษัทไม่สำเร็จ"); return; }
        companyId = (await r.json()).id;
      }
      if (!companyId) { alert("กรุณาเลือกบริษัท"); return; }

      // สร้างห้อง LINE ใหม่ (ถ้าเลือก "เพิ่มห้องใหม่")
      if (lineGroupId === "__new__") {
        if (!newRoomName.trim()) { alert("กรุณากรอกชื่อห้อง LINE ใหม่"); return; }
        const r = await fetch("/api/linegroups", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, name: newRoomName.trim() }),
        });
        if (!r.ok) { alert("เพิ่มห้อง LINE ไม่สำเร็จ"); return; }
        lineGroupId = (await r.json()).id;
      }

      const isEdit = !!modal.id;
      const res = await fetch(isEdit ? `/api/links/${modal.id}` : "/api/links", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...modal, companyId, lineGroupId: lineGroupId || null }),
      });
      if (res.ok) { setModal(null); router.refresh(); }
      else { const e = await res.json(); alert(e.error || "บันทึกไม่สำเร็จ"); }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`ลบลิงก์ "${name}" ?`)) return;
    const res = await fetch(`/api/links/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  async function toggleActive(l: LinkRow) {
    await fetch(`/api/links/${l.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !l.isActive }),
    });
    router.refresh();
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Master Data ลิงก์"
        subtitle="คลังข้อมูลลิงก์ทั้งหมด — เพิ่ม/แก้ไขได้ที่นี่ (อัปเดตผ่านระบบ) และกรองดูตามบริษัท ห้อง หมวด หรือสถานะ"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {capabilities.create && <button className="btn-ghost" disabled={noCompany} onClick={() => setImportOpen(true)}>
              ⬆ นำเข้า CSV
            </button>}
            {capabilities.create && <button className="btn-primary" disabled={noCompany} onClick={openAdd}>
              + เพิ่มลิงก์
            </button>}
          </div>
        }
      />

      {noCompany && (
        <div className="card p-6 text-center text-slate-500 mb-4">
          ยังไม่มีบริษัท — ไปที่เมนู <b>บริษัท / ห้อง LINE</b> เพื่อเพิ่มบริษัทก่อน แล้วค่อยเพิ่มลิงก์
        </div>
      )}

      {/* แถบฟิลเตอร์ */}
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <select className="input" value={fCompany} onChange={(e) => { setFCompany(e.target.value); setFRoom(""); }}>
            <option value="">ทุกบริษัท</option>
            {companies.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <select className="input" value={fRoom} onChange={(e) => setFRoom(e.target.value)}>
            <option value="">ทุกห้อง LINE</option>
            <option value="__none__">— ไม่ระบุห้อง —</option>
            {roomFilterOptions.map((r) => (<option key={r.id} value={r.id}>{r.label}</option>))}
          </select>
          <select className="input" value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
            <option value="">ทุกหมวด</option>
            {categoryOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
          <select className="input" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">ทุกสถานะ</option>
            <option value="UP">ใช้งานได้</option>
            <option value="SLOW">โหลดช้า</option>
            <option value="DOWN">ใช้ไม่ได้</option>
            <option value="UNKNOWN">ยังไม่เช็ค</option>
          </select>
          <select className="input" value={fActive} onChange={(e) => setFActive(e.target.value)}>
            <option value="">เฝ้าดู: ทั้งหมด</option>
            <option value="active">เฝ้าดูอยู่</option>
            <option value="inactive">ไม่เฝ้าดู</option>
          </select>
          <input className="input" placeholder="ค้นหา ชื่อ/URL..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-center justify-between mt-2.5">
          <div className="text-xs text-slate-400">พบ {filtered.length} ลิงก์ จากทั้งหมด {initialLinks.length}</div>
          {anyFilter && (
            <button className="text-xs text-brand-600 hover:underline" onClick={clearFilters}>ล้างฟิลเตอร์</button>
          )}
        </div>
      </div>

      {!noCompany && filtered.length === 0 && (
        <div className="card p-10 text-center text-slate-400">
          ไม่พบลิงก์ตามเงื่อนไข — ลองล้างฟิลเตอร์ หรือกด “เพิ่มลิงก์”
        </div>
      )}

      {/* จัดกลุ่มเป็นการ์ดต่อบริษัท → ซอยย่อยตามห้อง LINE */}
      <div className="space-y-5">
        {visibleCompanies.map((c) => {
          const cl = filtered.filter((l) => l.companyId === c.id);
          const up = cl.filter((l) => l.lastStatus === "UP").length;
          const slow = cl.filter((l) => l.lastStatus === "SLOW").length;
          const down = cl.filter((l) => l.lastStatus === "DOWN").length;
          return (
            <div key={c.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-brand-600 text-white">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">🏢</span>
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-xs text-brand-100">{cl.length} ลิงก์</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="badge bg-white/20 text-white">ใช้ได้ {up}</span>
                  {slow > 0 && <span className="badge bg-amber-400 text-amber-950">โหลดช้า {slow}</span>}
                  {down > 0 && <span className="badge bg-red-500 text-white">ใช้ไม่ได้ {down}</span>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 bg-slate-50">
                      <th className="py-2.5 px-4 pl-8 font-medium">ชื่อ / ลิงก์</th>
                      <th className="py-2.5 px-4 font-medium">หมวด</th>
                      <th className="py-2.5 px-4 font-medium">สถานะ</th>
                      <th className="py-2.5 px-4 font-medium">เช็คล่าสุด</th>
                      <th className="py-2.5 px-4 font-medium">เฝ้าดู</th>
                      <th className="py-2.5 px-4 font-medium text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupsFor(c.id).map((g) => (
                      <Fragment key={g.key}>
                        <tr className="bg-brand-50/60">
                          <td colSpan={6} className="px-4 py-2 text-xs font-semibold text-brand-700">
                            💬 ห้อง LINE: {g.name}
                            <span className="ml-1 font-normal text-slate-400">· {g.links.length} ลิงก์</span>
                          </td>
                        </tr>
                        {g.links.map((l) => renderRow(l))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal เพิ่ม/แก้ไข */}
      {modal && (
        <Modal onClose={() => setModal(null)} title={modal.id ? "แก้ไขลิงก์" : "เพิ่มลิงก์ใหม่"}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="บริษัท *">
                <select
                  className="input"
                  value={modal.companyId}
                  onChange={(e) => setModal({ ...modal, companyId: e.target.value, lineGroupId: "" })}
                >
                  {companies.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  {capabilities.manageStructure && <option value="__new__">+ เพิ่มบริษัทใหม่...</option>}
                </select>
                {modal.companyId === "__new__" && (
                  <input className="input mt-2" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="ชื่อบริษัทใหม่" />
                )}
              </Field>
              <Field label="ห้อง LINE">
                <select
                  className="input"
                  value={modal.lineGroupId}
                  onChange={(e) => setModal({ ...modal, lineGroupId: e.target.value })}
                >
                  <option value="">— ไม่ระบุ —</option>
                  {modalGroups.map((g) => (<option key={g.id} value={g.id}>{g.name}</option>))}
                  {capabilities.manageStructure && <option value="__new__">+ เพิ่มห้องใหม่...</option>}
                </select>
                {modal.lineGroupId === "__new__" && (
                  <input className="input mt-2" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="ชื่อห้อง LINE ใหม่" />
                )}
              </Field>
            </div>
            <Field label="ชื่อลิงก์ *">
              <input className="input" value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} placeholder="เช่น หน้าเข้าเล่นหลัก" />
            </Field>
            <Field label="ลิงก์ (URL) *">
              <input className="input" value={modal.url} onChange={(e) => setModal({ ...modal, url: e.target.value })} placeholder="https://..." />
            </Field>
            <Field label="หมวดหมู่">
              <select
                className="input"
                value={customCat ? "__custom__" : modal.category}
                onChange={(e) => {
                  if (e.target.value === "__custom__") { setCustomCat(true); setModal({ ...modal, category: "" }); }
                  else { setCustomCat(false); setModal({ ...modal, category: e.target.value }); }
                }}
              >
                {categoryOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
                <option value="__custom__">+ กำหนดเอง...</option>
              </select>
              {customCat && (
                <input className="input mt-2" value={modal.category} onChange={(e) => setModal({ ...modal, category: e.target.value })} placeholder="พิมพ์หมวดใหม่ เช่น สมัคร" />
              )}
            </Field>
            <Field label="ลิงก์สำรอง">
              <input className="input" value={modal.backupUrl} onChange={(e) => setModal({ ...modal, backupUrl: e.target.value })} placeholder="https://... (ถ้ามี)" />
            </Field>
            <Field label="หมายเหตุ">
              <textarea className="input" rows={2} value={modal.note} onChange={(e) => setModal({ ...modal, note: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={modal.isActive} onChange={(e) => setModal({ ...modal, isActive: e.target.checked })} />
              เฝ้าดูสถานะลิงก์นี้ (ปิดถ้าเป็นลิงก์ LINE ที่เช็คไม่ได้)
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button className="btn-ghost" onClick={() => setModal(null)}>ยกเลิก</button>
            <button className="btn-primary disabled:opacity-60" disabled={saving} onClick={save}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </Modal>
      )}

      {importOpen && (
        <ImportModal
          companies={companies}
          defaultCompany={defaultCompany}
          onClose={() => setImportOpen(false)}
          onDone={() => { setImportOpen(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function ImportModal({
  companies,
  defaultCompany,
  onClose,
  onDone,
}: {
  companies: Company[];
  defaultCompany: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [companyId, setCompanyId] = useState(defaultCompany);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function upload() {
    if (!file || !companyId) return;
    setBusy(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("companyId", companyId);
    const res = await fetch("/api/links/import", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setResult(`นำเข้าสำเร็จ ${data.imported} รายการ` + (data.errors?.length ? ` (ข้าม ${data.errors.length})` : ""));
      setTimeout(onDone, 1200);
    } else {
      setResult(data.error || "นำเข้าไม่สำเร็จ");
    }
  }

  const template =
    "name,url,category,lineGroup,backupUrl,note\nหน้าเข้าเล่นหลัก,https://example.com,ทางเข้า,ห้องแอดมิน A,https://backup.example.com,ลิงก์หลัก";

  return (
    <Modal title="นำเข้าลิงก์จาก CSV" onClose={onClose}>
      <label className="label">นำเข้าเข้าบริษัท *</label>
      <select className="input mb-3" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
        {companies.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
      </select>
      <p className="text-sm text-slate-500 mb-3">
        ไฟล์ CSV ต้องมีคอลัมน์อย่างน้อย <b>name</b> (ชื่อ) และ <b>url</b> (ลิงก์)
        เพิ่มได้: category, lineGroup (ชื่อห้อง LINE — ถ้ายังไม่มีจะสร้างให้อัตโนมัติ), backupUrl, note
      </p>
      <a
        className="text-sm text-brand-600 hover:underline"
        href={"data:text/csv;charset=utf-8," + encodeURIComponent(template)}
        download="domainwatch_template.csv"
      >
        ⬇ ดาวน์โหลดไฟล์ตัวอย่าง (template)
      </a>
      <div className="mt-4">
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
      </div>
      {result && <div className="mt-3 text-sm text-slate-600">{result}</div>}
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn-ghost" onClick={onClose}>ปิด</button>
        <button className="btn-primary disabled:opacity-60" disabled={!file || !companyId || busy} onClick={upload}>
          {busy ? "กำลังนำเข้า..." : "นำเข้า"}
        </button>
      </div>
    </Modal>
  );
}
