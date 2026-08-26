"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { PageHeader } from "@/components/ui";

type UrlStatus = {
  id: string; url: string; status: "UP" | "SLOW" | "DOWN" | "UNKNOWN";
  httpCode: number | null; responseMs: number | null; error: string | null; checkedAt: string;
  failureStreak: number;
};
type NetworkIncident = {
  id: string; status: string; detectedAt: string; resolvedAt: string | null;
  link: { name: string; url: string; company: { name: string }; lineGroup: { name: string } | null };
};
type Agent = {
  id: string; name: string; carrier: string; isActive: boolean; deviceLabel: string | null;
  hasEnrollment: boolean;
  appVersion: string | null; networkType: string | null; reportedCarrier: string | null;
  enrolledAt: string | null; lastSeenAt: string | null; createdAt: string;
  urlStatuses: UrlStatus[]; networkIncidents: NetworkIncident[];
};
type Enrollment = { enrollmentUrl: string; expiresAt: string; qrDataUrl: string };

function since(value: string | null) {
  if (!value) return "ยังไม่เคยเชื่อมต่อ";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds} วินาทีที่แล้ว`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`;
  return `${Math.floor(seconds / 3600)} ชั่วโมงที่แล้ว`;
}

export default function AgentsClient({ initial, canManage }: { initial: Agent[]; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("เครื่องตรวจ TRUE 1");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<{ agentName: string; enrollment: Enrollment } | null>(null);
  const [selectedId, setSelectedId] = useState(initial[0]?.id || "");
  const [renamingId, setRenamingId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const selected = useMemo(() => initial.find((item) => item.id === selectedId) || initial[0], [initial, selectedId]);

  async function createAgent() {
    if (!name.trim()) return alert("กรุณาระบุชื่อเครื่อง");
    setBusy(true);
    const response = await fetch("/api/mobile-agents", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, carrier: "TRUE" }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return alert(data.error || "สร้างเครื่องไม่สำเร็จ");
    setQr({ agentName: data.agent.name, enrollment: data.enrollment });
    router.refresh();
  }

  async function newQr(agent: Agent) {
    setBusy(true);
    const response = await fetch(`/api/mobile-agents/${agent.id}/enrollment`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return alert(data.error || "สร้าง QR ไม่สำเร็จ");
    setQr({ agentName: agent.name, enrollment: data.enrollment });
  }

  async function toggle(agent: Agent) {
    const action = agent.isActive ? "ปิดเครื่องและยกเลิกสิทธิ์ของโทรศัพท์เครื่องเดิม" : "เปิดเครื่องตรวจนี้";
    if (!confirm(`ยืนยัน${action}?`)) return;
    setBusy(true);
    const response = await fetch(`/api/mobile-agents/${agent.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !agent.isActive }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setBusy(false);
      return alert(data.error || "เปลี่ยนสถานะไม่สำเร็จ");
    }
    if (!agent.isActive) {
      const enrollmentResponse = await fetch(`/api/mobile-agents/${agent.id}/enrollment`, { method: "POST" });
      const enrollmentData = await enrollmentResponse.json().catch(() => ({}));
      setBusy(false);
      if (!enrollmentResponse.ok) return alert(enrollmentData.error || "สร้าง QR ผูกเครื่องใหม่ไม่สำเร็จ");
      setQr({ agentName: agent.name, enrollment: enrollmentData.enrollment });
    } else {
      setBusy(false);
    }
    router.refresh();
  }

  async function clearOldProblems() {
    if (!confirm("ยืนยันล้างปัญหาจากซิมเดิมทั้งหมด?\n\nระบบจะลบเคสเครือข่ายเดิมและเริ่มนับผลใหม่จากรอบถัดไป โดยจะไม่ส่ง Telegram")) return;
    setBusy(true);
    const response = await fetch("/api/mobile-agents/cleanup", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return alert(data.error || "ล้างปัญหาเดิมไม่สำเร็จ");
    alert(`ล้างเรียบร้อย ${data.removedIncidents || 0} เคส ระบบจะเริ่มอ่านผลใหม่ในรอบถัดไป`);
    router.refresh();
  }

  async function deleteAgent(agent: Agent) {
    if (!confirm(`ลบเครื่อง “${agent.name}” ออกจากระบบถาวร?\n\nข้อมูลผลตรวจและประวัติจากเครื่องนี้จะถูกลบทั้งหมด โทรศัพท์เดิมจะเชื่อมต่อไม่ได้`)) return;
    setBusy(true);
    const response = await fetch(`/api/mobile-agents/${agent.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return alert(data.error || "ลบเครื่องไม่สำเร็จ");
    setSelectedId(initial.find((item) => item.id !== agent.id)?.id || "");
    router.refresh();
  }

  function beginRename(agent: Agent) {
    setRenamingId(agent.id);
    setRenameValue(agent.name);
  }

  async function saveRename(agent: Agent) {
    const nextName = renameValue.trim();
    if (!nextName) return alert("กรุณาระบุชื่อเครื่อง");
    setBusy(true);
    const response = await fetch(`/api/mobile-agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return alert(data.error || "เปลี่ยนชื่อเครื่องไม่สำเร็จ");
    setRenamingId("");
    router.refresh();
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="เครื่องตรวจเครือข่ายมือถือ"
        subtitle={canManage
          ? "ตรวจลิงก์จากซิมจริง แยกจากตัวตรวจบน Vercel — แจ้งเตือนเมื่อยืนยันผิดปกติ 2 รอบ"
          : "ดูสถานะเครื่องตรวจและดาวน์โหลดแอปสำหรับติดตั้ง — บัญชีนี้เป็นแบบอ่านอย่างเดียว"}
        action={canManage && initial.some((agent) => agent.networkIncidents.length > 0 || agent.urlStatuses.some((row) => row.status === "DOWN")) ? (
          <button className="btn-danger" disabled={busy} onClick={clearOldProblems}>ล้างปัญหาจากซิมเดิมทั้งหมด</button>
        ) : undefined}
      />

      <div className="card mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-brand-100 bg-brand-50/40">
        <div><div className="font-semibold text-slate-700">1) ติดตั้งแอปบนโทรศัพท์ก่อน</div><div className="mt-1 text-xs text-slate-500">รองรับ Android 8 ขึ้นไป · รุ่น 1.0.3 · แจ้งชัดเมื่อสิทธิ์หมดและต้องผูก QR ใหม่</div></div>
        <a className="btn-primary whitespace-nowrap" href="/downloads/DomainWatch-Agent-v1.0.3.apk" download>⬇️ ดาวน์โหลด APK</a>
      </div>

      {canManage && <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="card p-5 lg:col-span-2">
          <div className="text-sm font-semibold text-slate-700">เพิ่มเครื่องตรวจ TRUE</div>
          <p className="mt-1 text-xs text-slate-400">สร้าง QR ใช้ครั้งเดียว อายุ 15 นาที แล้วสแกนด้วยกล้องโทรศัพท์</p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="เช่น เครื่องตรวจ TRUE ห้อง IT" />
            <button className="btn-primary whitespace-nowrap" disabled={busy} onClick={createAgent}>{busy ? "กำลังสร้าง..." : "+ สร้างเครื่องและ QR"}</button>
          </div>
        </div>
        <div className="card p-5 bg-brand-800 text-white">
          <div className="text-xs text-brand-200">หลักการแจ้งเตือน</div>
          <div className="mt-2 text-lg font-semibold">ล้ม 2 รอบ → แจ้ง</div>
          <div className="text-lg font-semibold">กลับมา 2 รอบ → ปิดเคส</div>
          <p className="mt-2 text-xs text-brand-200">เว็บช้าจะแสดงสีเหลืองและไม่ถูกนับเป็นเว็บล่ม</p>
        </div>
      </div>}

      {initial.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          {canManage ? "ยังไม่มีเครื่องตรวจ กรอกชื่อด้านบนแล้วสร้าง QR แรกได้เลย" : "ยังไม่มีเครื่องตรวจในระบบ กรุณาติดต่อแอดมิน"}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="space-y-3">
            {initial.map((agent) => {
              const online = Boolean(agent.isActive && agent.hasEnrollment && agent.lastSeenAt && Date.now() - new Date(agent.lastSeenAt).getTime() < 12 * 60_000);
              const open = agent.networkIncidents.filter((item) => item.status !== "CLOSED").length;
              return (
                <button key={agent.id} onClick={() => setSelectedId(agent.id)} className={`card w-full p-4 text-left transition ${selected?.id === agent.id ? "ring-2 ring-brand-500" : "hover:border-brand-200"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div><div className="font-semibold text-slate-800">📱 {agent.name}</div><div className="text-xs text-slate-400 mt-1">ซิม {agent.carrier} · {since(agent.lastSeenAt)}</div></div>
                    <span className={`badge ${online ? "bg-emerald-50 text-emerald-700" : agent.isActive ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-400"}`}>{online ? "ออนไลน์" : agent.isActive && !agent.hasEnrollment ? "รอผูก QR ใหม่" : agent.isActive ? "ขาดการเชื่อมต่อ" : "ปิดใช้งาน"}</span>
                  </div>
                  {open > 0 && <div className="mt-3 text-xs font-medium text-red-600">🔴 มีปัญหาเครือข่ายค้าง {open} รายการ</div>}
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="lg:col-span-2 space-y-5">
              <div className="card p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    {canManage && renamingId === selected.id ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          className="input min-w-[240px]"
                          maxLength={80}
                          autoFocus
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") saveRename(selected);
                            if (event.key === "Escape") setRenamingId("");
                          }}
                        />
                        <div className="flex gap-2">
                          <button className="btn-primary" disabled={busy} onClick={() => saveRename(selected)}>บันทึกชื่อ</button>
                          <button className="btn-ghost" disabled={busy} onClick={() => setRenamingId("")}>ยกเลิก</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-800">{selected.name}</h2>
                        {canManage && <button className="text-xs font-medium text-brand-600 hover:underline" onClick={() => beginRename(selected)}>✏️ เปลี่ยนชื่อ</button>}
                      </div>
                    )}
                    <p className="text-xs text-slate-400 mt-1">{selected.deviceLabel || "ยังไม่มีข้อมูลรุ่นเครื่อง"} · แอป {selected.appVersion || "-"}</p>
                    <p className="text-xs text-slate-400 mt-1">เครือข่ายที่รายงาน: {selected.reportedCarrier || selected.carrier} · {selected.networkType || "รอข้อมูล"}</p>
                    {selected.isActive && !selected.hasEnrollment && (
                      <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">สิทธิ์โทรศัพท์เดิมหมดแล้ว ต้องสร้าง QR และสแกนผูกเครื่องใหม่</div>
                    )}
                  </div>
                  {canManage && <div className="flex gap-2">
                    {selected.isActive && <button className="btn-ghost" disabled={busy} onClick={() => newQr(selected)}>{selected.hasEnrollment ? "สร้าง QR / ย้ายเครื่อง" : "สร้าง QR ผูกใหม่"}</button>}
                    <button disabled={busy} className={selected.isActive ? "btn-danger" : "btn-primary"} onClick={() => toggle(selected)}>{selected.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน + QR ใหม่"}</button>
                    <button className="btn-ghost text-red-600" disabled={busy} onClick={() => deleteAgent(selected)}>🗑️ ลบเครื่อง</button>
                  </div>}
                </div>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-400">ตรวจล่าสุด</div><div className="font-medium text-slate-700 mt-1">{since(selected.lastSeenAt)}</div></div>
                  <div className="rounded-xl bg-emerald-50 p-3"><div className="text-xs text-emerald-600">ใช้งานได้</div><div className="font-semibold text-emerald-700 mt-1">{selected.urlStatuses.filter((x) => x.status === "UP").length}</div></div>
                  <div className="rounded-xl bg-amber-50 p-3"><div className="text-xs text-amber-600">โหลดช้า</div><div className="font-semibold text-amber-700 mt-1">{selected.urlStatuses.filter((x) => x.status === "SLOW").length}</div></div>
                  <div className="rounded-xl bg-red-50 p-3"><div className="text-xs text-red-600">ใช้ไม่ได้</div><div className="font-semibold text-red-700 mt-1">{selected.urlStatuses.filter((x) => x.status === "DOWN").length}</div></div>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="p-4 border-b border-slate-100 font-semibold text-slate-700">ผลตรวจล่าสุด (ตัวอย่าง 8 URL)</div>
                {selected.urlStatuses.length === 0 ? <div className="p-6 text-sm text-slate-400">รอแอปส่งผลตรวจรอบแรก</div> : selected.urlStatuses.map((row) => (
                  <div key={row.id} className="p-4 border-b border-slate-50 last:border-0 flex gap-3">
                    <span>{row.status === "UP" ? "🟢" : row.status === "SLOW" ? "🟡" : row.status === "DOWN" ? "🔴" : "⚪"}</span>
                    <div className="min-w-0 flex-1"><div className="truncate text-sm text-slate-700">{row.url}</div><div className="mt-1 text-xs text-slate-400">HTTP {row.httpCode ?? "-"} · {row.responseMs ?? "-"} ms · {since(row.checkedAt)}{row.failureStreak > 0 ? ` · รอยืนยัน ${row.failureStreak}/2` : ""}</div></div>
                  </div>
                ))}
              </div>

              <div className="card overflow-hidden">
                <div className="p-4 border-b border-slate-100 font-semibold text-slate-700">ประวัติเหตุการณ์จากซิม</div>
                {selected.networkIncidents.length === 0 ? <div className="p-6 text-sm text-slate-400">ยังไม่มีเหตุการณ์จากเครือข่ายนี้</div> : selected.networkIncidents.map((incident) => (
                  <div key={incident.id} className="p-4 border-b border-slate-50 last:border-0">
                    <div className="flex items-center justify-between gap-3"><div className="font-medium text-slate-700">{incident.link.name} · {incident.link.company.name}</div><span className={`badge ${incident.status === "CLOSED" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{incident.status === "CLOSED" ? "กลับมาปกติ" : "ยังมีปัญหา"}</span></div>
                    <div className="mt-1 text-xs text-slate-400">{incident.link.lineGroup?.name || "ไม่ระบุห้อง"} · #{incident.id.slice(-8).toUpperCase()} · เริ่ม {new Date(incident.detectedAt).toLocaleString("th-TH")}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {qr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setQr(null)}>
          <div className="card w-full max-w-md p-6 text-center" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-xl font-semibold text-slate-800">QR ผูกเครื่อง — {qr.agentName}</h3>
            <p className="mt-1 text-xs text-amber-600">ใช้ได้ครั้งเดียว ภายใน 15 นาที ห้ามส่งเข้ากลุ่มสาธารณะ</p>
            <Image unoptimized width={256} height={256} src={qr.enrollment.qrDataUrl} alt="QR ผูกเครื่อง DomainWatch Agent" className="mx-auto my-4 w-64 h-64 rounded-xl border border-slate-100" />
            <div className="rounded-lg bg-slate-50 p-3 text-left text-xs text-slate-500 break-all">{qr.enrollment.enrollmentUrl}</div>
            <div className="mt-4 flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => navigator.clipboard.writeText(qr.enrollment.enrollmentUrl)}>คัดลอกลิงก์</button>
              <button className="btn-primary flex-1" onClick={() => setQr(null)}>เสร็จแล้ว</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
