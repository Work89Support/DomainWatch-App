import { explainProblem } from "@/lib/problemExplanation";

export default function ProblemExplanation({ error, httpCode, backupUsed = false }: { error?: string | null; httpCode?: number | null; backupUsed?: boolean }) {
  const message = explainProblem(error, httpCode);
  return <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
    {backupUsed && <p className="mb-2 font-semibold text-emerald-700">ใช้งานผ่านลิงก์สำรองได้แล้ว — ปัญหาด้านล่างเป็นผลตรวจของลิงก์หลัก ไม่ได้หมายความว่าลูกค้าเข้าใช้งานไม่ได้ทั้งหมด</p>}
    <p><b>{backupUsed ? "ปัญหาที่พบกับลิงก์หลัก" : "เกิดอะไรขึ้น"}:</b> {message.reason}</p>
    <p className="mt-2"><b>ควรทำอะไรต่อ:</b> {backupUsed ? "ใช้ลิงก์สำรองที่ตรวจผ่านต่อได้ และให้ผู้รับผิดชอบตรวจแก้ลิงก์หลัก ไม่จำเป็นต้องเปลี่ยนลิงก์สำรองเพียงเพราะข้อความปัญหาของลิงก์หลักยังอยู่" : message.next}</p>
    {(error || httpCode) && <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">รายละเอียดทางเทคนิคสำหรับไอที</summary><p className="mt-1 break-words">{httpCode ? `HTTP ${httpCode} · ` : ""}{error || "ไม่มีข้อความเพิ่มเติม"}</p></details>}
  </div>;
}
