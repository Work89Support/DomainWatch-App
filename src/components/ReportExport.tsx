"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Only this section is exported: never the surrounding navigation or case log. */
export default function ReportExport({ title, context, summary, children }: {
  title: string; context: string; summary: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(summary);
  useEffect(() => setText(summary), [summary]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function download() {
    if (!ref.current || busy) return;
    setBusy(true); setMessage("");
    try {
      await document.fonts.ready;
      const { toBlob } = await import("html-to-image");
      // Render a separate desktop-sized copy so Recharts recalculates its geometry,
      // rather than stretching a small mobile SVG or modifying the visible page.
      for (let frame = 0; frame < 60; frame++) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const node = captureRef.current;
        if (frame >= 3 && node && node.querySelectorAll(".recharts-responsive-container").length === node.querySelectorAll("svg.recharts-surface").length) break;
      }
      const node = captureRef.current;
      if (!node || node.scrollHeight > 14000) throw new Error("report too tall");
      const blob = await toBlob(node, { pixelRatio: 1.5, backgroundColor: "#f5f7ff", style: { position: "static", left: "0", top: "0" } });
      if (!blob) throw new Error("empty image");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `DomainWatch-${title}-${new Date().toISOString().slice(0,10)}.png`;
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage("สร้างภาพเรียบร้อยแล้ว");
    } catch { setMessage("สร้างภาพไม่สำเร็จ กรุณาลองใหม่ หรือใช้พิมพ์ / PDF"); }
    finally { setBusy(false); }
  }
  const content = <>
    <header><h2 className="text-2xl font-bold">DomainWatch · {title}</h2><p className="text-sm text-slate-500 mt-2">{context}</p></header>
    {text && <p className="card p-4 whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</p>}
    {children}
  </>;
  return <section className="mb-6">
    <div className="card p-4 mb-4 print:hidden">
      <div className="flex flex-wrap gap-3 items-center mb-3">
        <button className="btn-primary" type="button" disabled={busy} onClick={download}>{busy ? "กำลังสร้างภาพ…" : "ดาวน์โหลดภาพ PNG"}</button>
        <button className="btn-ghost" type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(`${title}\n${context}\n${text}`); setMessage("คัดลอกข้อความแล้ว"); }
          catch { setMessage("คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกข้อความในช่องแล้วคัดลอก"); }
        }}>คัดลอกข้อความสรุป</button>
        <span role="status" className="text-sm text-slate-600">{message}</span>
      </div>
      <label className="text-sm font-medium">คำบรรยายรายงาน (แก้ไขได้ และรวมในภาพ)
        <textarea className="input w-full mt-2" rows={4} maxLength={3000} value={text} onChange={e => setText(e.target.value)} />
      </label>
    </div>
    <div ref={ref} className="space-y-5 bg-[#f5f7ff] p-3 rounded-xl">
      {content}
    </div>
    {busy && createPortal(<div aria-hidden="true" ref={captureRef} className="report-capture space-y-5" style={{position:"absolute",left:-16000,top:0,width:1200,padding:32,background:"#f5f7ff",fontFamily:ref.current ? getComputedStyle(ref.current).fontFamily : undefined}}>{content}</div>, document.body)}
  </section>;
}
