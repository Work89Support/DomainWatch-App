import test from "node:test";
import assert from "node:assert/strict";
import { forwardingInput, activeWaiting } from "../src/lib/caseWaiting";
import { caseStage, matchesCaseFilter } from "../src/lib/caseStage";
const data = { ...forwardingInput({ recipient: " ทีมไอที ", note: " รอจดโดเมนใหม่ " }), owner: "แอดมินเดิม", since: "2026-09-11T08:00:00Z" };
test("forwarding only requires recipient and work, no deadline", () => {
  assert.equal(data.recipient, "ทีมไอที");
  assert.equal(data.reason, "รอจดโดเมนใหม่");
  assert.equal(data.until, "");
  for(const body of [{recipient:"",note:"งาน"},{recipient:"ทีม",note:" "},{recipient:"x".repeat(201),note:"งาน"},{recipient:"ทีม",note:"x".repeat(2001)}]) assert.throws(()=>forwardingInput(body));
});
test("forwarded cases stay open, use their own filter and keep acknowledgment", () => {
  const c = {status:"OPEN", adminAckAt:"2026-09-11T04:10:00Z", waitingDetails:data};
  const before=JSON.stringify(c);
  assert.ok(activeWaiting(c));
  assert.equal(caseStage(c),"forwarded");
  assert.ok(matchesCaseFilter(c,"forwarded"));
  assert.ok(matchesCaseFilter(c,"open"));
  assert.equal(matchesCaseFilter(c,"waiting"),false);
  assert.equal(JSON.stringify(c),before);
  assert.equal(caseStage({...c,waitingDetails:null}),"working");
  for(const status of ["CLOSED","PAUSED","ADMIN_UPDATED"]) assert.equal(matchesCaseFilter({...c,status},"forwarded"),false);
  assert.equal(matchesCaseFilter({...c,adminUpdatedAt:"2026-09-11T09:00:00Z"},"forwarded"),false);
});
