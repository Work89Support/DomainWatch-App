import test from "node:test";
import assert from "node:assert/strict";
import { bangkokDay, reportPeriod } from "../src/lib/reportPeriod";

test("report period uses inclusive Thai dates", () => {
  const p = reportPeriod("2026-09-01", "2026-09-12");
  assert.equal(p.start.toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(p.end.toISOString(), "2026-09-12T16:59:59.999Z");
  assert.equal(bangkokDay(new Date("2026-09-11T18:00:00Z")), "2026-09-12");
});
test("default report contains 30 Thai calendar days", () => {
  const p = reportPeriod(undefined, undefined, new Date("2026-09-12T02:00:00Z"));
  assert.equal(p.from, "2026-08-14");
  assert.equal(p.to, "2026-09-12");
});
test("rejects invalid, reversed and excessive ranges", () => {
  for (const [a,b] of [["wrong", "2026-09-12"], ["2026-02-30", "2026-09-12"], ["2026-09-13", "2026-09-12"], ["2024-01-01", "2026-09-12"]]) {
    assert.throws(() => reportPeriod(a,b));
  }
});
