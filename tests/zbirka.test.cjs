/* Zbirka „Van Beograda“ i — šire — pravilo da sajt ne sme da tvrdi broj koji
   podaci ne potvrđuju.

   Povod: šest objekata van Beograda nemaju lat/lng (locationStatus:'unmapped'),
   pa u beogradskoj sceni nikad nisu ni postojali. Jedini trag o njima bio je
   jedna stavka u <select> obuhvata, koji je u ugrađenom atlasu sakriven CSS-om
   (`.embedded .sidebar{display:none}`) — na naslovnoj strani ih praktično nije
   bilo. U isto vreme je timovi.html nosio broj „6“ otkucan u HTML-u: tačan dok
   se ne promeni, a niko ga ne proverava.

   Zato se ovde ne proverava spisak nego mehanizam:
   1) zbirka u atlas.json gradi se iz timova — broj, gradovi i koordinate;
   2) nijedan broj otkucan u HTML-u uz ime jednog od poznatih skupova ne sme da
      se razilazi sa podacima; za brojeve koji se mogu citati dvosmisleno trazi
      se jace — da ih uopste ne pise ruka, nego generator izmedju markera;
   3) ulaz u zbirku mora stvarno postojati u ugrađenom atlasu — dakle izvan
      `.sidebar`, koji embed sakriva;
   4) kod zbirke ne sme da nosi otkucan broj: brojevi se čitaju iz podataka.

   Ponašanje u pregledaču (klik, karta, fokus, adresa) meri
   data/sessions/.../zivo-vanbg.cjs — ovaj test čuva ugovor, ne izgled. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');

const docs = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(docs, f), 'utf8');
const atlas = JSON.parse(read('svet/data/atlas.json'));
const teams = atlas.teams;
const outside = teams.filter(t => t.city && t.city !== 'Beograd');

test('zbirka van Beograda postoji u podacima i gradi se iz timova', () => {
  const r = atlas.regions?.outsideBelgrade;
  assert.ok(r, 'atlas.json nema regions.outsideBelgrade');
  assert.equal(r.count, outside.length);
  assert.equal(r.entries.length, outside.length);
  assert.deepEqual(
    r.entries.map(e => e.id).sort(),
    outside.map(t => t.id).sort(),
    'zbirka i timovi van Beograda nisu isti skup');
  assert.equal(r.cities, new Set(outside.map(t => t.city)).size);
});

test('svaki objekat zbirke nosi koordinatu, daljinu i svoje stanje', () => {
  const r = atlas.regions.outsideBelgrade;
  assert.equal(r.coordinateBasis, 'city-centre',
    'osnova koordinate mora biti izgovorena: to su centri gradova, ne objekti');
  for (const e of r.entries) {
    const t = teams.find(t => t.id === e.id);
    assert.equal(e.city, t.city, e.id + ': grad u zbirci nije grad tima');
    assert.equal(e.object, t.object, e.id + ': naziv objekta se razišao');
    assert.equal(e.claimsCount, t.claimsCount, e.id + ': broj zapisa se razišao');
    assert.ok(Number.isFinite(e.lat) && Number.isFinite(e.lng), e.id + ': nema koordinatu');
    assert.ok(e.km > 0 && e.km < 1000, e.id + ': daljina nije izmerena (' + e.km + ')');
    /* Koordinata je grada, ne objekta — zato tim i dalje nema tačku u sceni.
       Ako bi se to promenilo, scena bi morala da je stvarno nacrta. */
    assert.equal(t.locationStatus, 'unmapped', e.id + ': tim tvrdi lokaciju koju scena nema');
    assert.equal(t.lat, null, e.id + ': tim nosi lat, a scena ga ne crta');
  }
});

/* Skupovi koje sajt sme da broji naglas. Svaki je izveden iz podataka — ako se
   doda novi, broj u HTML-u odmah dobija proveru. */
