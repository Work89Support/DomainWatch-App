import test from "node:test";
import assert from "node:assert/strict";
import { shouldRecordCheckLog } from "../src/lib/checker";

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
