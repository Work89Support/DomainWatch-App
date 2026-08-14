import type { LinkStatus } from "@prisma/client";

export type CheckStateInput = {
  probeStatus: LinkStatus;
  currentStatus: LinkStatus;
  hasOpenIncident: boolean;
  failureStreak: number;
  recoveryStreak: number;
  downConfirmations: number;
  recoveryConfirmations: number;
};

export type CheckStateResult = {
  status: LinkStatus;
  failureStreak: number;
  recoveryStreak: number;
  pendingVerification: boolean;
  shouldOpenIncident: boolean;
  shouldCloseIncident: boolean;
};

// แยก "ผลดิบของรอบนี้" ออกจาก "สถานะยืนยัน" ที่ผู้ใช้เห็น
// จึงไม่เอาการรอยืนยันไปปนกับสถานะ SLOW ซึ่งหมายถึงเว็บตอบช้าจริงเท่านั้น
export function confirmCheckState(input: CheckStateInput): CheckStateResult {
  const downConfirmations = Math.max(1, input.downConfirmations);
  const recoveryConfirmations = Math.max(1, input.recoveryConfirmations);
  const failed = input.probeStatus === "DOWN";
  const failureStreak = failed ? input.failureStreak + 1 : 0;
  // ทั้ง UP และ SLOW แปลว่าเว็บตอบสำเร็จ จึงนับเป็นการฟื้นตัวได้
  const recoveryStreak = failed ? 0 : input.recoveryStreak + 1;

  if (failed) {
    const confirmedDown = failureStreak >= downConfirmations;
    return {
      status: confirmedDown ? "DOWN" : input.currentStatus,
      failureStreak,
      recoveryStreak,
      pendingVerification: !confirmedDown,
      shouldOpenIncident: confirmedDown && !input.hasOpenIncident,
      shouldCloseIncident: false,
    };
  }

  if (input.hasOpenIncident && recoveryStreak < recoveryConfirmations) {
    return {
      status: input.currentStatus,
      failureStreak,
      recoveryStreak,
      pendingVerification: true,
      shouldOpenIncident: false,
      shouldCloseIncident: false,
    };
  }

  return {
    status: input.probeStatus,
    failureStreak,
    recoveryStreak,
    pendingVerification: false,
    shouldOpenIncident: false,
    shouldCloseIncident: input.hasOpenIncident,
  };
}