const SKUPOVI = [
  /* Jednoznačno imenovan skup: „Van Beograda (6)“ ne može da znači ništa drugo.
     „Beograd (N)“ se namerno ne broji ovde — na istoj strani N je čas broj
     timova (64), čas broj tačaka na mapi (46); tu dvosmislenost rešava
     provera ispod, koja traži da te brojeve uopšte ne piše ruka. */
  { imena: ['Van Beograda', 'Beyond Belgrade'], broj: () => outside.length },
];

function strane(dir = docs, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['tests', 'dokazi', 'node_modules'].includes(e.name) || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) strane(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

test('nijedan otkucan broj uz ime skupa ne protivreči podacima', () => {
  const nalazi = [];
  let videno = 0;
  for (const f of strane()) {
    const html = fs.readFileSync(f, 'utf8');
    for (const s of SKUPOVI) {
      for (const ime of s.imena) {
        /* „Van Beograda (6)“, „Van Beograda · 6“, „Van Beograda 6“ — broj koji
           stoji odmah uz ime skupa tvrdi veličinu tog skupa. */
        const re = new RegExp(ime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(?:\\(|·\\s*|&middot;\\s*)?(\\d+)\\)?', 'g');
        for (const m of html.matchAll(re)) {
          videno++;
          if (+m[1] !== s.broj()) {
            nalazi.push(path.relative(docs, f) + ': "' + m[0].trim() + '" a u podacima ' + s.broj());
          }
        }
      }
    }
  }
  assert.ok(videno > 0, 'test ne vidi nijedan brojani skup — regex je prestao da hvata');
  assert.deepEqual(nalazi, [], 'brojevi u HTML-u se razilaze sa podacima:\n' + nalazi.join('\n'));
});

test('brojeve opsega i filtera upisuje generator, ne ruka', () => {
  const html = read('timovi.html');
  const gen = fs.readFileSync(path.join(docs, '..', 'tools', 'team-pages.cjs'), 'utf8');
  /* Povod: `/*MAPDATA*'+'/` je bio placeholder koji se popuni jednom i nestane, pa je
     mapa registra godinama bila zaseban, stariji skup podataka od atlasa —
     50 tačaka prema 51 objektu i 55 timova na drugim koordinatama. */
  for (const tag of ['MAPDATA', 'SCOPES', 'TFILTERS', 'STATS', 'SIDECARDS']) {
    assert.ok(html.includes('<!--' + tag + '-->') && html.includes('<!--/' + tag + '-->'),
      'timovi.html nema marker ' + tag + ' — generisani deo se ne bi obnovio');
    assert.match(gen, new RegExp("between\\('" + tag + "'"),
      'generator ne upisuje ' + tag + ' — marker bi ostao prazan ili zamrznut');
  }
  assert.ok(!gen.includes('/*MAPDATA*' + '/'),
    'generator se i dalje oslanja na placeholder koji nestane posle prve gradnje');
});

test('HTML komentar unutar <script> ne sme da pojede kod', () => {
  const nalazi = [];
  for (const file of strane()) {
    const html = fs.readFileSync(file, 'utf8');
    for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
      const telo = m[1];
      telo.split('\n').forEach((red, i) => {
        const k = red.indexOf('<!--');
        if (k < 0) return;
        /* `<!--` je u JS-u linijski komentar: sve do kraja reda nestaje. Dozvoljen
           je samo ako je red ionako komentar (`//<!--TAG-->`) ili ako posle njega
           u tom redu nema koda. */
        const pre = red.slice(0, k).trim();
        const posle = red.slice(k).replace(/<!--[^>]*-->/, '').trim();
        if (pre.startsWith('//') || pre.startsWith('/*')) return;
        if (pre === '' && posle === '') return;
        nalazi.push(path.relative(docs, file) + ':' + (i + 1) + ' -> ' + red.trim().slice(0, 90));
      });
    }
  }
  assert.deepEqual(nalazi, [], 'HTML komentar gasi kod u skripti:\n' + nalazi.join('\n'));
});

test('mapa registra i atlas crtaju iste koordinate', () => {
  const html = read('timovi.html');
  const DATA = JSON.parse(html.match(/var DATA=(\[\[[\s\S]*?\]\]);/)[1]);
  const poTimu = new Map(teams.map(t => [t.id, t]));
  const regija = new Map((atlas.regions?.outsideBelgrade?.entries || []).map(e => [e.id, e]));
  const razlike = [];
  for (const [, lat, lng, ids] of DATA) {
    for (const id of ids) {
      const t = poTimu.get(id);
      assert.ok(t, 'mapa nosi tim kog nema u podacima: ' + id);
      /* Beogradski objekti nose svoju koordinatu; objekti van Beograda je nemaju,
         pa im je tačka centar grada iz registra zbirke — i to su jedina dva izvora. */
      const izvor = t.lat != null ? t : regija.get(id);
      assert.ok(izvor, id + ': tačka na mapi nema izvor ni u timu ni u zbirci');
      if (izvor.lat !== lat || izvor.lng !== lng) razlike.push(id + ': mapa ' + lat + ',' + lng + ' a podaci ' + izvor.lat + ',' + izvor.lng);
    }
  }
  assert.ok(DATA.length > 40, 'mapa je ostala skoro prazna — generator je verovatno prestao da je puni');
  assert.deepEqual(razlike, [], 'mapa i atlas se razilaze:\n' + razlike.join('\n'));
  const naMapi = new Set(DATA.flatMap(r => r[3]));
  const nedostaju = teams.filter(t => (t.lat != null || regija.has(t.id)) && !naMapi.has(t.id)).map(t => t.id);
  assert.deepEqual(nedostaju, [], 'timovi koji imaju lokaciju a nisu na mapi: ' + nedostaju.join(', '));
});

test('ulaz u zbirku stoji u ugrađenom atlasu, ne u sakrivenoj bočnoj traci', () => {
  const html = read('svet/index.html');
  const css = read('svet/world.css');
  assert.match(html, /id="open-region"/, 'nema ulazne pločice u atlas');
  assert.match(html, /id="region-dialog"/, 'nema dijaloga zbirke');

  /* Embed sakriva .sidebar. Ulaz mora biti u .scene-tools, koji ostaje vidljiv. */
  assert.match(css, /\.embedded[^{]*\.sidebar[^{]*\{[^}]*display:none/,
    'promenjen embed: ovaj test pretpostavlja da embed i dalje sakriva .sidebar');
  const tools = html.slice(html.indexOf('<div class="scene-tools">'), html.indexOf('<div class="stage">'));
  assert.ok(tools.includes('id="open-region"'),
    'pločica zbirke nije u .scene-tools — u ugrađenom atlasu je ne bi bilo');

  /* Broj se mora čitati iz podataka: prazan je u markup-u, puni ga render(). */
  assert.match(html, /id="region-pill-count"><\/span>/,
    'broj u pločici je otkucan u HTML-u umesto da dođe iz podataka');
});

test('kod zbirke ne nosi otkucan broj ni spisak gradova', () => {
  const js = read('svet/atlas.js');
  const blok = js.slice(js.indexOf('function regionData('), js.indexOf('function archiveGate('));
  assert.ok(blok.length > 500, 'blok zbirke nije nađen u atlas.js');
  for (const city of new Set(outside.map(t => t.city))) {
    assert.ok(!blok.includes("'" + city + "'"), 'grad "' + city + '" je otkucan u kodu zbirke');
  }
  assert.ok(!/\b(count|cities)\s*[:=]\s*\d/.test(blok), 'broj zbirke je otkucan u kodu');
  assert.ok(blok.includes('r.count') && blok.includes('r.entries'),
    'kod zbirke ne čita broj i spisak iz podataka');
});
