import test from "node:test";
import assert from "node:assert/strict";
import { visibleInStaffKpi } from "../src/lib/kpiVisibility";
const base = { status: "CLOSED", adminAckAt: null, adminResponseMin: null };
test("staff report excludes unsubstantiated and automatic cases without deleting history", () => {
  assert.equal(visibleInStaffKpi(base), false);
  assert.equal(visibleInStaffKpi({...base,status:"OPEN"}),false);
  assert.deepEqual(base,{status:"CLOSED",adminAckAt:null,adminResponseMin:null});
});
test("keeps claims, zero-minute repairs, IT work; excludes paused", () => {
  assert.equal(visibleInStaffKpi({...base,adminAckAt:new Date()}),true);
  assert.equal(visibleInStaffKpi({...base,adminResponseMin:0}),true);
  assert.equal(visibleInStaffKpi({...base,itResponseMin:0}),true);
  assert.equal(visibleInStaffKpi({...base,status:"PAUSED",adminResponseMin:10}),false);
});
