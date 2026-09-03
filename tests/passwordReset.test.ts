import assert from "node:assert/strict";
import test from "node:test";
import {
  PASSWORD_RESET_TTL_MS,
  createPasswordResetToken,
  hashPasswordResetToken,
  isValidEmail,
  normalizeEmail,
} from "../src/lib/passwordReset";

test("normalizes and validates reset email addresses", () => {
  assert.equal(normalizeEmail("  User@Example.COM "), "user@example.com");
  assert.equal(isValidEmail("user@example.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
});

test("stores only a deterministic hash of a random reset token", () => {
  const a = createPasswordResetToken();
  const b = createPasswordResetToken();
  assert.notEqual(a.rawToken, b.rawToken);
  assert.notEqual(a.tokenHash, a.rawToken);
  assert.equal(a.tokenHash, hashPasswordResetToken(a.rawToken));
  assert.ok(a.expiresAt.getTime() > Date.now() + PASSWORD_RESET_TTL_MS - 5_000);
});
