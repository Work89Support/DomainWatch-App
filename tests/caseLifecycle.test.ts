import test from "node:test";
import assert from "node:assert/strict";
import { elapsedMinutes, isCaseClosed } from "../src/lib/caseActivity";

test("missing or invalid close times never produce a fabricated KPI", () => {
  const start = new Date("2026-09-05T00:00:00Z");
  assert.equal(elapsedMinutes(start, null), null);
  assert.equal(elapsedMinutes(start, new Date("2026-09-04T23:59:00Z")), null);
  assert.equal(elapsedMinutes(start, new Date("2026-09-05T00:05:01Z")), 301 / 60);
});
test("paused and closed cases cannot be claimed again, awaiting verification remains open", () => {
  assert.equal(isCaseClosed("CLOSED"), true);
  assert.equal(isCaseClosed("PAUSED"), true);
  assert.equal(isCaseClosed("ADMIN_UPDATED"), false);
  assert.equal(isCaseClosed("IT_RESOLVED"), false);
});
