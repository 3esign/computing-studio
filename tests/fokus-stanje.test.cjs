/* Dve stvari koje je obilazak pravim pregledacem nasao, a nijedan test nije video.

   1) Tab fokusira #atlas-frame — okvir atlasa preko celog prozora — a Chrome
      okviru ne dodeljuje :focus-visible, pa je izmereno outline: none. Korisnik
      tastature je upadao u atlas bez ikakvog znaka gde je. Prsten mora da
      postoji za `iframe:focus` (ne :focus-visible, jer se ne aktivira) i mora
      imati NEGATIVAN outline-offset: kod okvira koji popunjava prozor pozitivan
      pomeraj iscrtava prsten izvan vidnog polja.

   2) Trake filtera na timovi.html drzale su stanje samo u CSS klasi `active`,
      odnosno u `aria-selected` na dugmetu sa implicitnom rolom `button` —
      gde ta oznaka nije podrzana. Citac ekrana nije mogao da zna koji je
      opseg mape ili filter tabele ukljucen.

   Proverava se mehanizam, ne spisak: koliko dugmica u grupi filtera postoji,
   toliko ih mora nositi aria-pressed, a skripta koja menja klasu `active`
   mora u istom koraku menjati i aria-pressed. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const docs = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(docs, f), 'utf8');

test('okvir atlasa ima vidljiv prsten fokusa, i to unutar sebe', () => {
  const css = read('assets/site.css');
  const rule = css.match(/iframe:focus\{([^}]*)\}/);
  assert.ok(rule, 'nema pravila iframe:focus — Chrome okviru ne daje :focus-visible, pa bez njega prstena nema');
  const body = rule[1];
  assert.match(body, /outline:\s*[^;}]*\b(solid|dashed|dotted|auto)\b/, 'iframe:focus mora iscrtati outline');
  const off = body.match(/outline-offset:\s*(-?[\d.]+)px/);
  assert.ok(off, 'iframe:focus mora izjaviti outline-offset');
  assert.ok(Number(off[1]) < 0,
    `outline-offset je ${off[1]}px; kod okvira preko celog prozora pozitivan pomeraj iscrtava prsten izvan ekrana`);
});

test('atlas se i dalje ugradjuje kao okvir sa tim id-om', () => {
  /* Pravilo iznad vredi samo dok okvir postoji; ako se atlas prestane
     ugradjivati, test treba da padne i da se pravilo preispita. */
  assert.match(read('index.html'), /<iframe[^>]*id="atlas-frame"/, 'nema #atlas-frame u index.html');
});

test('svaka grupa filtera na timovi.html izgovara svoje stanje', () => {
  const html = read('timovi.html');
  for (const cls of ['scope-tab', 'tfilter-btn']) {
    const dugmici = [...html.matchAll(new RegExp(`<button[^>]*class="${cls}[^"]*"[^>]*>`, 'g'))].map(m => m[0]);
    assert.ok(dugmici.length >= 2, `nasao sam ${dugmici.length} dugmica klase ${cls}`);
    const sa = dugmici.filter(d => /aria-pressed="(true|false)"/.test(d));
    assert.equal(sa.length, dugmici.length,
      `${cls}: ${dugmici.length} dugmica, a aria-pressed nosi ${sa.length} — stanje filtera ostaje samo u CSS klasi`);
    const upaljeni = dugmici.filter(d => /aria-pressed="true"/.test(d));
    assert.equal(upaljeni.length, 1, `${cls}: tacno jedno dugme sme biti pritisnuto, nasao sam ${upaljeni.length}`);
    /* Oznaka upaljenog dugmeta mora stajati na istom dugmetu kao klasa active. */
    const active = dugmici.filter(d => /class="[^"]*\bactive\b/.test(d));
    assert.deepEqual(active, upaljeni, `${cls}: klasa active i aria-pressed="true" nisu na istom dugmetu`);
  }
});

