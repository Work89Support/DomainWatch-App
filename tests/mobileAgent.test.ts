import assert from "node:assert/strict";
import test from "node:test";
import { mobileUrlHash, nextMobileState, normalizeMobileProbeStatus, normalizeUrl, resolvePublicBaseUrl } from "../src/lib/mobileAgent";

test("mobile URL hash ignores fragments but keeps a stable normalized URL", () => {
  assert.equal(normalizeUrl("https://example.com/path#section"), "https://example.com/path");
  assert.equal(
    mobileUrlHash("https://example.com/path#one"),
    mobileUrlHash("https://example.com/path#two")
  );
});

test("production enrollment never prefers a configured localhost URL over the request origin", () => {
  const previous = process.env.APP_BASE_URL;
  process.env.APP_BASE_URL = "http://localhost:3000";
  try {
    assert.equal(
      resolvePublicBaseUrl("https://domain-watch-app-sandy.vercel.app"),
      "https://domain-watch-app-sandy.vercel.app"
    );
    assert.equal(resolvePublicBaseUrl("http://localhost:3000"), "http://localhost:3000");
  } finally {
    if (previous === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = previous;
  }
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

test("mobile timeout is inconclusive/slow and must not open a false outage", () => {
  assert.equal(normalizeMobileProbeStatus("DOWN", "SocketTimeoutException: Read timed out"), "SLOW");
  assert.equal(normalizeMobileProbeStatus("DOWN", "ConnectException: Connection refused"), "DOWN");
  const first = nextMobileState(null, normalizeMobileProbeStatus("DOWN", "Read timed out"));
  assert.equal(first.status, "SLOW");
  assert.equal(first.opened, false);
});
