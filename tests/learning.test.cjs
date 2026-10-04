'use strict';
const assert = require('node:assert/strict');
const M = require('../lab/dizajn/learning-model.js');
let count = 0;
function test(name, check) { check(); count++; console.log('PASS ' + name); }
function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-10, actual + ' != ' + expected); }
const p = { n: 3, width_mm: 600, gap_mm: 20 };
const saved = () => M.record(M.initial(), 'en', '2026-10-04T12:00:00.000Z');

test('a fresh notebook has no selected panel, predictions, reveals or claimed execution', () => {
  const s = M.initial(); assert.equal(s.selectedId, null); assert.equal(s.codeHasRun, false);
  assert.ok(Object.values(s.predictions).every(v => v === '')); assert.ok(Object.values(s.reveals).every(v => v === false));
});
test('known row uses two internal gaps and explicit left edges', () => {
  const r = M.row(p); assert.deepEqual(r.positions_mm, [0, 620, 1240]); assert.equal(r.span_mm, 1840); assert.equal(r.joints, 2); near(r.panelArea_m2, 2.16);
});
test('one panel has no extra exterior gap', () => {
  const r = M.row({ ...p, n: 1 }); assert.deepEqual(r.positions_mm, [0]); assert.equal(r.span_mm, 600); assert.equal(r.extraJointSpan_mm, 620);
});
test('zero gaps cannot distinguish the two counting rules', () => {
  const r = M.row({ ...p, gap_mm: 0 }); assert.equal(r.span_mm, 1800); assert.equal(r.span_mm, r.extraJointSpan_mm);
});
test('both facades keep quantities while the glass-edge relationship changes', () => {
  const a = M.facade('a'), b = M.facade('b'); assert.deepEqual(a.cells.filter(c => c.glass).map(c => c.id), ['A', 'B']); assert.deepEqual(b.cells.filter(c => c.glass).map(c => c.id), ['A', 'F']);
  assert.equal(a.glass, b.glass); assert.equal(a.solid, b.solid); near(a.glassArea_m2 + a.solidArea_m2, 2.16); assert.equal(a.glassShareEdge, true); assert.equal(b.glassShareEdge, false);
});
test('all neighbour sets include both directions and exclude diagonals', () => {
  const cells = M.facade('a').cells;
  const expected = { A: ['B', 'D'], B: ['A', 'C', 'E'], C: ['B', 'F'], D: ['A', 'E'], E: ['B', 'D', 'F'], F: ['C', 'E'] };
  for (const id of M.ids) assert.deepEqual(M.neighbors(cells, id), expected[id]);
});
test('table permutation does not change neighbour identities', () => {
  const cells = M.facade('a').cells;
  for (const order of [cells, [...cells].reverse(), [cells[5], cells[0], cells[3], cells[2], cells[1], cells[4]]]) assert.deepEqual(M.neighbors(order, 'B'), ['A', 'C', 'E']);
});
test('ambiguous identity and duplicate spatial locations are rejected', () => {
  const cells = M.facade('a').cells;
  assert.throws(() => M.neighbors(cells.map((c, i) => i === 1 ? { ...c, id: 'A' } : c), 'B'));
  assert.throws(() => M.neighbors(cells.map((c, i) => i === 1 ? { ...c, col: 1 } : c), 'B'));
  assert.throws(() => M.neighbors(cells, 'Z'));
});
test('shared identity is counted once before and after the changed case', () => {
  const a = M.shared(1200), b = M.shared(1500); near(a.groupA_m2, 2.16); near(a.sum_m2, 4.32); near(a.unique_m2, 3.6);
  near(b.groupA_m2, 2.34); near(b.sum_m2, 4.68); near(b.unique_m2, 3.78); near(b.unique_m2 - a.unique_m2, .18);
});
test('actual execution has five real state transitions', () => {
  const r = M.execute(M.program(p)); assert.equal(r.memory.span, 1840); assert.equal(r.matches, true); assert.equal(r.trace.length, 5);
  assert.deepEqual(r.trace[0].before, {}); assert.deepEqual(r.trace[0].after, { n: 3 }); assert.equal(r.trace[3].after.joints, 2); assert.equal(Object.hasOwn(r.trace[3].after, 'span'), false); assert.equal(r.trace[4].after.span, 1840);
});
test('a supported wrong rule executes and fails the geometric check', () => {
  const r = M.execute(M.program(p).replace('n - 1', 'n')); assert.equal(r.memory.span, 1860); assert.equal(r.matches, false); assert.equal(r.difference_mm, 20);
  const single = M.execute(M.program({ ...p, n: 1 }).replace('n - 1', 'n')); assert.equal(single.memory.span, 620); assert.equal(single.expectedSpan_mm, 600);
});
test('precedence and parenthesised expressions execute consistently', () => {
  const base = M.program(p); assert.equal(M.execute(base.replace('n * w + joints * gap', '(n * w) + ((n - 1) * gap)')).memory.span, 1840);
  assert.equal(M.execute(base.replace('n - 1', 'n - 1 * 2')).memory.joints, 1);
});
test('unsupported code cannot reach global state or call a function', () => {
  const base = M.program(p);
  for (const code of [base + '\nalert(1);', base.replace('n - 1', 'globalThis'), base.replace('n - 1', 'n.constructor'), base.replace('n - 1', 'alert(1)'), base.replace('n - 1', '(() => 1)()'), base.replace('let span', 'while span')]) assert.throws(() => M.execute(code));
});
test('unit mismatch, unavailable names, domain and complexity limits reject safely', () => {
  const base = M.program(p);
  for (const code of [base.replace('n - 1', 'span'), base.replace('n * w + joints * gap', 'w + n'), base.replace('n - 1', 'w'), base.replace('n = 3', 'n = 0'), base.replace('n - 1', '('.repeat(13) + 'n - 1' + ')'.repeat(13)), 'x'.repeat(701)]) assert.throws(() => M.execute(code));
});
test('record round trip preserves Unicode and input state without aliasing', () => {
  const s = M.initial(); s.note = 'Širina čuva značenje; 日本語.'; s.predictions.rule = 'Moja pretpostavka: 1840 mm'; s.parameters.n = 4; s.selectedId = 'E'; s.contextUnit = 'm';
  const r = M.parseRecord(JSON.stringify(M.record(s, 'sr'))); assert.equal(r.language, 'sr'); assert.equal(r.state.note, s.note); assert.equal(r.state.parameters.n, 4);
  r.state.parameters.n = 2; assert.equal(s.parameters.n, 4);
});
test('unfinished code is preserved but never treated as executed on import', () => {
  const r = saved(); r.state.code = '<script>not executed</script>'; r.state.codeHasRun = true;
  const parsed = M.parseRecord(JSON.stringify(r)); assert.equal(parsed.state.code, r.state.code); assert.equal(parsed.state.codeHasRun, false); assert.throws(() => M.execute(parsed.state.code));
});
test('invalid imports reject without mutating existing work', () => {
  const current = M.initial(), before = JSON.stringify(current);
  for (const mutate of [r => { r.schema = 'other'; }, r => { r.state.parameters.n = 100000; }, r => { r.state.parameters.n = '3'; }, r => { r.state.step = 'missing'; }, r => { r.state.selectedId = 'Z'; }, r => { r.state.sharedHeight_mm = 1400; }, r => { r.state.reveals.context = true; }, r => { r.state.predictions.rule = 'x'.repeat(601); }, r => { r.result = { span: 2 }; }, r => { delete r.state.parameters; }]) {
    const r = saved(); mutate(r); assert.throws(() => M.parseRecord(JSON.stringify(r))); assert.equal(JSON.stringify(current), before);
  }
});
test('prototype fields, excessive size and malformed JSON reject', () => {
  assert.throws(() => M.parseRecord('{"__proto__":{"polluted":true}}'));
  assert.throws(() => M.parseRecord(' '.repeat(M.maxBytes + 1)));
  assert.throws(() => M.parseRecord('{'));
  const r = saved(); r.state.note = 'x'.repeat(1501); assert.throws(() => M.parseRecord(JSON.stringify(r)));
  assert.equal({}.polluted, undefined);
});
test('finite numeric domains reject coercion and invalid grids', () => {
  for (const n of [0, 7, 1.5, '3', NaN, Infinity]) assert.throws(() => M.row({ ...p, n }));
  for (const width_mm of [0, 1201, .6]) assert.throws(() => M.row({ ...p, width_mm }));
  assert.throws(() => M.facade('__proto__')); assert.throws(() => M.shared(1501));
});
console.log(count + ' guided learning checks passed.');
