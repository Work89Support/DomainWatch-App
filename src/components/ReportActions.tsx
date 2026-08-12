"use client";

import { useState } from "react";

declare global {
  interface Window {
    htmlToImage?: {
      toPng: (node: HTMLElement, opts?: Record<string, unknown>) => Promise<string>;
    };
  }
}

export default function ReportActions({ date }: { date: string }) {
  const [busy, setBusy] = useState(false);
  const [pngBusy, setPngBusy] = useState(false);
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

  async function savePng() {
    setPngBusy(true);
    setMsg(null);
    try {
      const node = document.getElementById("report-capture");
      if (!node) return;
      if (!window.htmlToImage) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("load_failed"));
          document.head.appendChild(s);
        });
      }
      if (!window.htmlToImage) throw new Error("no_lib");
      const dataUrl = await window.htmlToImage.toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#f1f5f9",
        filter: (n: HTMLElement) => !(n.classList && n.classList.contains("no-capture")),
      });
      const a = document.createElement("a");
      a.download = `รายงานรอบวัน-${date}.png`;
      a.href = dataUrl;
      a.click();
    } catch {
      setMsg("บันทึกรูปไม่สำเร็จ — ลองใหม่อีกครั้ง");
    } finally {
      setPngBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 no-capture print:hidden">
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
      <button className="btn-ghost text-sm disabled:opacity-60" disabled={pngBusy} onClick={savePng}>
        {pngBusy ? "กำลังบันทึก..." : "🖼️ บันทึก PNG"}
      </button>
      <button className="btn-ghost text-sm" onClick={() => window.print()}>🖨️ ปริ้น / PDF</button>
      <button className="btn-primary text-sm disabled:opacity-60" disabled={busy} onClick={sendTg}>
        {busy ? "กำลังส่ง..." : "📢 ส่งเข้า Telegram"}
      </button>
    </div>
  );
}
