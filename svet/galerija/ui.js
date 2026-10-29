// ui.js — kontrolna traka svetova: kretanje (1 Tura · 2 Orbit · 3 Hod), sloj obrade (4–8), raspored (G), pomoć (H), nazad (←).
// DOM, ne WebGL. Stil nasleđuje --akcenat i boju teksta sveta.
// Telefon (grubi pokazivač): traka je donji red sa velikim dugmadima, sloj se menja jednim dugmetom u krug,
// u Hodu se pojavljuje džojstik (levo dole) jer WASD ne postoji; kartica slike stoji iznad trake, ne ispod nje.
import { SLOJEVI } from './foto.js';

export const dodir = matchMedia('(pointer: coarse)').matches;

const CSS = `
.traka{position:fixed;right:20px;top:20px;display:flex;flex-direction:column;gap:6px;align-items:flex-end;font:11px/1.2 ui-monospace,"Cascadia Mono",Consolas,monospace;z-index:5}
.traka .red{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.traka button,.traka a.nazad{all:unset;cursor:pointer;padding:6px 9px;min-height:16px;border:1px solid color-mix(in srgb,currentColor 38%,transparent);color:inherit;opacity:.78;letter-spacing:.02em;background:color-mix(in srgb,var(--pozadina,#000) 45%,transparent);box-sizing:border-box}
.traka button:hover,.traka a.nazad:hover{opacity:1}
.traka button:focus-visible,.traka a.nazad:focus-visible{outline:2px solid var(--akcenat);outline-offset:2px;opacity:1}
.traka button[aria-pressed=true]{opacity:1;color:var(--akcenat);border-color:var(--akcenat)}
.traka button kbd{font:inherit;opacity:.5;margin-right:5px}
.traka .naslovic{opacity:.5;margin-right:2px;align-self:center}
.traka a.nazad{opacity:.62;margin-right:6px}
.pomoc{max-width:44ch;text-align:right;opacity:.8;display:none;padding:8px 10px;border:1px solid color-mix(in srgb,currentColor 25%,transparent);background:color-mix(in srgb,var(--pozadina,#000) 78%,transparent)}
.pomoc.on{display:block}
.oznaka.osa{font-size:10px;opacity:.62;letter-spacing:.06em;text-transform:uppercase}
.dzojstik{position:fixed;left:18px;bottom:calc(var(--traka-h,56px) + 22px);width:112px;height:112px;border-radius:50%;border:1px solid color-mix(in srgb,currentColor 40%,transparent);background:color-mix(in srgb,var(--pozadina,#000) 40%,transparent);display:none;touch-action:none;z-index:6}
.dzojstik.on{display:block}
.dzojstik i{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:var(--akcenat);opacity:.85;transition:transform 60ms}
.dzojstik small{position:absolute;left:0;right:0;bottom:-18px;text-align:center;font:10px ui-monospace,Consolas,monospace;opacity:.6;letter-spacing:.06em}
.zavesa{position:fixed;inset:0;display:grid;place-items:center;background:var(--pozadina,#000);z-index:9;transition:opacity 400ms;font:12px ui-monospace,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase;opacity:.92}
.zavesa.off{opacity:0;pointer-events:none}
@media (pointer: coarse), (max-width: 600px){
  .traka{right:0;top:auto;bottom:0;left:0;align-items:stretch;gap:0;background:color-mix(in srgb,var(--pozadina,#000) 82%,transparent);border-top:1px solid color-mix(in srgb,currentColor 18%,transparent);padding:6px 6px calc(6px + env(safe-area-inset-bottom));font-size:12px}
  .traka .red{justify-content:flex-start;gap:5px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding:3px 2px}
  .traka .red::-webkit-scrollbar{display:none}
  .traka .naslovic{display:none}.traka button kbd{display:none}
  .traka button,.traka a.nazad{min-height:40px;padding:0 13px;display:inline-flex;align-items:center;white-space:nowrap;opacity:.9;border-radius:3px;flex-shrink:0}
  .traka a.nazad{margin:0}
  .traka .red.slojevi button{display:none}.traka .red.slojevi button.krug{display:inline-flex}
  .pomoc{position:fixed;left:8px;right:8px;bottom:calc(var(--traka-h,56px) + 8px);max-width:none;text-align:left;font-size:12px;line-height:1.45;padding:10px 12px}
  .naslov{top:14px!important;left:14px!important;right:14px}.naslov h1{font-size:20px!important}.naslov p{font-size:11px!important;max-width:none!important}
  .karta{bottom:calc(var(--traka-h,56px) + 12px)!important;left:14px!important;max-width:calc(100vw - 28px)!important;font-size:12px;background:color-mix(in srgb,var(--pozadina,#000) 70%,transparent);padding:8px 10px!important;border-left-width:2px}
  .legenda{display:none!important}
}
`;

