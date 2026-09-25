import test from 'node:test';
import assert from 'node:assert/strict';
import { ackRange, fmtAckDuration } from '../src/lib/ackRange';
const c = (id: string, ms: number | null) => ({ id, name: 'Staff', source: 'MOBILE', detectedAt: new Date(0), adminAckAt: ms === null ? null : new Date(ms) });
test('ack extremes exclude missing, negative, invalid dates; retain zero and exact milliseconds', () => {
  const r = ackRange([c('a',0),c('b',1000),c('c',null),c('d',-1),c('e',NaN)]);
  assert.equal(r.fastest?.id,'a'); assert.equal(r.slowest?.milliseconds,1000);
});
test('empty, singleton, ties are explicit', () => {
  assert.deepEqual(ackRange([]),{fastest:null,slowest:null});
  assert.equal(ackRange([c('a',5)]).slowest?.id,'a');
  assert.equal(ackRange([c('a',5),c('b',5)]).fastest?.ties,2);
});
test('duration shows seconds, long hours and missing state', () => {
  assert.equal(fmtAckDuration(999),'น้อยกว่า 1 วินาที');
  assert.equal(fmtAckDuration(90061000),'25 ชม. 1 นาที 1 วินาที');
  assert.equal(fmtAckDuration(undefined),'—');
});
