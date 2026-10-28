// ui.js — kontrolna traka svetova: kretanje (1 Tura · 2 Orbit · 3 Hod), sloj obrade (4–8), raspored (G), pomoć (H).
// DOM, ne WebGL. Stil nasleđuje --akcenat i boju teksta sveta; na telefonu se sažima u dva reda.
import { SLOJEVI } from './foto.js';

const CSS = `
.traka{position:fixed;right:20px;top:20px;display:flex;flex-direction:column;gap:6px;align-items:flex-end;font:11px/1.2 ui-monospace,"Cascadia Mono",Consolas,monospace;z-index:5}
.traka .red{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.traka button{all:unset;cursor:pointer;padding:5px 8px;border:1px solid color-mix(in srgb,currentColor 38%,transparent);color:inherit;opacity:.78;letter-spacing:.02em;background:color-mix(in srgb,var(--pozadina,#000) 35%,transparent)}
.traka button:hover{opacity:1}
.traka button[aria-pressed=true]{opacity:1;color:var(--akcenat);border-color:var(--akcenat)}
.traka button kbd{font:inherit;opacity:.5;margin-right:5px}
.traka .naslovic{opacity:.5;margin-right:2px;align-self:center}
.pomoc{max-width:44ch;text-align:right;opacity:.72;display:none;padding:8px 10px;border:1px solid color-mix(in srgb,currentColor 25%,transparent);background:color-mix(in srgb,var(--pozadina,#000) 70%,transparent)}
.pomoc.on{display:block}
.oznaka.osa{font-size:10px;opacity:.62;letter-spacing:.06em;text-transform:uppercase}
@media (max-width:600px){.traka{right:8px;top:auto;bottom:8px;left:8px;align-items:stretch}.traka .red{justify-content:flex-start}.traka .naslovic{display:none}.traka button kbd{display:none}.pomoc{text-align:left;max-width:none}}
`;

/**
 * kontrole({ nav, sloj(idx), raspored(0|1), pomoc, poziv }) → { oznaciSloj, oznaciMod, oznaciRaspored }
 * `poziv` budi petlju kad je prikaz na zahtev (reduced-motion).
 */
export function kontrole({ nav, sloj, rasporedFn, pomoc, dodatno = [], probudi = () => {}, nazivRasporeda = ['Svet', 'Prostor osa'] }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const tr = document.createElement('div'); tr.className = 'traka'; tr.setAttribute('role', 'toolbar'); tr.setAttribute('aria-label', 'Kretanje i slojevi obrade');
  const red = () => { const r = document.createElement('div'); r.className = 'red'; tr.appendChild(r); return r; };
  const dugme = (r, tekst, kljuc, fn, title) => { const b = document.createElement('button'); b.innerHTML = `<kbd>${kljuc}</kbd>${tekst}`; b.title = title || ''; b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', () => { fn(); probudi(); }); r.appendChild(b); return b; };

  const rH = red(); const lh = document.createElement('span'); lh.className = 'naslovic'; lh.textContent = 'kretanje'; rH.appendChild(lh);
  const mod = { tura: dugme(rH, 'Tura', '1', () => nav.mode('tura'), 'autopilot kamera'), orbit: dugme(rH, 'Orbit', '2', () => nav.mode('orbit'), 'prevlačenje, desni klik pomera, točkić zumira'), hod: dugme(rH, 'Hod', '3', () => nav.mode('hod'), 'WASD + prevlačenje, Q/E dole/gore, Shift brže') };
  const rS = red(); const ls = document.createElement('span'); ls.className = 'naslovic'; ls.textContent = 'sloj'; rS.appendChild(ls);
  const imena = { original: 'Original', ivice: 'Ivice', relijef: 'Relijef', raster: 'Raster', sve: 'Sve' };
  const naslovi = { original: 'fotografija kakva jeste', ivice: 'Sobel nad sličicom, kod svetli nad tamnim originalom', relijef: 'svetlina sličice pomera mrežu u prostoru', raster: 'polutonski krugovi u pikselima sličice', sve: 'relijef + ivice + original' };
  const sl = SLOJEVI.map((n, i) => dugme(rS, imena[n], String(i + 4), () => { sloj(i); oznaciSloj(i); }, naslovi[n]));
  const rR = red(); const lr = document.createElement('span'); lr.className = 'naslovic'; lr.textContent = 'raspored'; rR.appendChild(lr);
  const nasl = { 0: 'raspored sveta', 1: 'svaka slika po rangu hue × svetlina × zasićenje', 2: 'hodnik čiji su zidovi same slike — šetaš kroz građu' };
  const rs = nazivRasporeda.map((n, i) => dugme(rR, n, i === 0 ? 'G' : '', () => { rasporedFn(i); oznaciRaspored(i); }, nasl[i] || ''));
  dodatno.forEach(d => dugme(rR, d.tekst, d.kljuc, d.fn, d.title));
  const hp = dugme(rR, '?', 'H', () => ph.classList.toggle('on'), 'pomoć');
  const ph = document.createElement('div'); ph.className = 'pomoc'; ph.innerHTML = pomoc; tr.appendChild(ph);
  document.body.appendChild(tr);

  function oznaciMod(m) { for (const k in mod) mod[k].setAttribute('aria-pressed', k === m ? 'true' : 'false'); }
  function oznaciSloj(i) { sl.forEach((b, k) => b.setAttribute('aria-pressed', k === i ? 'true' : 'false')); }
  function oznaciRaspored(i) { rs.forEach((b, k) => b.setAttribute('aria-pressed', k === i ? 'true' : 'false')); }
  oznaciMod('tura'); oznaciSloj(0); oznaciRaspored(0);
  addEventListener('keydown', ev => {
    if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
    const m = /^Digit([4-8])$/.exec(ev.code);
    if (m) { const i = +m[1] - 4; sloj(i); oznaciSloj(i); probudi(); }
    else if (ev.code === 'KeyG') { const cur = rs.findIndex(b => b.getAttribute('aria-pressed') === 'true'); const i = (cur + 1) % rs.length; rasporedFn(i); oznaciRaspored(i); probudi(); }
    else if (ev.code === 'KeyH') ph.classList.toggle('on');
  });
  return { oznaciMod, oznaciSloj, oznaciRaspored };
}

/** Početno stanje iz upita (?sloj=2&osa=1&galerija=1&mod=orbit) — za snimke, ne za posetioca. */
export function izUpita({ U, ui, rasp, nav, cOblak, razmak, trazi, rasporedFn = null }) {
  const q = new URLSearchParams(location.search);
  if (q.has('sloj')) { const i = +q.get('sloj'); U.sloj(i); ui.oznaciSloj(i); }
  if (q.get('galerija') === '1') { if (rasporedFn) rasporedFn(2); else rasp.postavi(2); ui.oznaciRaspored(2); rasp.skoci(); }
  else if (q.get('osa') === '1') { rasp.postavi(1); ui.oznaciRaspored(1); nav.fokus(cOblak, razmak); nav.skoci(); rasp.skoci(); }
  else if (q.has('mod')) nav.mode(q.get('mod'));
  trazi();
}
