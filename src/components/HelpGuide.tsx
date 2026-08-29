"use client";

import { useEffect, useRef, useState } from "react";
import { MANUAL_HTML } from "@/lib/manualHtml";

export default function HelpGuide() {
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [anotherDialogOpen, setAnotherDialogOpen] = useState(false);
  const winRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ on: false, ox: 0, oy: 0 });

  function onDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button, a")) return;
    const el = winRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    drag.current = { on: true, ox: e.clientX - r.left, oy: e.clientY - r.top };
    setPos({ x: r.left, y: r.top });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current.on) return;
    const el = winRef.current;
    if (!el) return;
    let x = e.clientX - drag.current.ox;
    let y = e.clientY - drag.current.oy;
    x = Math.max(6, Math.min(x, window.innerWidth - el.offsetWidth - 6));
    // หนีบแนวตั้งด้วยความสูงจริงของหน้าต่าง กันตัวหน้าต่างหลุดพ้นขอบล่างจอ
    y = Math.max(6, Math.min(y, window.innerHeight - el.offsetHeight - 6));
    setPos({ x, y });
  }
  function onUp() {
    drag.current.on = false;
  }

  const winStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y }
    : { left: "50%", top: "54%", transform: "translate(-50%,-50%)" };

  useEffect(() => {
    const update = () => setAnotherDialogOpen(Boolean(document.querySelector('[role="dialog"][aria-modal="true"]:not([data-help-guide])')));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {!open && !anotherDialogOpen && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-5 bottom-5 z-[60] flex items-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-brand-700 print:hidden"
        >
          📘 คู่มือ
        </button>
      )}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="คู่มือการใช้งาน DomainWatch"
          data-help-guide
          ref={winRef}
          style={{ position: "fixed", zIndex: 70, width: 860, maxWidth: "96vw", height: min ? "auto" : 620, maxHeight: "92vh", ...winStyle }}
          className="flex flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl print:hidden"
        >
          <div
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            className="flex select-none items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-3 text-white cursor-grab active:cursor-grabbing"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ff5f57" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#febc2e" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#28c840" }} />
            <span className="ml-1 text-sm font-semibold">📘 คู่มือการใช้งาน DomainWatch</span>
            <span className="hidden text-[11px] font-light opacity-80 sm:inline">— ลากแถบนี้เพื่อย้าย</span>
            <span className="flex-1" />
            <a
              href="/downloads/DomainWatch-User-Manual-v2.1.pdf"
              target="_blank"
              rel="noreferrer"
              onPointerDown={(event) => event.stopPropagation()}
              className="hidden rounded-md bg-white/20 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/30 sm:inline-flex"
              title="เปิดคู่มือฉบับ PDF"
            >
              PDF
            </a>
            <a
              href="/downloads/DomainWatch-User-Manual-v2.1.docx"
              download
              onPointerDown={(event) => event.stopPropagation()}
              className="hidden rounded-md bg-white/20 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/30 md:inline-flex"
              title="ดาวน์โหลดคู่มือฉบับ Word"
            >
              Word
            </a>
            <button onClick={() => setMin((m) => !m)} className="h-6 w-6 rounded-md bg-white/20 text-white" title="ย่อ/ขยาย">–</button>
            <button onClick={() => { setOpen(false); setMin(false); }} className="h-6 w-6 rounded-md bg-white/20 text-white" title="ปิด">×</button>
          </div>
          {!min && <iframe title="คู่มือการใช้งาน DomainWatch" srcDoc={MANUAL_HTML} className="w-full flex-1 border-0" />}
        </div>
      )}
    </>
  );
}
