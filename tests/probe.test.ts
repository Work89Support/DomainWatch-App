import test from "node:test";
import assert from "node:assert/strict";
import { isDegradedAvailability } from "../src/lib/checker";

test("treats GET 503 plus successful HEAD as degraded, not down", () => {
  assert.equal(isDegradedAvailability(503, 200), true);
  assert.equal(isDegradedAvailability(503, 403), true);
  assert.equal(isDegradedAvailability(503, 503), false);
  assert.equal(isDegradedAvailability(404, 200), false);
});
