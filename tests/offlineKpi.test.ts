import { test } from "node:test";
import assert from "node:assert/strict";
import { offlineSpans, waitingOverlapMs, type Presence } from "../src/lib/offlineKpi";
const date = (m: number) => new Date(m*60_000);
const event = (m: number, kind = "HEARTBEAT", ownerId: string | null = "ice"): Presence => ({ agentId: "a", agentName: "AIS", ownerId, kind, createdAt: date(m) });
test("no invented history and 12 minute grace", () => {
  assert.equal(offlineSpans([],date(60)).length,0);
  assert.equal(offlineSpans([event(0)],date(12)).length,0);
  const s = offlineSpans([event(0),event(30)],date(31));
  assert.deepEqual(s.map(x=>[x.start.getTime()/60000,x.end.getTime()/60000]),[[12,30]]);
});
test("ongoing gap clips to report dates", () => {
  const [s] = offlineSpans([event(0)],date(60),date(20),date(40));
  assert.equal(s.start.getTime(),date(20).getTime()); assert.equal(s.end.getTime(),date(40).getTime()); assert.equal(s.ongoing,false);
});
test("owner changes split only responsibility, not heartbeat grace", () => {
  const s = offlineSpans([event(0),event(20,"OWNER","oom")],date(30));
  assert.deepEqual(s.map(x=>[x.ownerId,x.start.getTime()/60000,x.end.getTime()/60000]),[["ice",12,20],["oom",20,30]]);
});
test("disabled period excluded; restart establishes baseline", () => {
  const s = offlineSpans([event(0),event(20,"STOP"),event(100)],date(105));
  assert.equal(s.length,1); assert.equal(s[0].end.getTime(),date(20).getTime());
});
test("assignment without heartbeat is not evidence of downtime", () => {
  assert.equal(offlineSpans([event(0,"OWNER")],date(60)).length,0);
});
test("waiting intersection unions overlapping cases", () => {
  const [s] = offlineSpans([event(0)],date(60));
  assert.equal(waitingOverlapMs(s,[{adminUpdatedAt:date(20),resolvedAt:date(40)},{adminUpdatedAt:date(30),resolvedAt:date(50)},{adminUpdatedAt:null,resolvedAt:null}]),30*60000);
});
