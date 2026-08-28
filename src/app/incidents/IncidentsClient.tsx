"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, IncidentStatusBadge } from "@/components/ui";
import { fmtDateTime, fmtMinutes } from "@/lib/format";
import CompanyFilter from "@/components/CompanyFilter";

type Incident = {
  id: string;
  status: string;
  detectedAt: string;
  notifiedAt: string | null;
  adminAckAt: string | null;
  adminUpdatedAt: string | null;
  itAckAt: string | null;
  itResolvedAt: string | null;
  resolvedAt: string | null;
  cause: string | null;
  newUrl: string | null;
  backupUrl: string | null;
  adminResponseMin: number | null;
  itResponseMin: number | null;
  link: {
    id: string;
    companyId: string;
    lineGroupId: string | null;
    name: string;
    url: string;
    category: string | null;
    backupUrl: string | null;
    note: string | null;
    isActive: boolean;
    company: { id: string; name: string };
    lineGroup: { id: string; name: string } | null;
  };
};

type Company = { id: string; name: string; lineGroups: Array<{ id: string; name: string }> };

type MobileIncident = {
  id: string;
  status: string;
  detectedAt: string;
  resolvedAt: string | null;
  httpCode: number | null;
  responseMs: number | null;
  error: string | null;
  finalUrl: string | null;
  redirectCount: number;
  redirectType: string | null;
  redirectChain: string[] | null;
  pageTitle: string | null;
  blockPageDetected: boolean;
  agent: {
    id: string;
    name: string;
    carrier: string;
    reportedCarrier: string | null;
    deviceLabel: string | null;
    appVersion: string | null;
  };
  link: Incident["link"];
};

type MobileLinkForm = {
  companyId: string;
  lineGroupId: string;
  name: string;
  url: string;
  category: string;
  backupUrl: string;
  note: string;
  isActive: boolean;
};

const DEFAULT_CATEGORIES = ["ทางเข้า", "ริชเมนู", "โปรโมชัน", "ทั่วไป"];

