"use client";

import { useState } from "react";

declare global {
  interface Window {
    html2canvas?: (node: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
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
      // โหลด html2canvas จาก CDN ครั้งแรก
      if (!window.html2canvas) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("load_failed"));
          document.head.appendChild(s);
        });
      }
      if (!window.html2canvas) throw new Error("no_lib");
      // รอฟอนต์โหลดให้ครบก่อน กันข้อความเบี้ยว
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      const canvas = await window.html2canvas(node, {
        scale: 2,
        backgroundColor: "#f1f5f9",
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: node.scrollWidth,
        windowHeight: node.scrollHeight,
        ignoreElements: (el: HTMLElement) => !!(el.classList && el.classList.contains("no-capture")),
      });
      const dataUrl = canvas.toDataURL("image/png");
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
