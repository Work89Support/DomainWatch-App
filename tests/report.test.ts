import test from "node:test";
import assert from "node:assert/strict";
import { countUniqueCompanyUrls } from "../src/lib/report";

test("daily report counts duplicate room links as one real URL per company", () => {
  const count = countUniqueCompanyUrls([
    { companyId: "a", url: "https://example.com/login#room-one" },
    { companyId: "a", url: "https://example.com/login#room-two" },
    { companyId: "b", url: "https://example.com/login" },
  ]);

  assert.equal(count, 2);
});
