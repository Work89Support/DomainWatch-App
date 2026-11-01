"use client";

import { useMemo, useState } from "react";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";

type CrmLinkRow = {
  id: string;
  name: string;
  url: string;
  note: string | null;
  isActive: boolean;
  notifyTelegram: boolean;
  lastStatus: string;
  lastCheckedAt: string | null;
  lastHttpCode: number | null;
  lastResponseMs: number | null;
  lastError: string | null;
};

const emptyForm = { id: "", name: "", url: "", note: "ลิงก์ส่ง SMS", isActive: true, notifyTelegram: true };

function formatCheckedAt(value: string | null) {
  if (!value) return "ยังไม่ตรวจ";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

export default function CrmLinksClient({
  initialLinks,
  canEdit,
  canCheck,
  crmTelegram,
}: {
  initialLinks: CrmLinkRow[];
  canEdit: boolean;
  canCheck: boolean;
  crmTelegram: { mode: "crm" | "global" | "off"; hasDedicated: boolean; chatId: string };
}) {
  const [links, setLinks] = useState(initialLinks);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showTelegram, setShowTelegram] = useState(false);
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState(crmTelegram.chatId);
  const [telegramState, setTelegramState] = useState(crmTelegram);

  const totals = useMemo(() => ({
    total: links.length,
    up: links.filter((link) => link.isActive && link.lastStatus === "UP").length,
    slow: links.filter((link) => link.isActive && link.lastStatus === "SLOW").length,
    down: links.filter((link) => link.isActive && link.lastStatus === "DOWN").length,
    unknown: links.filter((link) => link.isActive && link.lastStatus === "UNKNOWN").length,
  }), [links]);

  async function reload() {
    const response = await fetch("/api/crm-links", { cache: "no-store" });
    if (response.ok) setLinks(await response.json());
  }

  async function checkAll() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/crm-links/check", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      await reload();
      setMessage(`ตรวจเสร็จแล้ว ${data.checked} ลิงก์ · หากสถานะยืนยันเปลี่ยน ระบบจะแจ้ง Telegram อัตโนมัติ`);
    } else {
      setMessage(data.error || "ตรวจไม่สำเร็จ");
    }
    setBusy(false);
  }

  async function testTelegram() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/crm-links/test-telegram", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? `ส่งข้อความทดสอบ Telegram แล้ว ${data.sent} กลุ่ม` : (data.error || "ส่ง Telegram ไม่สำเร็จ"));
    setBusy(false);
  }

  async function saveTelegram() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/crm-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tgBotToken: telegramToken, tgChatId: telegramChatId }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setTelegramState({ mode: "crm", hasDedicated: true, chatId: data.chatId });
      setTelegramToken("");
      setShowTelegram(false);
      setMessage("บันทึก Telegram สำหรับ CRM แล้ว");
    } else setMessage(data.error || "บันทึก Telegram ไม่สำเร็จ");
    setBusy(false);
  }

  async function clearTelegram() {
    setBusy(true);
    const response = await fetch("/api/crm-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clear: true }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setTelegramState({ mode: data.mode || "off", hasDedicated: false, chatId: "" });
      setTelegramChatId("");
      setShowTelegram(false);
      setMessage("ปิด Telegram สำหรับ CRM แล้ว");
    }
    setBusy(false);
  }

  function startAdd() {
    setForm(emptyForm);
    setShowForm(true);
    setMessage(null);
  }

  function startEdit(link: CrmLinkRow) {
    setForm({ id: link.id, name: link.name, url: link.url, note: link.note || "", isActive: link.isActive, notifyTelegram: link.notifyTelegram });
    setShowForm(true);
    setMessage(null);
  }

  async function save() {
    if (!form.name.trim() || !form.url.trim()) {
      setMessage("กรุณากรอกชื่อและ URL");
      return;
    }
    setBusy(true);
    const response = await fetch(form.id ? `/api/crm-links/${form.id}` : "/api/crm-links", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      await reload();
      setShowForm(false);
      setForm(emptyForm);
      setMessage(form.id ? "แก้ไขลิงก์แล้ว" : "เพิ่มลิงก์แล้ว");
    } else {
      setMessage(data.error || "บันทึกไม่สำเร็จ");
    }
    setBusy(false);
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="CRM / ลิงก์ส่ง SMS"
        subtitle="ตรวจลิงก์สั้นของ CRM แยกจาก Master Data, KPI และเคส · แจ้ง Telegram เมื่อสถานะยืนยันเปลี่ยน"
        action={
          <div className="flex flex-wrap gap-2">
            {canEdit && <button className="btn-ghost" onClick={startAdd}>+ เพิ่มลิงก์ CRM</button>}
            {canCheck && <button className="btn-primary" disabled={busy} onClick={checkAll}>{busy ? "กำลังตรวจ..." : "🔄 ตรวจทั้งหมด"}</button>}
          </div>
        }
      />

      <div className="card p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="text-lg">📢</div>
        <div className="flex-1"><div className="font-semibold text-slate-800">Telegram สำหรับ CRM</div><div className="text-xs text-slate-500">แจ้งเมื่อใช้ไม่ได้ครบ 2 รอบ และแจ้งกลับเมื่อใช้งานได้ครบ 2 รอบ</div></div>
        <span className={`badge ${telegramState.mode === "off" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{telegramState.mode === "crm" ? "กลุ่ม CRM โดยเฉพาะ" : telegramState.mode === "global" ? "ใช้กลุ่มกลาง" : "ยังไม่ได้ตั้งค่า"}</span>
        {canEdit && <button className="btn-ghost text-xs" onClick={() => setShowTelegram(true)}>ตั้งค่า Telegram</button>}
        {canCheck && telegramState.mode !== "off" && <button className="btn-ghost text-xs" disabled={busy} onClick={testTelegram}>ส่งข้อความทดสอบ</button>}
      </div>

      {showTelegram && <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-3"><h2 className="font-semibold text-slate-800">ตั้งค่า Telegram สำหรับ CRM</h2><button className="text-slate-400" onClick={() => setShowTelegram(false)}>ปิด</button></div>
        <p className="text-xs text-slate-500 mb-3">ตั้ง Bot และกลุ่มรับแจ้งเฉพาะลิงก์ CRM ข้อมูลนี้ไม่กระทบ Telegram ของบริษัทอื่น</p>
        <label className="text-sm text-slate-600">Bot Token<input type="password" className="input mt-1 mb-3" value={telegramToken} onChange={(event) => setTelegramToken(event.target.value)} placeholder={telegramState.hasDedicated ? "•••••• (ไม่กรอก = คงเดิม)" : "123456:ABC-DEF..."} autoComplete="off" /></label>
        <label className="text-sm text-slate-600">Chat ID (คั่นด้วย , ได้)<input className="input mt-1" value={telegramChatId} onChange={(event) => setTelegramChatId(event.target.value)} placeholder="-1001234567890" /></label>
        <div className="flex justify-between gap-2 mt-4">{telegramState.hasDedicated ? <button className="btn-ghost text-xs" disabled={busy} onClick={clearTelegram}>ปิดการแจ้งเตือน CRM</button> : <span />}<div className="flex gap-2"><button className="btn-ghost" onClick={() => setShowTelegram(false)}>ยกเลิก</button><button className="btn-primary" disabled={busy} onClick={saveTelegram}>{busy ? "กำลังบันทึก..." : "บันทึก"}</button></div></div>
      </div>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="ลิงก์ CRM ทั้งหมด" value={totals.total} tone="slate" />
        <StatCard label="ใช้งานได้" value={totals.up} tone="green" />
        <StatCard label="โหลดช้า" value={totals.slow} tone="amber" />
        <StatCard label="ใช้ไม่ได้" value={totals.down} tone="red" />
        <StatCard label="ยังไม่ตรวจ" value={totals.unknown} tone="brand" />
      </div>

      {message && <div role="status" className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message}</div>}

      {showForm && (
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold text-slate-800">{form.id ? "แก้ไขลิงก์ CRM" : "เพิ่มลิงก์ CRM"}</h2>
            <button className="text-slate-400 hover:text-slate-700" onClick={() => setShowForm(false)}>ปิด</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm text-slate-600">ชื่อรายการ<input className="input mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="เช่น Ferrari8" /></label>
            <label className="text-sm text-slate-600">URL<input className="input mt-1" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://urlio.co/..." /></label>
            <label className="text-sm text-slate-600 md:col-span-2">หมายเหตุ<input className="input mt-1" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> เปิดตรวจอัตโนมัติ</label>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.notifyTelegram} onChange={(event) => setForm({ ...form, notifyTelegram: event.target.checked })} /> แจ้ง Telegram เมื่อสถานะเปลี่ยน</label>
          <div className="mt-4 flex gap-2"><button className="btn-primary" disabled={busy} onClick={save}>บันทึก</button><button className="btn-ghost" onClick={() => setShowForm(false)}>ยกเลิก</button></div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr><th className="px-5 py-3">รายการ</th><th className="px-5 py-3">ลิงก์ส่ง SMS</th><th className="px-5 py-3">สถานะ</th><th className="px-5 py-3">ผลตรวจ</th><th className="px-5 py-3">ตรวจล่าสุด</th><th className="px-5 py-3"></th></tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id} className={`border-t border-slate-100 ${link.isActive ? "" : "opacity-55"}`}>
                  <td className="px-5 py-4"><div className="font-semibold text-slate-800">{link.name}</div><div className="text-xs text-slate-400 mt-1">{link.note || "ลิงก์ CRM"}</div></td>
                  <td className="px-5 py-4"><a href={link.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline break-all">{link.url}</a></td>
                  <td className="px-5 py-4">{link.isActive ? <StatusBadge status={link.lastStatus} /> : <span className="badge bg-slate-100 text-slate-500">พักตรวจ</span>}</td>
                  <td className="px-5 py-4 text-slate-500"><div>{link.lastHttpCode ? `HTTP ${link.lastHttpCode}` : "—"}</div><div className="text-xs mt-1">{link.lastResponseMs !== null ? `${(link.lastResponseMs / 1000).toFixed(1)} วินาที` : "ยังไม่มีเวลาโหลด"}</div>{link.lastError && <div className="text-xs text-amber-600 mt-1 max-w-xs truncate" title={link.lastError}>{link.lastError}</div>}</td>
                  <td className="px-5 py-4 text-slate-500">{formatCheckedAt(link.lastCheckedAt)}</td>
                  <td className="px-5 py-4 text-right">{canEdit && <button className="btn-ghost text-xs" onClick={() => startEdit(link)}>แก้ไข</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {links.length === 0 && <div className="p-10 text-center text-slate-400">ยังไม่มีลิงก์ CRM</div>}
      </div>
    </div>
  );
}
