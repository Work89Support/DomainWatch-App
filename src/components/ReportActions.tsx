"use client";

import { useState } from "react";

export default function ReportActions({ date }: { date: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sendTg() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/report/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? `ส่งเข้า Telegram แล้ว (${data.sent} กลุ่ม)` : data.error || "ส่งไม่สำเร็จ");
  }

  return (
    <div className="flex items-center gap-2 print:hidden">
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
      <button className="btn-ghost text-sm" onClick={() => window.print()}>🖨️ ปริ้น / บันทึก PDF</button>
      <button className="btn-primary text-sm disabled:opacity-60" disabled={busy} onClick={sendTg}>
        {busy ? "กำลังส่ง..." : "📢 ส่งเข้า Telegram"}
      </button>
    </div>
  );
}
