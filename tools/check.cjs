// Zapor sajta: svaka strana je validan UTF-8 bez BOM-a, svaki <script> blok se parsira,
// svaka lokalna veza i svaki id na koji se JS poziva postoje, i dokaz.js prolazi u node-u.
// Pokretanje: node dokazi/sajt_zapor.js   (izlazni kod 1 = nesto je palo)
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;

function ok(c, naziv, det) {
  if (c) { pass++; console.log('PASS | ' + naziv + (det ? ' | ' + det : '')); }
  else { fail++; console.log('FAIL | ' + naziv + (det ? ' | ' + det : '')); }
}
function fajlovi(dir, ext) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.name.startsWith('.')) continue;
    if (e.isDirectory()) out = out.concat(fajlovi(p, ext));
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

const html = fajlovi(ROOT, '.html');
ok(html.length >= 5, 'sajt ima najmanje 5 strana', html.length + ' HTML fajlova');

for (const f of html) {
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  const b = fs.readFileSync(f);
  const s = b.toString('utf8');
  ok(Buffer.compare(Buffer.from(s, 'utf8'), b) === 0 && b[0] !== 0xEF, 'UTF-8 bez BOM: ' + rel);
  ok(/<meta charset="utf-8">/i.test(s), 'deklarisan charset: ' + rel);
  ok(!/Ã[-¿]|â|Å¾/.test(s), 'bez mojibake: ' + rel);
  ok(/<html lang="(?:sr-Latn|en)">/.test(s), 'deklarisan jezik: ' + rel);
  ok(/<title\b[^>]*>[^<]+<\/title>/.test(s), 'ima naslov: ' + rel);

  // 1) svaki inline <script> se parsira
  const skripte = [...s.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  skripte.forEach((kod, i) => {
    let greska = null;
    try { new vm.Script(kod, { filename: rel + ' <script ' + (i + 1) + '>' }); } catch (e) { greska = e.message; }
    ok(!greska, 'parsira se skripta ' + (i + 1) + ': ' + rel, greska || '');
  });

  // 2) svaka lokalna veza pokazuje na postojeci fajl
  const veze = [...s.matchAll(/(?:href|src)="([^"#:]+)"/g)].map(m => m[1])
    .filter(v => !/^(https?:|mailto:)/.test(v));
  for (const v of veze) {
    ok(fs.existsSync(path.resolve(path.dirname(f), decodeURIComponent(v.split(/[?#]/)[0]))), 'veza postoji: ' + rel + ' -> ' + v);
  }

  // 3) svaki getElementById u JS-u ima element sa tim id-om u istom fajlu
  const idovi = new Set([...s.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const trazeni = new Set([...s.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]));
  const nema = [...trazeni].filter(x => !idovi.has(x));
  ok(nema.length === 0, 'svi trazeni id-ovi postoje: ' + rel,
     nema.length ? 'nema: ' + nema.join(', ') : trazeni.size + ' id-ova');

  // 4) isto za #selektore
  const qs = new Set([...s.matchAll(/querySelector\('#([^']+)'\)|montiraj\('#([^']+)'/g)].map(m => m[1] || m[2]));
  const nq = [...qs].filter(x => !idovi.has(x));
  ok(nq.length === 0, 'svi #selektori postoje: ' + rel,
     nq.length ? 'nema: ' + nq.join(', ') : qs.size + ' selektora');
}

// 5) dokaz.js: iste provere koje student klikce, pustene u node-u
const D = require(path.join(ROOT, 'js', 'dokaz.js'));
const rez = D.izvrsi(D.sve());
const pali = rez.filter(r => !r.ok);
ok(pali.length === 0, 'dokaz.js: sve provere prolaze',
   (rez.length - pali.length) + '/' + rez.length + (pali.length ? ' | palo: ' + pali.map(p => p.p.id).join(', ') : ''));

// 6) blokovi na koje se lab strane pozivaju imaju barem jednu proveru
for (const n of [1, 2, 3, 5, 6, 7, 8, 9, 10]) {
  ok(D.blok(n).length > 0, 'blok ' + n + ' ima provere', D.blok(n).length);
}

// 7) CSS postoji i nosi promenljive teme
const css = fs.readFileSync(path.join(ROOT, 'css', 'or.css'), 'utf8');
ok(/--bg:/.test(css) && /--acc:/.test(css), 'CSS nosi promenljive teme');
ok(!/https?:\/\//.test(css), 'CSS ne poziva nista sa mreze');

// 8) Pasivan link do izvora nije mrezna zavisnost. Provera direktnih URL atributa.
function spoljniResursi(s) {
  const out=[];
  for(const tag of s.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi)) {
    for(const attr of tag[2].matchAll(/\b(href|src|srcset|poster|data|background|ping)\s*=\s*(["'])(.*?)\2/gi)) {
      if(tag[1].toLowerCase()==='a' && attr[1].toLowerCase()==='href') continue;
      if(/https?:\/\/|(?:^|\s)\/\//i.test(attr[3])) out.push(attr[3]);
    }
  }
  return out;
}
ok(spoljniResursi('<a href="https://example.org/source">Source</a>').length===0,'pasivan izvorni link je dozvoljen');
for(const fixture of ['<script src="https://x.test/a.js"></script>','<img src="//x.test/a.png">','<link href="https://x.test/a.css">','<iframe src="https://x.test/embed"></iframe>','<video poster="https://x.test/a.jpg"></video>','<a href="https://x.test" ping="https://x.test/track">x</a>'])
  ok(spoljniResursi(fixture).length>0,'spoljni automatski resurs se otkriva: '+fixture);
for (const f of html) {
  const spolja=spoljniResursi(fs.readFileSync(f,'utf8'));
  ok(spolja.length===0,'bez spoljnih resursa: '+path.relative(ROOT,f).split(path.sep).join('/'),spolja.join(', '));
}
// Ovaj staticki test nije potpuna analiza JavaScript mreznih poziva; novi demo proverava se i u browseru.

console.log('\nREZULTAT (zapor sajta): ' + pass + ' PASS, ' + fail + ' FAIL, ukupno ' + (pass + fail));
process.exit(fail ? 1 : 0);
