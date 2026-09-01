"use client";

import { useEffect, useState } from "react";
import { MANUAL_HTML } from "@/lib/manualHtml";

export default function HelpGuide() {
  const [open, setOpen] = useState(false);
  const [anotherDialogOpen, setAnotherDialogOpen] = useState(false);

  useEffect(() => {
    const update = () => setAnotherDialogOpen(Boolean(document.querySelector('[role="dialog"][aria-modal="true"]:not([data-help-guide])')));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

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
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-0 backdrop-blur-sm sm:p-5 print:hidden"
          onMouseDown={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="คู่มือการใช้งาน DomainWatch"
            data-help-guide
            className="flex h-full w-full max-w-[1180px] flex-col overflow-hidden bg-white shadow-2xl sm:rounded-2xl sm:border sm:border-slate-300"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex min-h-14 shrink-0 items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-700 px-3 text-white sm:px-4">
              <span className="text-sm font-semibold sm:text-base">📘 คู่มือการใช้งาน DomainWatch</span>
              <span className="hidden text-xs font-light opacity-80 sm:inline">— โหมดอ่านเต็มจอ</span>
              <span className="flex-1" />
              <a href="/downloads/DomainWatch-User-Manual-v2.3.pdf" target="_blank" rel="noreferrer" className="rounded-lg bg-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/30">PDF</a>
              <a href="/downloads/DomainWatch-User-Manual-v2.3.docx" download className="hidden rounded-lg bg-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/30 sm:inline-flex">Word</a>
              <button onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-xl text-white hover:bg-white/30" title="ปิดคู่มือ" aria-label="ปิดคู่มือ">×</button>
            </div>
            <iframe title="คู่มือการใช้งาน DomainWatch" srcDoc={MANUAL_HTML} className="min-h-0 w-full flex-1 border-0 bg-white" />
          </div>
        </div>
      )}
    </>
  );
}
