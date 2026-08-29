export function failureConfirmationText(status: string, failureStreak: number): string {
  if (failureStreak <= 0) return "ปกติ";
  if (status === "DOWN") return `ยืนยันแล้ว · เสียต่อเนื่อง ${failureStreak} รอบ`;
  return `รอยืนยัน ${Math.min(failureStreak, 1)}/2`;
}

export function mobileIncidentStatusText(input: {
  status: string;
  redirectType?: string | null;
  finalUrl?: string | null;
}): string {
  if (input.status === "CLOSED" && input.redirectType === "BACKUP_USED" && input.finalUrl) {
    return "ลิงก์หลักมีปัญหา · ใช้สำรองได้";
  }
  const labels: Record<string, string> = {
    OPEN: "เปิด (รอจัดการ)",
    ADMIN_UPDATED: "ปรับแก้แล้ว · รอตรวจยืนยัน",
    IT_RESOLVED: "กำลังตรวจยืนยัน",
    PAUSED: "พักการเฝ้าดู",
    CLOSED: "จัดการเรียบร้อย",
  };
  return labels[input.status] || labels.OPEN;
}
