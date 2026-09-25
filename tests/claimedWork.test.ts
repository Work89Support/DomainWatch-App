import test from "node:test";
import assert from "node:assert/strict";
import { claimedWork } from "../src/lib/claimedWork";
const ack = new Date("2026-09-25T01:00:00Z");
const done = new Date("2026-09-25T01:10:00Z");
const verified = new Date("2026-09-26T01:00:00Z");
const evidence = [{ action: "ACK", actorId: "employee", actorName: "Employee", createdAt: ack }];
test("credits claimant and excludes overnight verification delay", () => {
  assert.deepEqual(claimedWork("CLOSED", ack, done, evidence, verified), { userId: "employee", name: "Employee", minutes: 10 });
});
test("automatic recovery without employee completion earns no KPI", () => {
  assert.equal(claimedWork("CLOSED", ack, null, evidence, verified).minutes, null);
});
test("legacy editor without claim evidence is not credited", () => {
  assert.equal(claimedWork("CLOSED", ack, done, [], verified).userId, null);
  assert.equal(claimedWork("CLOSED", null, done, evidence, verified).minutes, null);
});
test("failed verification and paused cases earn no completed SIM work", () => {
  assert.equal(claimedWork("ADMIN_UPDATED", ack, done, evidence, null).minutes, null);
  assert.equal(claimedWork("PAUSED", ack, done, evidence, verified).minutes, null);
});
test("rejects completion before claim and ambiguous evidence", () => {
  assert.equal(claimedWork("CLOSED", done, ack, [{ ...evidence[0], createdAt: done }]).minutes, null);
  assert.equal(claimedWork("CLOSED", ack, done, [...evidence, { ...evidence[0], actorId: "other" }]).userId, null);
});
test("IT and central work stop timing at completion", () => {
  assert.equal(claimedWork("IT_RESOLVED", ack, done, evidence).minutes, 10);
});
const detected = new Date("2026-09-25T00:00:00Z");
const repair = { action: "admin_update", actorId: "fixer", actorName: "Fixer", createdAt: verified, details: { editedAt: done.toISOString() } };
test("no ACK credits evidenced fixer from detection to completion, not verification", () => {
  assert.deepEqual(claimedWork("CLOSED", null, done, [repair], verified, detected), { userId: "fixer", name: "Fixer", minutes: 70 });
});
test("claimant stays responsible when another user submits repair", () => {
  assert.equal(claimedWork("CLOSED", ack, done, [...evidence, repair], verified, detected).userId, "employee");
});
test("no ACK requires exact repair evidence and successful verification", () => {
  assert.equal(claimedWork("CLOSED", null, done, [], verified, detected).minutes,null);
  assert.equal(claimedWork("ADMIN_UPDATED", null, done, [repair], null, detected).minutes,null);
  assert.equal(claimedWork("CLOSED", null, done, [{...repair, action:"NOTE"}], verified, detected).minutes,null);
  assert.equal(claimedWork("CLOSED", null, done, [{...repair, details:{editedAt:ack.toISOString()}}], verified, detected).minutes,null);
  assert.equal(claimedWork("CLOSED", null, done, [repair,{...repair,actorId:"other"}], verified, detected).minutes,null);
});
test("IT completion without ACK uses detection and accepts only IT action", () => {
  assert.equal(claimedWork("IT_RESOLVED", null, done, [{...repair,action:"it_resolve"}], undefined, detected,true).minutes,70);
  assert.equal(claimedWork("IT_RESOLVED", null, done, [repair], undefined, detected,true).minutes,null);
});
