/* Studio 3000: change one rule, predict its consequence, then measure it. */
(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.StudioModel = model;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function number(value, name, min, max) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
      throw new RangeError(name + ': outside the finite supported range');
    return value;
  }
  function facade(p) {
    const cols = number(p.cols, 'Columns', 1, 24), rows = number(p.rows, 'Rows', 1, 16);
    if (!Number.isInteger(cols) || !Number.isInteger(rows)) throw new RangeError('Counts must be integers');
    const amplitude = number(p.amplitude, 'Amplitude', 0, 80) * Math.PI / 180;
    const phase = number(p.phase, 'Phase', -1000000, 1000000);
    const width = 0.8, height = 1.0, pitchX = 1, pitchY = 1.2;
    const panels = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const angle = amplitude * Math.sin(phase + i * 0.65 + j * 0.35);
      const cx = (i - (cols - 1) / 2) * pitchX, cy = (j - (rows - 1) / 2) * pitchY;
      const vertices = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v]) => [cx + u * width / 2 * Math.cos(angle), cy + v * height / 2, -u * width / 2 * Math.sin(angle)]);
      panels.push({i,j,angle,vertices});
    }
    return {panels,count:cols*rows,area:cols*rows*width*height,width,height,pitchX,pitchY};
  }
  function cantilever(p) {
    const F = number(p.F, 'Load (kN)', 0, 100) * 1000;
    const L = number(p.L, 'Length (m)', 0.1, 20);
    const b = number(p.b, 'Width (mm)', 10, 1000) / 1000;
    const h = number(p.h, 'Depth (mm)', 10, 2000) / 1000;
    const E = number(p.E, 'Modulus (GPa)', 0.1, 500) * 1e9;
    const I = b * h ** 3 / 12, delta = F * L ** 3 / (3 * E * I);
    const v = x => { number(x, 'Position (m)', 0, L); return F * x * x * (3 * L - x) / (6 * E * I); };
    return {F,L,b,h,E,I,delta,R:F,M:F*L,ratio:delta/L,slenderness:L/h,v};
  }
  return Object.freeze({facade,cantilever});
});
