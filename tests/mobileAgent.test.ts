import assert from "node:assert/strict";
import test from "node:test";
import { mobileUrlHash, nextMobileState, normalizeUrl } from "../src/lib/mobileAgent";

test("mobile URL hash ignores fragments but keeps a stable normalized URL", () => {
  assert.equal(normalizeUrl("https://example.com/path#section"), "https://example.com/path");
  assert.equal(
    mobileUrlHash("https://example.com/path#one"),
    mobileUrlHash("https://example.com/path#two")
  );
});

test("mobile outage requires two consecutive failures", () => {
  const first = nextMobileState(null, "DOWN");
  assert.equal(first.status, "UNKNOWN");
  assert.equal(first.opened, false);
  const second = nextMobileState({
    status: first.status,
    failureStreak: first.failureStreak,
    recoveryStreak: first.recoveryStreak,
  }, "DOWN");
  assert.equal(second.status, "DOWN");
  assert.equal(second.opened, true);
});

test("mobile recovery requires two successful rounds and preserves slow recovery", () => {
  const first = nextMobileState({ status: "DOWN", failureStreak: 2, recoveryStreak: 0 }, "SLOW");
  assert.equal(first.status, "DOWN");
  assert.equal(first.recovered, false);
  const second = nextMobileState({ status: first.status, failureStreak: 0, recoveryStreak: 1 }, "SLOW");
  assert.equal(second.status, "SLOW");
  assert.equal(second.recovered, true);
});
