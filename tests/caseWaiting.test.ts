import test from "node:test";
import assert from "node:assert/strict";
import { activeWaiting, waitingInput, WAIT_IMPACTS } from "../src/lib/caseWaiting";
const now = new Date("2026-09-11T00:00:00Z");
const waitingDetails = { reason: "รอโดเมน", since: now.toISOString(), until: "2026-09-12T00:00:00Z", owner: "Admin", impact: WAIT_IMPACTS[0] };
test("waiting remains open; verified/closed/paused cases do not show waiting", () => {
  assert.ok(activeWaiting({status: "OPEN", waitingDetails}));
  for (const status of ["CLOSED", "PAUSED", "ADMIN_UPDATED"]) assert.equal(activeWaiting({status, waitingDetails}), null);
  assert.equal(activeWaiting({status:"OPEN", waitingDetails, adminUpdatedAt:"2026-09-11T01:00:00Z"}),null);
});
test("waiting requires reason, future follow-up and impact", () => {
  const input = {note:"รอจดโดเมน", until: waitingDetails.until, impact: WAIT_IMPACTS[0]};
  assert.equal(waitingInput(input,now).reason,"รอจดโดเมน");
  for (const change of [{note:" "},{note:"x".repeat(2001)},{until:"bad"},{until:now.toISOString()},{impact:"bad"}]) assert.throws(()=>waitingInput({...input,...change},now));
});
test("invalid and legacy waiting data is ignored", () => {
  for (const waitingDetails of [null,{}, {since:"bad",until:"bad",reason:"x",owner:"x",impact:"x"}]) assert.equal(activeWaiting({status:"OPEN",waitingDetails}),null);
});
