import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCrmUrl } from "../src/lib/crmLink";

test("CRM SMS links default to HTTPS and preserve the campaign path", () => {
  assert.equal(normalizeCrmUrl("urlio.co/3XBET"), "https://urlio.co/3XBET");
  assert.equal(normalizeCrmUrl(" https://urlio.co/ferrari8#campaign "), "https://urlio.co/ferrari8");
});

test("CRM links reject empty and unsupported URLs", () => {
  assert.equal(normalizeCrmUrl(""), null);
  assert.equal(normalizeCrmUrl("javascript:alert(1)"), null);
});