test('skripta menja aria-pressed svuda gde menja klasu active', () => {
  const html = read('timovi.html');
  /* aria-selected na dugmetu sa rolom button nije podrzan; ne sme se vratiti. */
  assert.ok(!/class="scope-tab[^"]*"[^>]*aria-selected/.test(html),
    'scope-tab ponovo nosi aria-selected — na implicitnoj roli button ta oznaka ne znaci nista');
  for (const [klasa, znak] of [['scope-tab', 'data-scope'], ['tfilter-btn', 'data-tfilter']]) {
    /* Nadji sve skriptne delove koji diraju klasu active za tu grupu. */
    const dodir = [...html.matchAll(new RegExp(`\\.${klasa}'\\)[\\s\\S]{0,400}?classList\\.(toggle|add|remove)\\('active'`, 'g'))];
    assert.ok(dodir.length >= 1, `skripta ne dira klasu active za .${klasa}`);
    for (const m of dodir) {
      const okolina = html.slice(m.index, m.index + 700);
      assert.match(okolina, /setAttribute\('aria-pressed'/,
        `.${klasa} (${znak}): klasa active se menja bez istovremene izmene aria-pressed`);
    }
  }
});

/* Skip-veza koja ne pomera fokus. Merenje tastaturom (Tab do veze, Enter) na
   svet/poreklo.html, svet/cist.html i svet/bigz-osvrt.html pokazalo je da
   strana skroluje a document.activeElement ostaje BODY: cilj nije fokusabilan.
   U Chrome-u sledeci Tab ipak nastavi od cilja, pa kvar prolazi neopazeno, ali
   citac ekrana ne izgovori gde je korisnik stigao, a drugi pregledaci vracaju
   Tab na pocetak strane. #main i #record na ovom sajtu to resavaju tabindex="-1";
   test trazi isto od svakog cilja svake skip-veze. */
test('cilj svake skip-veze moze da primi fokus', () => {
  const SKIP_DIR = new Set(['dokazi', 'tests', 'node_modules']);
  const strane = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIR.has(e.name) || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) strane(p, out); else if (e.name.endsWith('.html')) out.push(p);
    }
    return out;
  };
  const kvarovi = [];
  let proveno = 0;
  for (const f of strane(docs)) {
    const html = fs.readFileSync(f, 'utf8');
    const rel = path.relative(docs, f).split(path.sep).join('/');
    for (const m of html.matchAll(/<a[^>]*class="[^"]*\bskip\b[^"]*"[^>]*href="#([^"]+)"[^>]*>/g)) {
      const id = m[1];
      proveno++;
      /* Id-ovi na ovom sajtu su obicni slugovi; sve van toga je samo po sebi
         nalaz, pa se ne pokusava izbegavanje specijalnih znakova u regexu. */
      if (!/^[A-Za-z][\w-]*$/.test(id)) { kvarovi.push(rel + ': skip vodi na #' + id + ' — neobican id'); continue; }
      const cilj = html.match(new RegExp('<([a-z0-9]+)((?:[^>]*?)[ ]id="' + id + '")([^>]*)>', 'i'));
      if (!cilj) { kvarovi.push(rel + ': skip vodi na #' + id + ', tog id-a nema u strani'); continue; }
      const atributi = cilj[2] + cilj[3];
      /* Prirodno fokusabilan element sme biti cilj i bez tabindex-a. */
      const samFokusabilan = /^(a|button|input|select|textarea|iframe|summary)$/i.test(cilj[1]);
      if (!/\stabindex=/.test(atributi) && !samFokusabilan) {
        kvarovi.push(rel + ': cilj #' + id + ' (<' + cilj[1].toLowerCase() + '>) nema tabindex="-1", pa Enter na skip-vezi samo skroluje');
      }
    }
  }
  assert.ok(proveno >= 5, 'nasao sam samo ' + proveno + ' skip-veza — trazenje je verovatno pokvareno');
  assert.deepEqual(kvarovi, [], '\n' + kvarovi.join('\n'));
});
