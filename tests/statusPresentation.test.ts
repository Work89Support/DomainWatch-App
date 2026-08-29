import assert from "node:assert/strict";
import test from "node:test";
import { failureConfirmationText, mobileIncidentStatusText } from "../src/lib/statusPresentation";

test("confirmed mobile failure is not rendered as an impossible x/2 counter", () => {
  assert.equal(failureConfirmationText("DOWN", 105), "ยืนยันแล้ว · เสียต่อเนื่อง 105 รอบ");
  assert.equal(failureConfirmationText("SLOW", 7), "รอยืนยัน 1/2");
  assert.equal(failureConfirmationText("UP", 0), "ปกติ");
});

test("backup recovery explains that the primary URL is still unhealthy", () => {
  assert.equal(
    mobileIncidentStatusText({ status: "CLOSED", redirectType: "BACKUP_USED", finalUrl: "https://backup.example" }),
    "ลิงก์หลักมีปัญหา · ใช้สำรองได้"
  );
  assert.equal(mobileIncidentStatusText({ status: "CLOSED" }), "จัดการเรียบร้อย");
});
