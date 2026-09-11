import test from "node:test";
import assert from "node:assert/strict";
import { sameLinkUrl } from "../src/lib/bulkLink";

test("bulk matches equivalent full URLs", () => {
  assert.equal(sameLinkUrl(" https://app.ferrari8.biz/ ", "https://APP.FERRARI8.BIZ"), true);
});
test("bulk does not merge referral codes, paths, fragments or protocols", () => {
  for (const other of ["https://example.com/?ref=two", "https://example.com/login?ref=one", "http://example.com/?ref=one", "https://example.com/?ref=one#other"]) {
    assert.equal(sameLinkUrl("https://example.com/?ref=one", other), false);
  }
  assert.equal(sameLinkUrl("", ""), false);
});
