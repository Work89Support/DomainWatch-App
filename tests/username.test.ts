import test from "node:test";
import assert from "node:assert/strict";
import { normalizeUsername } from "../src/lib/username";
test("username preserves login casing and existing email-style usernames", () => {
  assert.equal(normalizeUsername(" Testbot "), "Testbot");
  assert.equal(normalizeUsername("head@example.com"), "head@example.com");
});
test("invalid usernames are rejected", () => {
  for (const value of [null, 123, "", "   ", "test bot", "test\nbot", "a".repeat(101)]) assert.equal(normalizeUsername(value), null);
});
