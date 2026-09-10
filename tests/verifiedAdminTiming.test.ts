import test from "node:test";
import assert from "node:assert/strict";
import { verifiedAdminMinutes } from "../src/lib/verifiedAdminTiming";

const fixed = {
  status: "CLOSED",
  detectedAt: new Date("2026-09-10T07:00:00Z"),
  adminUpdatedAt: new Date("2026-09-10T07:05:00Z"),
  resolvedAt: new Date("2026-09-10T07:30:00Z"),
};
test("verified repair excludes the offline wait from admin KPI", () => {
  assert.equal(verifiedAdminMinutes(fixed), 5);
});
test("pending, failed, paused and automatic recovery do not certify admin work", () => {
  for (const status of ["OPEN", "ADMIN_UPDATED", "PAUSED"]) {
    assert.equal(verifiedAdminMinutes({ ...fixed, status }), null);
  }
  assert.equal(verifiedAdminMinutes({ ...fixed, adminUpdatedAt: null }), null);
  assert.equal(verifiedAdminMinutes({ ...fixed, resolvedAt: null }), null);
});
test("a stale check predating the edit cannot verify it", () => {
  assert.equal(verifiedAdminMinutes({ ...fixed, resolvedAt: fixed.detectedAt }), null);
});