export default function IncidentsClient({
  initial,
  mobileInitial,
  companies,
  currentCompany,
  initialIncidentId,
  canAdmin,
  canIt,
  showKpi,
}: {
  initial: Incident[];
  mobileInitial: MobileIncident[];
  companies: Company[];
  currentCompany?: string;
  initialIncidentId?: string;
  canAdmin: boolean;
  canIt: boolean;
  showKpi: boolean;
}) {
  const router = useRouter();
  // ลิงก์จาก Telegram อาจชี้มายังเคสที่บอทปิดอัตโนมัติแล้ว
  // เปิดประวัติทั้งหมดทันทีเพื่อไม่ให้เคสดังกล่าวดูเหมือนหายไปจากระบบ
  const [filter, setFilter] = useState<"open" | "all">(initialIncidentId ? "all" : "open");
  const [source, setSource] = useState<"ALL" | "SYSTEM" | "MOBILE">("ALL");
  const [selected, setSelected] = useState<Incident | null>(
    initial.find((incident) => incident.id === initialIncidentId) || null
  );
  const [selectedMobile, setSelectedMobile] = useState<MobileIncident | null>(
    mobileInitial.find((incident) => incident.id === initialIncidentId) || null
  );
  const [mobileLinkModal, setMobileLinkModal] = useState<{ incident: MobileIncident; form: MobileLinkForm } | null>(null);
  const [mobileUpdateBusy, setMobileUpdateBusy] = useState(false);
  const [mobileMarkBusyId, setMobileMarkBusyId] = useState<string | null>(null);

  const systemOpen = initial.filter((incident) => incident.status !== "CLOSED").length;
  const mobileOpen = mobileInitial.filter((incident) => incident.status !== "CLOSED").length;
  const mobileWaitingAction = mobileInitial.filter((incident) => incident.status === "OPEN").length;
  const mobileWaitingVerification = mobileInitial.filter((incident) => incident.status === "ADMIN_UPDATED").length;
  const openCount = source === "SYSTEM" ? systemOpen : source === "MOBILE" ? mobileOpen : systemOpen + mobileOpen;
  const totalCount = source === "SYSTEM" ? initial.length : source === "MOBILE" ? mobileInitial.length : initial.length + mobileInitial.length;

  const list = filter === "open"
    ? initial.filter((incident) => incident.status !== "CLOSED")
    : initial;
  const mobileList = filter === "open"
    ? mobileInitial.filter((incident) => incident.status !== "CLOSED")
    : mobileInitial;
  const showSystem = source !== "MOBILE";
  const showMobile = source !== "SYSTEM";

  function beginMobileEdit(incident: MobileIncident) {
    setMobileLinkModal({
      incident,
      form: {
        companyId: incident.link.companyId,
        lineGroupId: incident.link.lineGroupId || "",
        name: incident.link.name,
        url: incident.finalUrl && incident.redirectType === "POSSIBLE_DOMAIN_MOVE" ? incident.finalUrl : incident.link.url,
        category: incident.link.category || "ทั่วไป",
        backupUrl: incident.link.backupUrl || "",
        note: incident.link.note || "",
        isActive: incident.link.isActive,
      },
    });
  }

  async function updateMobileIncidentLink() {
    if (!mobileLinkModal) return;
    const { incident, form } = mobileLinkModal;
    if (!form.name.trim() || !form.url.trim() || !form.companyId) return alert("กรุณากรอกบริษัท ชื่อลิงก์ และ URL");
    setMobileUpdateBusy(true);
    const response = await fetch(`/api/network-incidents/${incident.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "admin_update",
        newUrl: form.url,
        companyId: form.companyId,
        lineGroupId: form.lineGroupId || null,
        name: form.name,
        category: form.category,
        backupUrl: form.backupUrl || null,
        note: form.note || null,
        isActive: form.isActive,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setMobileUpdateBusy(false);
    if (!response.ok) return alert(data.error || "แก้ไขลิงก์ไม่สำเร็จ");
    setMobileLinkModal(null);
    router.refresh();
  }

  async function markMobileIncidentUpdated(incident: MobileIncident) {
    setMobileMarkBusyId(incident.id);
    const response = await fetch(`/api/network-incidents/${incident.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_updated" }),
    });
    const data = await response.json().catch(() => ({}));
    setMobileMarkBusyId(null);
    if (!response.ok) return alert(data.error || "เปลี่ยนสถานะไม่สำเร็จ");
    router.refresh();
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={showKpi ? "เหตุการณ์ & KPI" : "เหตุการณ์"}
        subtitle={showKpi ? "ติดตามลิงก์ที่ล่ม จับเวลาการตอบสนองของแอดมินและไอที" : "ติดตามและจัดการลิงก์ที่มีปัญหา"}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <CompanyFilter companies={companies} value={currentCompany} />
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {([
                ["ALL", "ทั้งหมด"],
                ["SYSTEM", "🖥️ ระบบกลาง"],
                ["MOBILE", "📱 เครือข่ายซิม"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setSource(value)}
                  className={`px-3 py-1.5 text-sm rounded-md ${source === value ? "bg-white shadow text-brand-700 font-medium" : "text-slate-500"}`}
                >{label}</button>
              ))}
            </div>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {(["open", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-sm rounded-md ${filter === f ? "bg-white shadow text-brand-700 font-medium" : "text-slate-500"}`}
                >
                  {f === "open"
                    ? `เปิดค้าง (${openCount})`
                    : `ประวัติทั้งหมด (${totalCount})`}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {showMobile && mobileList.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-800">📱 ปัญหาที่ตรวจจากซิมมือถือ</h2>
            {mobileWaitingAction > 0 && <span className="badge bg-red-50 text-red-600">รอจัดการ {mobileWaitingAction}</span>}
            {mobileWaitingVerification > 0 && <span className="badge bg-amber-50 text-amber-700">รอตรวจยืนยัน {mobileWaitingVerification}</span>}
            {filter === "all" && <span className="badge bg-slate-100 text-slate-500">ทั้งหมด {mobileList.length}</span>}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {mobileList.map((incident) => (
              <div key={incident.id} className={`card p-5 ${mobileIncidentCardTone(incident.status)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge bg-brand-50 text-brand-700">{incident.agent.reportedCarrier || incident.agent.carrier}</span>
                      <span className="font-semibold text-slate-800">{incident.link.name}</span>
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-500">เคส #{incident.id.slice(-8).toUpperCase()}</div>
                    <a href={incident.link.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline break-all">
                      {incident.link.url} ↗
                    </a>
                    <div className="mt-2 text-xs text-slate-500">
                      📱 {incident.agent.name} · 🏢 {incident.link.company.name}
                      {incident.link.lineGroup ? ` · 💬 ${incident.link.lineGroup.name}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      ตรวจพบ {fmtDateTime(incident.detectedAt)}
                      {incident.httpCode ? ` · HTTP ${incident.httpCode}` : ""}
                      {incident.responseMs ? ` · ${(incident.responseMs / 1000).toFixed(1)} วินาที` : ""}
                    </div>
                    {incident.error && <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">สาเหตุ: {incident.error}</div>}
                    {incident.redirectCount > 0 && incident.finalUrl && (
                      <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 break-all">
                        ↪️ {incident.redirectType === "NETWORK_BLOCK" ? "หน้าปิดกั้นของเครือข่าย" : "ปลายทาง Redirect"}: {incident.finalUrl}
                      </div>
                    )}
                  </div>
                  <MobileIncidentStatusBadge status={incident.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {canAdmin && <button className="btn-primary text-xs py-1.5" onClick={() => beginMobileEdit(incident)}>✏️ แก้ลิงก์ตรงนี้</button>}
                  {canAdmin && incident.status === "OPEN" && (
                    <button
                      className="btn-ghost text-xs py-1.5"
                      disabled={mobileMarkBusyId === incident.id}
                      onClick={() => markMobileIncidentUpdated(incident)}
                    >
                      {mobileMarkBusyId === incident.id ? "กำลังบันทึก..." : "✓ ปรับแก้แล้ว — รอตรวจ"}
                    </button>
                  )}
                  <button className="btn-ghost text-xs py-1.5" onClick={() => setSelectedMobile(incident)}>ดูรายละเอียดจากเครื่องตรวจ →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSystem && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {list.length === 0 && (!showMobile || mobileList.length === 0) && (
          <div className="card p-10 text-center text-slate-400 lg:col-span-2">
            <div>ไม่มีเหตุการณ์เปิดค้าง</div>
            {filter === "open" && totalCount > 0 && (
              <button className="btn-ghost text-xs mt-3" onClick={() => setFilter("all")}>
                ดูประวัติที่ปิดแล้ว {totalCount} เคส
              </button>
            )}
          </div>
        )}
        {list.map((i) => (
          <div key={i.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-slate-800">{i.link.name}</div>
                <div className="text-[11px] font-medium text-slate-500">
                  เคส #{i.id.slice(-8).toUpperCase()}
                </div>
                <a
                  href={i.link.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-brand-600 hover:underline break-all inline-flex items-center gap-1"
                >
                  {i.link.url} <span className="text-brand-400">↗</span>
                </a>
                <div className="text-xs text-slate-400 mt-1">
                  🏢 {i.link.company.name}
                  {i.link.lineGroup ? ` · 💬 ${i.link.lineGroup.name}` : ""}
                  {` · 🏷️ ${i.link.category || "ทั่วไป"} · ตรวจพบ ${fmtDateTime(i.detectedAt)}`}
                  {i.resolvedAt ? ` · กลับมา ${fmtDateTime(i.resolvedAt)}` : ""}
                </div>
              </div>
              <IncidentStatusBadge status={i.status} />
            </div>

            {/* Timeline KPI */}
            {showKpi && <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
              <KpiPill label="แอดมินอัพเดต" value={fmtMinutes(i.adminResponseMin)} done={!!i.adminUpdatedAt} />
              <KpiPill label="ไอทีชี้แจง/สำรอง" value={fmtMinutes(i.itResponseMin)} done={!!i.itResolvedAt} />
            </div>}

            {i.cause && (
              <div className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg p-2">
                <b>สาเหตุ (IT):</b> {i.cause}
                {i.backupUrl && <div className="text-brand-600 break-all mt-1">สำรอง: {i.backupUrl}</div>}
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-4">
              <button className="btn-ghost text-xs py-1.5" onClick={() => setSelected(i)}>
                {canAdmin || canIt ? "จัดการเคส →" : "ดูรายละเอียด →"}
              </button>
            </div>
          </div>
        ))}
      </div>}

      {!showSystem && mobileList.length === 0 && (
        <div className="card p-10 text-center text-slate-400">ไม่มีเหตุการณ์จากเครือข่ายซิมตามเงื่อนไข</div>
      )}

      {selected && (
        <IncidentPanel
          incident={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            router.refresh();
          }}
          canAdmin={canAdmin}
          canIt={canIt}
        />
      )}
      {selectedMobile && <MobileIncidentPanel incident={selectedMobile} onClose={() => setSelectedMobile(null)} />}
      {mobileLinkModal && (
        <MobileLinkEditModal
          incident={mobileLinkModal.incident}
          form={mobileLinkModal.form}
          companies={companies}
          busy={mobileUpdateBusy}
          onChange={(form) => setMobileLinkModal({ ...mobileLinkModal, form })}
          onClose={() => setMobileLinkModal(null)}
          onSave={updateMobileIncidentLink}
        />
      )}
    </div>
  );
}

function MobileLinkEditModal({
  incident,
  form,
  companies,
  busy,
  onChange,
  onClose,
  onSave,
}: {
  incident: MobileIncident;
  form: MobileLinkForm;
  companies: Company[];
  busy: boolean;
  onChange: (form: MobileLinkForm) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const company = companies.find((item) => item.id === form.companyId);
  const categoryOptions = Array.from(new Set([...DEFAULT_CATEGORIES, incident.link.category || "", form.category])).filter(Boolean);
  const [customCategory, setCustomCategory] = useState(!DEFAULT_CATEGORIES.includes(form.category));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[92vh] overflow-y-auto p-6" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-slate-800">แก้ไขลิงก์</h3>
          <div className="mt-1 text-xs text-slate-400">เคสจากซิม #{incident.id.slice(-8).toUpperCase()} · แก้ไข Master Data จากหน้านี้ได้ทันที</div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EditField label="บริษัท *">
              <select className="input" value={form.companyId} onChange={(event) => onChange({ ...form, companyId: event.target.value, lineGroupId: "" })}>
                {companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </EditField>
            <EditField label="ห้อง LINE">
              <select className="input" value={form.lineGroupId} onChange={(event) => onChange({ ...form, lineGroupId: event.target.value })}>
                <option value="">— ไม่ระบุ —</option>
                {(company?.lineGroups || []).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </EditField>
          </div>
          <EditField label="ชื่อลิงก์ *">
            <input className="input" value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} />
          </EditField>
          <EditField label="ลิงก์ (URL) *">
            <input className="input" value={form.url} onChange={(event) => onChange({ ...form, url: event.target.value })} placeholder="https://..." />
          </EditField>
          <EditField label="หมวดหมู่">
            <select className="input" value={customCategory ? "__custom__" : form.category} onChange={(event) => {
              if (event.target.value === "__custom__") {
                setCustomCategory(true);
                onChange({ ...form, category: "" });
              } else {
                setCustomCategory(false);
                onChange({ ...form, category: event.target.value });
              }
            }}>
              {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
              <option value="__custom__">+ กำหนดเอง...</option>
            </select>
            {customCategory && <input className="input mt-2" value={form.category} onChange={(event) => onChange({ ...form, category: event.target.value })} placeholder="เช่น สมัคร" />}
          </EditField>
          <EditField label="ลิงก์สำรอง">
            <input className="input" value={form.backupUrl} onChange={(event) => onChange({ ...form, backupUrl: event.target.value })} placeholder="https://... (ถ้ามี)" />
          </EditField>
          <EditField label="หมายเหตุ">
            <textarea className="input" rows={3} value={form.note} onChange={(event) => onChange({ ...form, note: event.target.value })} />
          </EditField>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.isActive} onChange={(event) => onChange({ ...form, isActive: event.target.checked })} />
            เฝ้าดูสถานะลิงก์นี้ (ปิดถ้าเป็นลิงก์ LINE ที่เช็คไม่ได้)
          </label>
          {normalizeForComparison(form.url) !== normalizeForComparison(incident.link.url) && (
            <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">URL มีการเปลี่ยนแปลง ระบบจะตรวจลิงก์ใหม่ก่อนบันทึกและปิดเคสเก่า เมื่อมือถือทำงานรอบถัดไปจะเริ่มตรวจ URL ใหม่นี้</div>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" disabled={busy} onClick={onClose}>ยกเลิก</button>
          <button className="btn-primary disabled:opacity-60" disabled={busy || !form.companyId || !form.name.trim() || !form.url.trim()} onClick={onSave}>{busy ? "กำลังตรวจและบันทึก..." : "บันทึก"}</button>
        </div>
      </div>
    </div>
  );
}

function mobileIncidentCardTone(status: string) {
  if (status === "ADMIN_UPDATED") return "border-amber-200 bg-amber-50/20";
  if (status === "CLOSED") return "border-emerald-100";
  return "border-red-100";
}

function MobileIncidentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    OPEN: { text: "เปิด (รอจัดการ)", cls: "bg-red-50 text-red-600" },
    ADMIN_UPDATED: { text: "ปรับแก้แล้ว · รอตรวจยืนยัน", cls: "bg-amber-100 text-amber-800" },
    IT_RESOLVED: { text: "กำลังตรวจยืนยัน", cls: "bg-brand-50 text-brand-700" },
    CLOSED: { text: "จัดการเรียบร้อย", cls: "bg-emerald-50 text-emerald-700" },
  };
  const value = map[status] || map.OPEN;
  return <span className={`badge shrink-0 ${value.cls}`}>{value.text}</span>;
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}

function normalizeForComparison(value: string) {
  try {
    const url = new URL(value.trim());
    url.hash = "";
    return url.toString();
  } catch {
    return value.trim();
  }
}

function MobileIncidentPanel({ incident, onClose }: { incident: MobileIncident; onClose: () => void }) {
  const carrier = incident.agent.reportedCarrier || incident.agent.carrier;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-xl p-6 max-h-[92vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-brand-700">📱 ตรวจจากซิม {carrier}</div>
            <h3 className="mt-1 text-lg font-semibold text-slate-800">{incident.link.name}</h3>
            <div className="text-xs text-slate-400">เคส #{incident.id.slice(-8).toUpperCase()}</div>
          </div>
          <MobileIncidentStatusBadge status={incident.status} />
        </div>
        <div className="mt-5 grid gap-3 text-sm">
          <Detail label="เครื่องตรวจ" value={`${incident.agent.name} · ${incident.agent.deviceLabel || "ไม่ระบุรุ่น"} · แอป ${incident.agent.appVersion || "-"}`} />
          <Detail label="บริษัท / ห้อง" value={`${incident.link.company.name}${incident.link.lineGroup ? ` · ${incident.link.lineGroup.name}` : ""}`} />
          <Detail label="ตรวจพบ" value={fmtDateTime(incident.detectedAt)} />
          <Detail label="ผลตอบกลับ" value={`HTTP ${incident.httpCode ?? "-"} · ${incident.responseMs ? `${(incident.responseMs / 1000).toFixed(1)} วินาที` : "ไม่ทราบเวลา"}`} />
          <Detail label="สาเหตุจากเครื่อง" value={incident.error || "ไม่ระบุ"} danger />
          {incident.redirectCount > 0 && incident.finalUrl && <>
            <Detail label="ประเภท Redirect" value={incident.redirectType === "NETWORK_BLOCK" ? "หน้าปิดกั้นจากเครือข่ายมือถือ" : incident.redirectType === "POSSIBLE_DOMAIN_MOVE" ? "อาจมีการย้ายโดเมน — ยังไม่ได้เปลี่ยน Master Data" : "Redirect ปกติ"} danger={incident.redirectType === "NETWORK_BLOCK"} />
            <Detail label="URL ปลายทาง" value={incident.finalUrl} />
            <Detail label="จำนวน / เส้นทาง" value={`${incident.redirectCount} ครั้ง${Array.isArray(incident.redirectChain) ? ` · ${incident.redirectChain.join(" → ")}` : ""}`} />
            {incident.pageTitle && <Detail label="ชื่อหน้าปลายทาง" value={incident.pageTitle} />}
          </>}
          <div>
            <div className="text-xs text-slate-400">ลิงก์ที่ตรวจ</div>
            <a href={incident.link.url} target="_blank" rel="noreferrer" className="text-brand-600 break-all hover:underline">{incident.link.url} ↗</a>
          </div>
        </div>
        <button className="btn-ghost mt-6 w-full" onClick={onClose}>ปิดหน้าต่าง</button>
      </div>
    </div>
  );
}

function Detail({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${danger ? "bg-red-50" : "bg-slate-50"}`}>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 break-words ${danger ? "text-red-700" : "text-slate-700"}`}>{value}</div>
    </div>
  );
}

function KpiPill({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${done ? "bg-emerald-50" : "bg-amber-50"}`}>
      <div className="text-slate-400">{label}</div>
      <div className={`font-semibold ${done ? "text-emerald-700" : "text-amber-600"}`}>
        {done ? value : "รอดำเนินการ"}
      </div>
    </div>
  );
}

function IncidentPanel({
  incident,
  onClose,
  onDone,
  canAdmin,
  canIt,
}: {
  incident: Incident;
  onClose: () => void;
  onDone: () => void;
  canAdmin: boolean;
  canIt: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [newUrl, setNewUrl] = useState(incident.newUrl || "");
  const [cause, setCause] = useState(incident.cause || "");
  const [backupUrl, setBackupUrl] = useState(incident.backupUrl || "");

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    const res = await fetch(`/api/incidents/${incident.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setBusy(false);
    if (res.ok) onDone();
    else {
      const e = await res.json();
      alert(e.error || "ทำรายการไม่สำเร็จ");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-xl p-6 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{incident.link.name}</h3>
            <div className="text-xs text-slate-400">🏢 {incident.link.company.name}</div>
            <a href={incident.link.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline break-all inline-flex items-center gap-1">
              {incident.link.url} <span className="text-brand-400">↗</span>
            </a>
          </div>
          <IncidentStatusBadge status={incident.status} />
        </div>

        {/* Timeline */}
        <div className="space-y-2 text-sm mb-5">
          <TimelineRow label="ตรวจพบล่ม" time={incident.detectedAt} active />
          <TimelineRow
            label={incident.notifiedAt
              ? "Telegram ยืนยันการส่งแล้ว"
              : "เรียกส่ง Telegram แล้ว (ไม่พบผลตอบรับ)"}
            time={incident.notifiedAt || incident.detectedAt}
            uncertain={!incident.notifiedAt}
          />
          <TimelineRow label="แอดมินรับเรื่อง" time={incident.adminAckAt} />
          <TimelineRow label="แอดมินอัพเดตลิงก์ (จบหน้าที่แอดมิน)" time={incident.adminUpdatedAt} />
          <TimelineRow label="ไอทีรับเรื่อง" time={incident.itAckAt} />
          <TimelineRow label="ไอทีชี้แจงสาเหตุ + ลิงก์สำรอง" time={incident.itResolvedAt} />
          <TimelineRow label="ปิดเคส (กลับมาใช้ได้)" time={incident.resolvedAt} />
        </div>

        {/* ส่วนแอดมิน */}
        {canAdmin && <div className="border border-slate-100 rounded-xl p-4 mb-3">
          <div className="text-sm font-semibold text-slate-700 mb-2">👤 ส่วนของแอดมิน</div>
          {!incident.adminAckAt && (
            <button className="btn-ghost text-xs mb-3" disabled={busy} onClick={() => act("admin_ack")}>
              รับเรื่อง (เริ่มจับ KPI)
            </button>
          )}
          <label className="label">เปลี่ยนเป็นลิงก์ใหม่ (จะอัพเดตใน Master data ให้บอทอ่านใหม่)</label>
          <input className="input mb-2" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://ลิงก์ใหม่..." />
          <button
            className="btn-primary text-xs w-full disabled:opacity-60"
            disabled={busy || !newUrl.trim()}
            onClick={() => act("admin_update", { newUrl: newUrl || undefined })}
          >
            {busy ? "กำลังตรวจลิงก์..." : "ตรวจและบันทึกลิงก์ใหม่"}
          </button>
        </div>}

        {/* ส่วนไอที */}
        {canIt && <div className="border border-slate-100 rounded-xl p-4 mb-3">
          <div className="text-sm font-semibold text-slate-700 mb-2">🛠️ ส่วนของไอที</div>
          {!incident.itAckAt && (
            <button className="btn-ghost text-xs mb-3" disabled={busy} onClick={() => act("it_ack")}>
              รับเรื่อง (เริ่มจับ KPI)
            </button>
          )}
          <label className="label">สาเหตุ</label>
          <input className="input mb-2" value={cause} onChange={(e) => setCause(e.target.value)} placeholder="เช่น โดเมนถูกบล็อก" />
          <label className="label">ลิงก์สำรองที่เตรียมให้แอดมิน</label>
          <input className="input mb-2" value={backupUrl} onChange={(e) => setBackupUrl(e.target.value)} placeholder="https://ลิงก์สำรอง..." />
          <button
            className="btn-primary text-xs w-full disabled:opacity-60"
            disabled={busy}
            onClick={() => act("it_resolve", { cause: cause || undefined, backupUrl: backupUrl || undefined })}
          >
            บันทึกสาเหตุ + ลิงก์สำรอง (จบหน้าที่ไอที)
          </button>
        </div>}

        <div className="flex justify-between gap-2 mt-4">
          {canAdmin && incident.status !== "CLOSED" ? (
            <button className="btn-danger text-xs" disabled={busy} onClick={() => act("close")}>
              ปิดเคส (ลิงก์กลับมาใช้ได้)
            </button>
          ) : <span />}
          <button className="btn-ghost text-xs" onClick={onClose}>ปิดหน้าต่าง</button>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  label,
  time,
  active,
  uncertain,
}: {
  label: string;
  time: string | null;
  active?: boolean;
  uncertain?: boolean;
}) {
  const done = !!time;
  return (
    <div className="flex items-center gap-3">
      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${uncertain ? "bg-amber-400" : done ? "bg-emerald-500" : active ? "bg-red-500" : "bg-slate-200"}`} />
      <span className={`${uncertain ? "text-amber-700" : done ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
      <span className="ml-auto text-xs text-slate-400">{time ? fmtDateTime(time) : "-"}</span>
    </div>
  );
}
