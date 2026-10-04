/* Make a description you can explain, change and check. Pure, bounded learning models. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LearningModel = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const version = '1.0.0';
  const schema = 'computing-studio-learning/v1';
  const maxBytes = 32768;
  const steps = ['context', 'representation', 'relations', 'rule', 'code', 'system'];
  const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
  function fail(code) { throw new RangeError(code); }
  function number(value, min, max, integer) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail('range');
    return value;
  }
  function one(value, choices) { if (!choices.includes(value)) fail('choice'); return value; }
  function text(value, limit) { if (typeof value !== 'string' || value.length > limit) fail('text'); return value; }
  function object(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('object');
    const actual = Object.keys(value);
    if (actual.length !== keys.length || actual.some(k => !keys.includes(k)) || keys.some(k => !Object.hasOwn(value, k))) fail('keys');
  }
  function parameters(p) {
    object(p, ['n', 'width_mm', 'gap_mm']);
    return { n: number(p.n, 1, 6, true), width_mm: number(p.width_mm, 200, 1200, true), gap_mm: number(p.gap_mm, 0, 100, true) };
  }
  function row(p) {
    p = parameters(p);
    return {
      positions_mm: Array.from({ length: p.n }, (_, i) => i * (p.width_mm + p.gap_mm)),
      joints: p.n - 1,
      span_mm: p.n * p.width_mm + (p.n - 1) * p.gap_mm,
      extraJointSpan_mm: p.n * p.width_mm + p.n * p.gap_mm,
      panelArea_m2: p.n * p.width_mm * 1200 / 1e6
    };
  }
  function facade(layout) {
    one(layout, ['a', 'b']);
    const glass = layout === 'a' ? ['A', 'B'] : ['A', 'F'];
    const cells = ids.map((id, i) => ({ id, row: Math.floor(i / 3) + 1, col: i % 3 + 1, glass: glass.includes(id) }));
    return { cells, glass: 2, solid: 4, glassArea_m2: .72, solidArea_m2: 1.44, area_m2: 2.16, glassShareEdge: layout === 'a' };
  }
  function neighbors(cells, id) {
    if (!Array.isArray(cells) || cells.length !== 6) fail('cells');
    const found = new Set();
    for (const c of cells) {
      if (!c || !ids.includes(c.id) || found.has(c.id)) fail('cells');
      found.add(c.id); number(c.row, 1, 2, true); number(c.col, 1, 3, true);
    }
    if (new Set(cells.map(c => c.row + ':' + c.col)).size !== 6) fail('cells');
    const selected = cells.find(c => c.id === id); if (!selected) fail('id');
    return cells.filter(c => Math.abs(c.row - selected.row) + Math.abs(c.col - selected.col) === 1).map(c => c.id).sort();
  }
  function shared(height_mm) {
    number(height_mm, 1200, 1500, true);
    const area = .6 * height_mm / 1000;
    return { sharedArea_m2: area, groupA_m2: 1.44 + area, groupB_m2: 1.44 + area, sum_m2: 2.88 + 2 * area, unique_m2: 2.88 + area, uniqueIds: ['P1', 'P2', 'P3', 'P4', 'P5'] };
  }
  function program(p) {
    p = parameters(p);
    return 'let n = ' + p.n + ';\nlet w = ' + p.width_mm + ';\nlet gap = ' + p.gap_mm + ';\nlet joints = n - 1;\nlet span = n * w + joints * gap;';
  }
  /* A small interpreter for five declarations, not eval or a JavaScript engine.
     Numeric literals, previous names, + - *, parentheses. No calls, properties,
     loops, strings or network. Every recorded row comes from this execution. */
  function execute(source) {
    text(source, 700);
    const lines = source.trim().split(/\r?\n/);
    const names = ['n', 'w', 'gap', 'joints', 'span'];
    if (lines.length !== 5) fail('code-lines');
    const memory = Object.create(null), dimensions = Object.create(null), trace = [];
    function expression(input) {
      const tokens = input.match(/\d+(?:\.\d+)?|[A-Za-z]+|[()+*\-]/g) || [];
      if (!tokens.length || tokens.length > 80 || tokens.join('') !== input.replace(/\s/g, '')) fail('code-token');
      let at = 0, depth = 0;
      function primary() {
        const token = tokens[at++];
        if (token === '(') { if (++depth > 12) fail('code-depth'); const value = add(); if (tokens[at++] !== ')') fail('code-parentheses'); depth--; return value; }
        if (/^\d+(?:\.\d+)?$/.test(token || '')) return { value: number(Number(token), 0, 1000000), dimension: 0 };
        if (!Object.hasOwn(memory, token)) fail('code-name');
        return { value: memory[token], dimension: dimensions[token] };
      }
      function multiply() {
        let value = primary();
        while (tokens[at] === '*') { at++; const rhs = primary(); value = { value: value.value * rhs.value, dimension: value.dimension + rhs.dimension }; number(value.value, -1e9, 1e9); }
        return value;
      }
      function add() {
        let value = multiply();
        while (tokens[at] === '+' || tokens[at] === '-') {
          const op = tokens[at++], rhs = multiply();
          if (value.dimension !== rhs.dimension) fail('code-unit');
          value = { value: op === '+' ? value.value + rhs.value : value.value - rhs.value, dimension: value.dimension };
          number(value.value, -1e9, 1e9);
        }
        return value;
      }
      const value = add(); if (at !== tokens.length) fail('code-token'); return value;
    }
    lines.forEach((line, index) => {
      const match = /^\s*let\s+([a-z]+)\s*=\s*([^;]+);\s*$/.exec(line);
      if (!match || match[1] !== names[index]) fail('code-order');
      const name = match[1], rhs = match[2].trim();
      let result;
      if (index < 3) {
        if (!/^\d+$/.test(rhs)) fail('code-input');
        const bounds = index === 0 ? [1, 6] : index === 1 ? [200, 1200] : [0, 100];
        result = { value: number(Number(rhs), bounds[0], bounds[1], true), dimension: index === 0 ? 0 : 1 };
      } else {
        result = expression(rhs);
        if (result.dimension !== (index === 3 ? 0 : 1)) fail('code-unit');
        number(result.value, 0, index === 3 ? 12 : 100000, index === 3);
      }
      const before = { ...memory };
      memory[name] = result.value; dimensions[name] = result.dimension;
      trace.push({ line: index + 1, source: line.trim(), name, value: result.value, unit: result.dimension ? 'mm' : 'count', before, after: { ...memory } });
    });
    const expected = row({ n: memory.n, width_mm: memory.w, gap_mm: memory.gap });
    return { memory: { ...memory }, trace, expectedSpan_mm: expected.span_mm, matches: Math.abs(memory.span - expected.span_mm) < 1e-9, difference_mm: memory.span - expected.span_mm };
  }
  function initial() {
    const p = { n: 3, width_mm: 600, gap_mm: 20 };
    return { step: 'context', contextShown: false, contextUnit: 'mm', layout: 'a', selectedId: null, order: 'mixed', parameters: p, sharedHeight_mm: 1200, predictions: Object.fromEntries(steps.map(s => [s, ''])), reveals: Object.fromEntries(steps.map(s => [s, false])), note: '', code: program(p), codeHasRun: false };
  }
  function validateState(value) {
    object(value, ['step', 'contextShown', 'contextUnit', 'layout', 'selectedId', 'order', 'parameters', 'sharedHeight_mm', 'predictions', 'reveals', 'note', 'code', 'codeHasRun']);
    one(value.contextUnit, ['mm', 'm']);
    one(value.step, steps); one(value.layout, ['a', 'b']); one(value.order, ['natural', 'mixed', 'reverse']);
    if (value.selectedId !== null) one(value.selectedId, ids);
    for (const k of ['contextShown', 'codeHasRun']) if (typeof value[k] !== 'boolean') fail('boolean');
    object(value.predictions, steps); object(value.reveals, steps);
    for (const step of steps) { text(value.predictions[step], 600); if (typeof value.reveals[step] !== 'boolean') fail('boolean'); }
    text(value.note, 1500); text(value.code, 700); one(value.sharedHeight_mm, [1200, 1500]);
    if (value.reveals.context && !value.contextShown) fail('context');
    parameters(value.parameters);
    // Unfinished code is legitimate local work. It never executes during import.
    return { ...value, parameters: parameters(value.parameters), predictions: { ...value.predictions }, reveals: { ...value.reveals } };
  }
  function record(state, language, date = new Date().toISOString()) {
    one(language, ['en', 'sr']);
    if (typeof date !== 'string' || date.length > 32 || !Number.isFinite(Date.parse(date))) fail('date');
    return { schema, modelVersion: version, savedAt: date, language, state: validateState(state) };
  }
  function byteLength(value) {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(value).length;
    return unescape(encodeURIComponent(value)).length;
  }
  function parseRecord(source) {
    if (typeof source !== 'string' || source.length > maxBytes || byteLength(source) > maxBytes) fail('file-size');
    let value; try { value = JSON.parse(source); } catch { fail('json'); }
    object(value, ['schema', 'modelVersion', 'savedAt', 'language', 'state']);
    if (value.schema !== schema || value.modelVersion !== version) fail('schema');
    const result = record(value.state, value.language, value.savedAt);
    // Imported trace and numeric claims are never trusted or carried in the schema.
    result.state.codeHasRun = false;
    return result;
  }
  return { version, schema, maxBytes, steps: [...steps], ids: [...ids], initial, parameters, row, facade, neighbors, shared, program, execute, validateState, record, parseRecord };
});
