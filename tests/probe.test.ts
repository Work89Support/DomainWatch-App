import test from "node:test";
import assert from "node:assert/strict";
import { isConfiguredDegradedStatus, isDegradedAvailability } from "../src/lib/checker";

test("treats GET 503 plus successful HEAD as degraded, not down", () => {
  assert.equal(isDegradedAvailability(503, 200), true);
  assert.equal(isDegradedAvailability(503, 403), true);
  assert.equal(isDegradedAvailability(503, 503), false);
  assert.equal(isDegradedAvailability(404, 200), false);
});

test("treats configured WAF-style HTTP 503 as degraded", () => {
  assert.equal(isConfiguredDegradedStatus(503), true);
  assert.equal(isConfiguredDegradedStatus(500), false);
  assert.equal(isConfiguredDegradedStatus(502), false);
  assert.equal(isConfiguredDegradedStatus(504), false);
});
