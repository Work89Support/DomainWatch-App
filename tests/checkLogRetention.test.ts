import test from "node:test";
import assert from "node:assert/strict";
import { forEachConcurrent, shouldRecordCheckLog } from "../src/lib/checker";

test("records the first check", () => {
  assert.equal(shouldRecordCheckLog("UNKNOWN", "UP", null), true);
});

test("does not write another log when the probe status is unchanged", () => {
  assert.equal(shouldRecordCheckLog("UP", "UP", new Date()), false);
  assert.equal(shouldRecordCheckLog("SLOW", "SLOW", new Date()), false);
  assert.equal(shouldRecordCheckLog("DOWN", "DOWN", new Date()), false);
});

test("records a status transition", () => {
  assert.equal(shouldRecordCheckLog("UP", "SLOW", new Date()), true);
  assert.equal(shouldRecordCheckLog("SLOW", "DOWN", new Date()), true);
  assert.equal(shouldRecordCheckLog("DOWN", "UP", new Date()), true);
});

test("runs every item while respecting the concurrency limit", async () => {
  const items = Array.from({ length: 40 }, (_, index) => index);
  const seen: number[] = [];
  let active = 0;
  let peak = 0;
  await forEachConcurrent(items, 7, async (item) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    seen.push(item);
    active--;
  });
  assert.equal(peak <= 7, true);
  assert.deepEqual(seen.sort((a, b) => a - b), items);
});
