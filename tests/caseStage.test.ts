import test from "node:test";
import assert from "node:assert/strict";
import { caseStage, matchesCaseFilter } from "../src/lib/caseStage";

const ack = "2026-09-11T04:10:00Z";
const waitingDetails = { reason: "รอโดเมน", since: "2026-09-11T05:00:00Z", until: "2026-09-12T05:00:00Z", owner: "หัวหน้า", impact: "กำลังตรวจสอบผลกระทบ" };
test("previously acknowledged cases are working without migration or changed timestamps", () => {
  const c = { status: "OPEN", adminAckAt: ack };
  const before = JSON.stringify(c);
  assert.equal(caseStage(c), "working");
  assert.equal(matchesCaseFilter(c, "unclaimed"), false);
  assert.equal(matchesCaseFilter(c, "waiting"), false);
  assert.equal(JSON.stringify(c), before);
  assert.equal(caseStage({status: "OPEN", itAckAt: ack}), "working");
  assert.equal(caseStage({status: "OPEN", adminAckAt: null}), "unclaimed");
});
test("pending cases split into exclusive stages and still count as open", () => {
  const cases = [
    {status:"OPEN"}, {status:"OPEN", adminAckAt:ack},
    {status:"OPEN", adminAckAt:ack, waitingDetails},
    {status:"ADMIN_UPDATED", adminAckAt:ack, waitingDetails},
    {status:"IT_RESOLVED", itAckAt:ack},
  ];
  for (const c of cases) {
    assert.equal(matchesCaseFilter(c,"open"),true);
    assert.equal((["unclaimed","working","waiting","verification"] as const).filter(f=>matchesCaseFilter(c,f)).length,1);
  }
  assert.equal(caseStage(cases[2]), "waiting");
  assert.equal(caseStage(cases[3]), "verification");
  assert.equal(caseStage(cases[4]), "verification");
});
test("closed and paused cases with old acknowledgements never enter open groups", () => {
  for(const status of ["CLOSED","PAUSED"]) {
    const c={status,adminAckAt:ack,waitingDetails};
    assert.equal(matchesCaseFilter(c,"open"),false);
    assert.equal(matchesCaseFilter(c,"working"),false);
    assert.equal(matchesCaseFilter(c,"waiting"),false);
    assert.equal(matchesCaseFilter(c,"all"),true);
  }
});
