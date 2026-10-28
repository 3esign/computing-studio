/* Veze koje vode nikuda. Dve su stvarno bile mrtve a nijedan test ih nije video:
   pasos.html je vodio na index.html#assignment (tog id-a nema nigde), a
   bigz-osvrt.html na svet/index.html#bigz, dok atlas hash cita kao niz
   parametara (world=bigz) — kotva #bigz je bila bez ikakvog dejstva.

   Zato se ne proverava spisak dozvoljenih kotvi nego mehanizam:
   1) obicna kotva (#nesto) mora imati taj id/name u ciljnoj strani, ili u
      podatku/skripti koju ta strana sama ucitava (strane se grade iz JSON-a);
   2) rutna kotva (#ime=vrednost) je legitimna samo ako skripta ciljne strane
      zaista cita taj parametar (p.get('ime') / searchParams.get('ime'));
   3) svaka strana mora imati rel="icon" — bez njega pregledac trazi
      /favicon.ico kog u docs/ nema, pa svako otvaranje nosi 404.
   Spoljne veze (http, mailto) i javascript: href-ovi nisu predmet ovog testa. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const docs = path.join(__dirname, '..');
const SKIP = new Set(['dokazi', 'tests', 'node_modules']);

function pages(dir = docs, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) pages(p, out); else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const read = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };

/* Sve sto strana nosi u sebi plus sve sto sama ucitava: <script src>, <link href>
   na JSON/JS i svaki fetch('...') u svojim skriptama. Jedan nivo je dovoljan:
   podaci su u fajlu koji skripta trazi po imenu. */
function corpus(file) {
  const html = read(file), dir = path.dirname(file);
  let text = html;
  const refs = new Set();
  for (const m of html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|mjs|json))(?:\?[^"']*)?["']/g)) refs.add(m[1]);
  for (const r of Array.from(refs)) {
    const f = path.resolve(dir, r);
    const body = read(f);
    text += body;
    for (const m of body.matchAll(/fetch\(\s*['"`]([^'"`]+\.(?:json|jsonl))['"`]/g))
      text += read(path.resolve(path.dirname(f), m[1]));
  }
  return text;
}
function scripts(file) {
  const html = read(file), dir = path.dirname(file);
  let text = html.replace(/<script[^>]*src=[^>]*>/g, '');
  for (const m of html.matchAll(/src=["']([^"']+\.(?:js|mjs))(?:\?[^"']*)?["']/g))
    text += read(path.resolve(dir, m[1]));
  return text;
}
function target(from, url) {
  const pa = url.split('#')[0].split('?')[0];
  if (!pa) return from;
  let f = pa.startsWith('/') ? path.join(docs, pa) : path.resolve(path.dirname(from), pa);
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch {}
  return f;
}

const all = pages();

test('svaka obicna kotva ima svoj id — u ciljnoj strani ili u podatku koji ta strana ucitava', () => {
  const dead = [];
  for (const p of all) {
    for (const m of read(p).matchAll(/href=["']([^"']*#[^"']+)["']/g)) {
      const url = m[1];
      const hash = decodeURIComponent(url.slice(url.indexOf('#') + 1));
      if (!hash || hash.includes('=') || hash.includes('${')) continue;
      const t = target(p, url);
      if (!t.endsWith('.html') || !fs.existsSync(t)) continue;
      const text = corpus(t);
      const q = hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      /* Samo oblik koji stvarno pravi kotvu: atribut id/name u strani, ili
         "id": "..." u podatku iz kog se strana gradi. Golo pominjanje reci
         nije dokaz — "bigz" se u atlas.js javlja desetak puta, a kotve nema. */
      const found = new RegExp('(?:id|name)\\s*=\\s*["\']' + q + '["\']').test(text)
        || new RegExp('"id"\\s*:\\s*"' + q + '"').test(text);
      if (found) continue;
      /* Strana koja hash cita kao niz parametara (atlas) ne zna sta je gola
         kotva: #bigz je tamo bio parametar bez vrednosti, bez ikakvog dejstva. */
      dead.push(path.relative(docs, p).split(path.sep).join('/') + ' -> ' + url +
        (/URLSearchParams\(\s*location\.hash/.test(scripts(t))
          ? ' (ciljna strana cita hash kao parametre, gola kotva nema dejstvo)' : ''));
    }
  }
  assert.deepEqual(dead, [], 'kotva bez cilja: ' + dead.join(', '));
});

test('svaka rutna kotva (#ime=vrednost) imenuje parametar koji skripta ciljne strane zaista cita', () => {
  const dead = [];
  for (const p of all) {
    for (const m of read(p).matchAll(/href=["']([^"']*#[^"']+)["']/g)) {
      const url = m[1];
      const hash = decodeURIComponent(url.slice(url.indexOf('#') + 1));
      if (!hash.includes('=') || hash.includes('${')) continue;
      const t = target(p, url);
      if (!t.endsWith('.html') || !fs.existsSync(t)) continue;
      const code = scripts(t);
      for (const pair of hash.split('&')) {
        const key = pair.split('=')[0];
        if (!key) continue;
        if (!new RegExp("get\\(\\s*['\"]" + key + "['\"]").test(code))
          dead.push(path.relative(docs, p).split(path.sep).join('/') + ' -> ' + url + ' (parametar ' + key + ' se ne cita)');
      }
    }
  }
  assert.deepEqual(dead, [], 'rutna kotva bez dejstva: ' + dead.join(', '));
});

test('nijedna strana ne trazi /favicon.ico — svaka sama imenuje svoju ikonu, i ikona postoji', () => {
  const missing = [], broken = [];
  for (const p of all) {
    const html = read(p);
    const m = html.match(/rel=["']icon["'][^>]*href=["']([^"']+)["']/);
    if (!m) { missing.push(path.relative(docs, p).split(path.sep).join('/')); continue; }
    const f = path.resolve(path.dirname(p), m[1].split('?')[0]);
    if (!fs.existsSync(f)) broken.push(path.relative(docs, p).split(path.sep).join('/') + ' -> ' + m[1]);
  }
  assert.deepEqual(missing, [], 'strana bez rel="icon": ' + missing.join(', '));
  assert.deepEqual(broken, [], 'ikona ne postoji: ' + broken.join(', '));
});

test('u atlasu preskakanje na pretragu ne upisuje kotvu u hash — izbor ostaje', () => {
  const js = fs.readFileSync(path.join(docs, 'svet/atlas.js'), 'utf8');
  const html = fs.readFileSync(path.join(docs, 'svet/index.html'), 'utf8');
  const skip = html.match(/<a class="skip" href="#([^"]+)"/);
  assert.ok(skip, 'atlas nema skip vezu');
  assert.ok(html.includes('id="' + skip[1] + '"'), 'skip vodi na id kog nema: #' + skip[1]);
  assert.match(js, /a\.skip['"]\)\?\.addEventListener\('click'/, 'skip klik se ne presretne, pa hash (stanje atlasa) biva prepisan');
  assert.match(js, /preventDefault\(\)/, 'skip klik se ne zaustavlja');
});
