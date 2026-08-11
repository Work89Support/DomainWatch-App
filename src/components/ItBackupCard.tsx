"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id: string; name: string; company: string };

export default function ItBackupCard({
  items,
  withBackup,
  total,
}: {
  items: Item[];
  withBackup: number;
  total: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const pct = total > 0 ? Math.round((withBackup / total) * 100) : 0;

  async function addBackup(l: Item) {
    const url = prompt(`ใส่ลิงก์สำรองสำหรับ "${l.name}" (${l.company})`);
    if (!url) return;
    setBusy(l.id);
    await fetch(`/api/links/${l.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backupUrl: url.trim() }),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 text-lg">🛠️</div>
        <div>
          <h2 className="text-base font-semibold text-slate-800">มุมมองไอที — เตรียมลิงก์สำรอง</h2>
          <div className="text-xs text-slate-400">ทุกลิงก์ควรมีสำรองไว้ล่วงหน้า ก่อนของจริงล่ม</div>
        </div>
      </div>
      <div className="h-3 bg-slate-100 rounded-lg overflow-hidden mt-3">
        <div className="h-full bg-brand-600 rounded-lg" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-slate-500 mt-1.5">
        <span>ความครอบคลุมลิงก์สำรอง</span>
        <span><b>{withBackup} / {total}</b> ({pct}%)</span>
      </div>

      <div className="mt-3 max-h-64 overflow-y-auto">
        {items.length === 0 ? (
          <div className="text-center text-emerald-600 text-sm py-6">ทุกลิงก์มีสำรองแล้ว 🎉</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {items.map((l) => (
                <tr key={l.id} className="border-t border-slate-50">
                  <td className="py-2">
                    <div className="text-slate-700">{l.name}</div>
                    <div className="text-xs text-slate-400">{l.company}</div>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      className="btn-primary text-xs py-1.5 disabled:opacity-60"
                      disabled={busy === l.id}
                      onClick={() => addBackup(l)}
                    >
                      {busy === l.id ? "..." : "+ เพิ่มสำรอง"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
