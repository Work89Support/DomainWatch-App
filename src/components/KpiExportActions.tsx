"use client";

type ExportRow = {
  id: string;
  source: string;
  agent: string;
  link: string;
  company: string;
  detectedAt: string;
  status: string;
  admin: string;
  adminMinutes: number | null;
  adminBasis: string;
  itBasis: string;
  it: string;
  itMinutes: number | null;
};

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export default function KpiExportActions({ rows, fileLabel }: { rows: ExportRow[]; fileLabel: string }) {
  function downloadCsv() {
    const headers = ["รหัสเคส", "แหล่งงาน", "เครื่องตรวจ", "ลิงก์", "บริษัท", "ตรวจพบ", "สถานะ", "แอดมินผู้รับหรือผู้แก้", "นาทีรับถึงแก้เสร็จ หรือพบถึงแก้เสร็จหากไม่รับ (ไม่รวมรีเช็ค)", "ไอทีผู้รับหรือผู้แก้", "นาทีรับถึงงานเสร็จ หรือพบถึงงานเสร็จหากไม่รับ"];
    const lines = [
      [...headers, "ฐานเวลาแอดมิน", "ฐานเวลาไอที"].map(csvCell).join(","),
      ...rows.map((row) => [row.id, row.source, row.agent, row.link, row.company, row.detectedAt, row.status, row.admin, row.adminMinutes, row.it, row.itMinutes, row.adminBasis, row.itBasis].map(csvCell).join(",")),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `DomainWatch-KPI-${fileLabel}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button type="button" className="btn-ghost text-sm" onClick={downloadCsv}>⬇ Export CSV</button>
      <button type="button" className="btn-primary text-sm" onClick={() => window.print()}>🖨️ พิมพ์ / PDF</button>
    </div>
  );
}
