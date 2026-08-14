import test from "node:test";
import assert from "node:assert/strict";
import { confirmCheckState } from "../src/lib/checkState";

const base = {
  currentStatus: "UP" as const,
  hasOpenIncident: false,
  failureStreak: 0,
  recoveryStreak: 0,
  downConfirmations: 2,
  recoveryConfirmations: 2,
};

test("keeps the confirmed status after the first failed probe", () => {
  const result = confirmCheckState({ ...base, probeStatus: "DOWN" });
  assert.equal(result.status, "UP");
  assert.equal(result.failureStreak, 1);
  assert.equal(result.pendingVerification, true);
  assert.equal(result.shouldOpenIncident, false);
});

test("opens an incident after the configured consecutive failures", () => {
  const result = confirmCheckState({ ...base, probeStatus: "DOWN", failureStreak: 1 });
  assert.equal(result.status, "DOWN");
  assert.equal(result.pendingVerification, false);
  assert.equal(result.shouldOpenIncident, true);
});

test("does not confuse an unconfirmed failure with a genuinely slow response", () => {
  const failed = confirmCheckState({ ...base, probeStatus: "DOWN", currentStatus: "UNKNOWN" });
  const slow = confirmCheckState({ ...base, probeStatus: "SLOW" });
  assert.equal(failed.status, "UNKNOWN");
  assert.equal(slow.status, "SLOW");
});

test("keeps DOWN until recovery is confirmed", () => {
  const result = confirmCheckState({
    ...base,
    probeStatus: "UP",
    currentStatus: "DOWN",
    hasOpenIncident: true,
  });
  assert.equal(result.status, "DOWN");
  assert.equal(result.recoveryStreak, 1);
  assert.equal(result.pendingVerification, true);
  assert.equal(result.shouldCloseIncident, false);
});

test("a slow but successful response can confirm recovery", () => {
  const result = confirmCheckState({
    ...base,
    probeStatus: "SLOW",
    currentStatus: "DOWN",
    hasOpenIncident: true,
    recoveryStreak: 1,
  });
  assert.equal(result.status, "SLOW");
  assert.equal(result.pendingVerification, false);
  assert.equal(result.shouldCloseIncident, true);
});
