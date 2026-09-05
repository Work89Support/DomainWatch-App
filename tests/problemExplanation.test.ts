import test from "node:test";
import assert from "node:assert/strict";
import { explainProblem } from "../src/lib/problemExplanation";

test("DNS failure is readable without claiming carrier blocking", () => {
  const result = explainProblem('UnknownHostException: Unable to resolve host "app.lion123.xyz": No address associated with hostname');
  assert.match(result.reason, /หาที่อยู่ของเว็บไซต์นี้ไม่พบ/);
  assert.match(result.next, /ยังสรุปไม่ได้/);
  assert.doesNotMatch(result.reason, /UnknownHostException/);
});
test("timeout and app cleartext policy do not imply a site outage", () => {
  assert.match(explainProblem("SocketTimeoutException: Read timed out").reason, /ยังยืนยันไม่ได้ว่าเว็บล่ม/);
  assert.match(explainProblem("Cleartext HTTP traffic not permitted").reason, /แอปตรวจไม่อนุญาต/);
});
test("HTTP errors have practical explanations and unknown evidence stays uncertain", () => {
  assert.match(explainProblem(null, 404).reason, /ไม่พบหน้า/);
  assert.match(explainProblem(null, 403).reason, /ยังไม่ได้ยืนยัน/);
  assert.match(explainProblem(null, 503).reason, /ระบบของเว็บไซต์/);
  assert.match(explainProblem("unexpected error").reason, /ยังระบุสาเหตุแน่ชัดไม่ได้/);
});
