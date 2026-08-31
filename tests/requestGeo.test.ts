import assert from "node:assert/strict";
import test from "node:test";
import { getRequestGeo, hasRequestGeo } from "../src/lib/requestGeo";

test("reads and decodes coarse Vercel IP location without exposing an IP", () => {
  const headers = new Headers({
    "x-vercel-ip-country": "th",
    "x-vercel-ip-country-region": "10",
    "x-vercel-ip-city": "Bangkok%20City",
    "x-forwarded-for": "203.0.113.7",
  });
  const geo = getRequestGeo(headers);
  assert.deepEqual(geo, { country: "TH", region: "10", city: "Bangkok City" });
  assert.equal(JSON.stringify(geo).includes("203.0.113.7"), false);
});

test("returns an empty coarse location when hosting headers are absent", () => {
  const geo = getRequestGeo(new Headers());
  assert.deepEqual(geo, { country: null, region: null, city: null });
  assert.equal(hasRequestGeo(geo), false);
});
