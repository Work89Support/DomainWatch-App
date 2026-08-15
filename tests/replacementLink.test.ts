import test from "node:test";
import assert from "node:assert/strict";
import { normalizeReplacementUrl } from "../src/lib/replacementLink";

test("accepts only complete HTTP replacement URLs", () => {
  assert.equal(
    normalizeReplacementUrl(" https://example.com/path "),
    "https://example.com/path"
  );
  assert.equal(normalizeReplacementUrl("@328wllbe"), null);
  assert.equal(normalizeReplacementUrl("javascript:alert(1)"), null);
  assert.equal(normalizeReplacementUrl(""), null);
});
