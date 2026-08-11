"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDateTime } from "@/lib/format";

type Q = {
  incidentId: string;
  linkName: string;
  company: string;
  url: string;
  hasBackup: boolean;
  detectedAt: string;
};

export default function AdminQueueCard({ queue }: { queue: Q[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(id);
    const res = await fetch(`/api/incidents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setBusy(null);
    if (res.ok) router.refresh();
    else {
      const e = await res.json().catch(() => ({}));
      alert(e.error || "ทำรายการไม่สำเร็จ");
    }
  }

  function promptNewUrl(id: string) {
    const url = prompt("ใส่ลิงก์ใหม่ (บอทจะอ่านลิงก์นี้แทน)");
    if (!url) return;
    act(id, "admin_update", { newUrl: url.trim() });
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 text-lg">👤</div>
        <div>
          <h2 className="text-base font-semibold text-slate-800">มุมมองแอดมิน — อัพเดตลิงก์ผ่านระบบ</h2>
          <div className="text-xs text-slate-400">ลิงก์ไหนล่ม กดสลับลิงก์สำรอง/ใส่ลิงก์ใหม่ บอทจะอ่านใหม่ทันที</div>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-slate-700 text-sm">ไม่มีลิงก์ที่ต้องอัพเดต 🎉</div>
          <div className="text-xs text-slate-400 mt-1">ทุกลิงก์ปกติ</div>
        </div>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {queue.map((q) => (
            <div key={q.incidentId} className="rounded-xl border border-red-100 bg-red-50/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">{q.linkName} <span className="text-xs text-slate-400">· {q.company}</span></div>
                  <div className="text-xs text-red-600">🔴 ใช้ไม่ได้ · ตรวจพบ {fmtDateTime(q.detectedAt)}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2.5">
                <button
                  className="btn-primary text-xs py-1.5 disabled:opacity-40"
                  disabled={!q.hasBackup || busy === q.incidentId}
                  title={q.hasBackup ? "" : "ยังไม่มีลิงก์สำรอง (ให้ไอทีเพิ่มก่อน)"}
                  onClick={() => act(q.incidentId, "admin_use_backup")}
                >
                  ↔ สลับเป็นลิงก์สำรอง
                </button>
                <button className="btn-ghost text-xs py-1.5" disabled={busy === q.incidentId} onClick={() => promptNewUrl(q.incidentId)}>
                  ✎ ใส่ลิงก์ใหม่
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
