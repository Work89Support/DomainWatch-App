import assert from "node:assert/strict";
import test from "node:test";
import {
  isIpAllowed,
  isValidIpRule,
  normalizeAllowedIpRanges,
  normalizeClientIp,
} from "../src/lib/ipAccess";

test("normalizes Vercel forwarded IPv4 values", () => {
  assert.equal(normalizeClientIp("203.0.113.8, 10.0.0.1"), "203.0.113.8");
  assert.equal(normalizeClientIp("::ffff:203.0.113.8"), "203.0.113.8");
});

test("allows unrestricted users and exact IP rules", () => {
  assert.equal(isIpAllowed("203.0.113.8", null), true);
  assert.equal(isIpAllowed("203.0.113.8", "203.0.113.8"), true);
  assert.equal(isIpAllowed("203.0.113.9", "203.0.113.8"), false);
});

test("supports IPv4 and IPv6 CIDR ranges", () => {
  assert.equal(isIpAllowed("203.0.113.99", "203.0.113.0/24"), true);
  assert.equal(isIpAllowed("203.0.114.1", "203.0.113.0/24"), false);
  assert.equal(isIpAllowed("2001:db8::1234", "2001:db8::/32"), true);
  assert.equal(isIpAllowed("2001:db9::1", "2001:db8::/32"), false);
});

test("validates and normalizes multiple rules", () => {
  assert.equal(isValidIpRule("203.0.113.0/24"), true);
  assert.equal(isValidIpRule("203.0.113.0/99"), false);
  assert.equal(normalizeAllowedIpRanges("203.0.113.8, 203.0.113.0/24"), "203.0.113.8\n203.0.113.0/24");
  assert.throws(() => normalizeAllowedIpRanges("not-an-ip"));
});