/**
 * kontrole({ nav, sloj(idx), rasporedFn(i), pomoc, dodatno, probudi, nazivRasporeda, nazad }) → { oznaciSloj, oznaciMod, oznaciRaspored, spremno }
 * `probudi` budi petlju kad je prikaz na zahtev (reduced-motion). `nazad` je { href, tekst } za povratak u galeriju.
 */
export function kontrole({ nav, sloj, rasporedFn, pomoc, dodatno = [], probudi = () => {}, nazivRasporeda = ['Svet', 'Prostor osa'], nazad = { href: './', tekst: '← Galerija' } }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  // zavesa stoji u HTML-u od prvog bajta (#zavesa); ovde se samo stilizuje i spušta posle prvog kadra
  const zavesa = document.getElementById('zavesa') || (() => { const z = document.createElement('div'); z.id = 'zavesa'; document.body.appendChild(z); return z; })();
  zavesa.className = 'zavesa'; if (!zavesa.textContent) zavesa.textContent = 'učitavam slike…';
  const tr = document.createElement('div'); tr.className = 'traka'; tr.setAttribute('role', 'toolbar'); tr.setAttribute('aria-label', 'Kretanje i slojevi obrade');
  const red = (klasa = '') => { const r = document.createElement('div'); r.className = 'red ' + klasa; tr.appendChild(r); return r; };
  const dugme = (r, tekst, kljuc, fn, title) => { const b = document.createElement('button'); b.type = 'button'; b.innerHTML = kljuc ? `<kbd>${kljuc}</kbd>${tekst}` : tekst; b.title = title || ''; b.setAttribute('aria-label', title ? `${tekst} — ${title}` : tekst); b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', () => { fn(); probudi(); }); r.appendChild(b); return b; };

  const rH = red('kretanje');
  if (nazad) { const a = document.createElement('a'); a.className = 'nazad'; a.href = nazad.href; a.textContent = nazad.tekst; rH.appendChild(a); }
  const lh = document.createElement('span'); lh.className = 'naslovic'; lh.textContent = 'kretanje'; rH.appendChild(lh);
  const mod = { tura: dugme(rH, 'Tura', '1', () => nav.mode('tura'), 'autopilot kamera'), orbit: dugme(rH, 'Orbit', '2', () => nav.mode('orbit'), dodir ? 'jedan prst okreće, dva prsta zumiraju i pomeraju' : 'prevlačenje okreće, desni klik pomera, točkić zumira'), hod: dugme(rH, 'Hod', '3', () => nav.mode('hod'), dodir ? 'džojstik hoda, prevlačenje gleda' : 'WASD + prevlačenje, Q/E dole/gore, Shift brže') };
  const rS = red('slojevi'); const ls = document.createElement('span'); ls.className = 'naslovic'; ls.textContent = 'sloj'; rS.appendChild(ls);
  const imena = { original: 'Original', ivice: 'Ivice', relijef: 'Relijef', raster: 'Raster', sve: 'Sve' };
  const naslovi = { original: 'fotografija kakva jeste', ivice: 'Sobel nad sličicom, kod svetli nad tamnim originalom', relijef: 'svetlina sličice pomera mrežu u prostoru', raster: 'polutonski krugovi u pikselima sličice', sve: 'relijef + ivice + original' };
  const sl = SLOJEVI.map((n, i) => dugme(rS, imena[n], String(i + 4), () => { sloj(i); oznaciSloj(i); }, naslovi[n]));
  // telefon: jedno dugme menja sloj u krug (pet dugmadi ne staje u red)
  const krug = dugme(rS, 'Sloj: Original', '', () => { const i = (trenutniSloj + 1) % SLOJEVI.length; sloj(i); oznaciSloj(i); }, 'sledeći sloj obrade slike'); krug.className = 'krug';
  const rR = red('raspored'); const lr = document.createElement('span'); lr.className = 'naslovic'; lr.textContent = 'raspored'; rR.appendChild(lr);
  const nasl = { 0: 'raspored sveta', 1: 'svaka slika po rangu hue × svetlina × zasićenje', 2: 'hodnik čiji su zidovi same slike — šetaš kroz građu' };
  const rs = nazivRasporeda.map((n, i) => dugme(rR, n, i === 0 ? 'G' : '', () => { rasporedFn(i); oznaciRaspored(i); }, nasl[i] || ''));
  if (dodir) { rR.prepend(krug); rS.hidden = true; }   // telefon: dva reda — kretanje · sloj+raspored+pomoć
  dodatno.forEach(d => dugme(rR, d.tekst, d.kljuc, d.fn, d.title));
  const hp = dugme(rR, '?', 'H', () => { ph.classList.toggle('on'); hp.setAttribute('aria-pressed', ph.classList.contains('on') ? 'true' : 'false'); }, 'pomoć');
  const ph = document.createElement('div'); ph.className = 'pomoc'; ph.setAttribute('role', 'note');
  ph.innerHTML = dodir ? '<b>Dodir</b> · jedan prst okreće pogled, dva prsta zumiraju i pomeraju · dodir na sliku otvara njen podatak · <b>Hod</b>: džojstik levo dole hoda, prevlačenje po slici gleda, zid (slika) zaustavlja.<br>' + pomoc : pomoc;
  tr.appendChild(ph);
  document.body.appendChild(tr);

  // džojstik za Hod na dodir
  const dz = document.createElement('div'); dz.className = 'dzojstik'; dz.innerHTML = '<i></i><small>hod</small>'; dz.setAttribute('aria-label', 'Džojstik za hod'); document.body.appendChild(dz);
  const pal = dz.firstElementChild; let dzId = null, dzC = null;
  const pomeriPal = (x, z) => { pal.style.transform = `translate(${x * 34}px,${z * 34}px)`; };
  dz.addEventListener('pointerdown', ev => { dzId = ev.pointerId; dz.setPointerCapture(dzId); const r = dz.getBoundingClientRect(); dzC = [r.left + r.width / 2, r.top + r.height / 2]; ev.preventDefault(); });
  dz.addEventListener('pointermove', ev => {
    if (ev.pointerId !== dzId) return;
    let x = (ev.clientX - dzC[0]) / 40, z = (ev.clientY - dzC[1]) / 40; const m = Math.hypot(x, z); if (m > 1) { x /= m; z /= m; }
    pomeriPal(x, z); nav.virtualno?.(x, z); probudi();
  });
  const dzKraj = ev => { if (ev.pointerId !== dzId) return; dzId = null; pomeriPal(0, 0); nav.virtualno?.(0, 0); };
  dz.addEventListener('pointerup', dzKraj); dz.addEventListener('pointercancel', dzKraj);

  let trenutniSloj = 0;
  function oznaciMod(m) { for (const k in mod) mod[k].setAttribute('aria-pressed', k === m ? 'true' : 'false'); dz.classList.toggle('on', dodir && m === 'hod'); if (m !== 'hod') nav.virtualno?.(0, 0); }
  function oznaciSloj(i) { trenutniSloj = i; sl.forEach((b, k) => b.setAttribute('aria-pressed', k === i ? 'true' : 'false')); krug.textContent = 'Sloj: ' + imena[SLOJEVI[i]]; krug.title = naslovi[SLOJEVI[i]]; }
  function oznaciRaspored(i) { rs.forEach((b, k) => b.setAttribute('aria-pressed', k === i ? 'true' : 'false')); }
  function spremno() { zavesa.classList.add('off'); setTimeout(() => zavesa.remove(), 600); }
  oznaciMod('tura'); oznaciSloj(0); oznaciRaspored(0);
  const mera = () => document.documentElement.style.setProperty('--traka-h', tr.getBoundingClientRect().height + 'px');
  new ResizeObserver(mera).observe(tr); mera();
  addEventListener('keydown', ev => {
    if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
    const m = /^Digit([4-8])$/.exec(ev.code);
    if (m) { const i = +m[1] - 4; sloj(i); oznaciSloj(i); probudi(); }
    else if (ev.code === 'KeyG') { const cur = rs.findIndex(b => b.getAttribute('aria-pressed') === 'true'); const i = (cur + 1) % rs.length; rasporedFn(i); oznaciRaspored(i); probudi(); }
    else if (ev.code === 'KeyH') hp.click();
  });
  return { oznaciMod, oznaciSloj, oznaciRaspored, spremno };
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
