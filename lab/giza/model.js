/* A rule builds this model; evidence tells us which parts belong to history. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GizaModel = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // This exact function is displayed in the instrument.
  function layersFor(N) {
    if (!Number.isInteger(N) || N < 4 || N > 10) {
      throw new RangeError('N must be an integer from 4 to 10');
    }
    const layers = [];
    for (let k = 0; k < N; k++) {
      const side = 2 * (N - k) - 1;
      layers.push({ k, side, blocks: side * side });
    }
    return layers;
  }
  function validate(state) {
    if (!state || typeof state !== 'object') throw new TypeError('State required');
    layersFor(state.N);
    if (!Number.isInteger(state.built) || state.built < 0 || state.built > state.N) {
      throw new RangeError('Built layers must be an integer from zero to N');
    }
  }
  function create(N = 4) {
    layersFor(N);
    return Object.freeze({ N, built: 0 });
  }
  function advance(state) {
    validate(state);
    return Object.freeze({ N: state.N, built: Math.min(state.N, state.built + 1) });
  }
  function reset(state) { validate(state); return create(state.N); }
  function progress(state) {
    validate(state);
    const layers = layersFor(state.N);
    const totalBlocks = state.N * (4 * state.N * state.N - 1) / 3;
    const placedBlocks = layers.slice(0, state.built).reduce((sum, l) => sum + l.blocks, 0);
    return { layers, totalBlocks, placedBlocks, height: state.built, targetHeight: state.N,
      baseSide: 2 * state.N - 1, heightFraction: state.built / state.N,
      blockFraction: placedBlocks / totalBlocks,
      latest: state.built ? layers[state.built - 1] : null,
      next: layers[state.built] || null, done: state.built === state.N };
  }
  // Unit cubes. Coordinates are lower corners, not centres.
  function cells(state) {
    validate(state);
    const out = [];
    for (const layer of layersFor(state.N).slice(0, state.built)) {
      for (let i = 0; i < layer.side; i++) {
        for (let j = 0; j < layer.side; j++) {
          out.push({ id: `${layer.k}:${i}:${j}`, k: layer.k,
            x: i - layer.side / 2, y: j - layer.side / 2, z: layer.k });
        }
      }
    }
    return out;
  }
  function project(x, y, z) {
    return { u: (x - y) * Math.sqrt(3) / 2, v: (x + y) / 2 - z };
  }
  return Object.freeze({ layersFor, create, advance, reset, progress, cells, project });
});
