/* OBJEKAT 001 — film digitalnog pasoša. / OBJECT 001 — the digital passport film.
   Stari savski most, Beograd, 1942–2025.

   Jedan modul bez zavisnosti, bez DOM-a i bez mreže. Isti modul crta film u
   browseru (index.html u ovoj fascikli), u bezglavom Chrome-u za izvoz u video
   (tools/film_render.cjs) i daje tekst i brojeve kapiji dokaza
   (dokazi/film.test.js). Zato broj na ekranu i broj u pasošu ne mogu da se raziđu.

   One dependency-free module, no DOM, no network. The same module draws the
   film in a browser, in headless Chrome for the video export, and gives its
   text and figures to the proof gate. A figure on screen and a figure in the
   record cannot drift apart.

   Pravila / Rules
   - Svaka rečenica koju film ispisuje nastaje u prepare() iz pasoša, a kadrovi
     je samo crtaju. script() vraća te iste rečenice za titl i prepis.
     Every sentence the film writes is built in prepare() from the record; the
     scenes only draw it. script() returns the same sentences for captions.
   - Determinizam: nijedan kadar ne zove Date, Math.random ni mrežu.
     Determinism: no frame calls Date, Math.random or the network.
   - Kad je ctx.__boxes niz, tx() u njega upisuje okvir svakog teksta, pa izvoz
     može da izmeri preklapanja (tools/film_render.cjs --layout).
     When ctx.__boxes is an array, tx() records every text box into it, so the
     export can measure overlaps. */
(function (root, factory) {
  'use strict';
  var F = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = F;
  else root.PasosFilm = F;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var W = 1920, H = 1080, FPS = 25;
  var X0 = 150, X1 = W - 150;            /* sadržajna kolona / content column */

  var C = {
    paper: '#f5f3eb', ink: '#202329', muted: '#626772', line: '#cfcec7',
    signal: '#244ee8', soft: '#e9edfc', white: '#fffefa', stamp: '#a22523',
    dark: '#16181c', grey: '#d8d5cc', river: '#bccbee', riverInk: '#6f86c2'
  };
  var MONO = 'Consolas, "Cascadia Mono", "Cascadia Code", ui-monospace, monospace';
  var SANS = 'Arial, "Liberation Sans", Helvetica, sans-serif';

  /* Stanje tvrdnje je oblik, ne samo boja. Jedna tabela za ćelije, knjigu stanja i legendu.
     A claim's state is a shape, not only a colour. One table for cells, ledger and legend. */
  var STATUS = {
    confirmed:       { c: C.signal, mark: 'full', sr: 'potvrđeno',       en: 'confirmed' },
    'single-source': { c: C.signal, mark: 'bar',  sr: 'jedan izvor',     en: 'one source' },
    conflicting:     { c: C.stamp,  mark: 'twin', sr: 'izvori u sukobu', en: 'sources conflict' },
    unconfirmed:     { c: C.muted,  mark: 'dash', sr: 'nepotvrđeno',     en: 'unconfirmed' },
    unknown:         { c: C.muted,  mark: 'none', sr: 'nepoznato',       en: 'unknown' }
  };
  var ORDER = ['confirmed', 'single-source', 'conflicting', 'unconfirmed', 'unknown'];
  var EVIDENCE = {
    D: { sr: 'dokument', en: 'document' },
    M: { sr: 'izmereno', en: 'measured' },
    S: { sr: 'sekundarni izvor', en: 'secondary source' },
    O: { sr: 'izjava', en: 'a statement' },
    I: { sr: 'konstruisano za čas', en: 'constructed for class' }
  };
  var LAYERS = [
    { k: 'id', sr: 'Identitet', en: 'Identity' },
    { k: 'geo', sr: 'Geometrija', en: 'Geometry' },
    { k: 'mat', sr: 'Materijal', en: 'Material' },
    { k: 'org', sr: 'Poreklo', en: 'Origin' },
    { k: 'cond', sr: 'Stanje', en: 'Condition' },
    { k: 'use', sr: 'Ponovna upotreba', en: 'Reuse' }
  ];

  /* ---------- kadrovi / scenes ---------- */
  var SCENES = [
    { k: 'blank',     d: 15, sr: 'Ovde je stajao objekat', en: 'An object stood here',
      shows: 'Title; an empty dashed frame where the object stood; the coordinates typed out, with their limit.' },
    { k: 'cover',     d: 15, sr: 'Prazna polja',           en: 'Empty fields',
      shows: 'The passport cover: eighteen empty fields in six layers, 0 answered; the protection initiative and its stamp.' },
    { k: 'city',      d: 21, sr: 'Vreme i grad',           en: 'Time and the city',
      shows: 'A map from verified points only: rivers through bridge coordinates, the 430 m axis; the years count up with sources, then the axis falls away.' },
    { k: 'sources',   d: 21, sr: 'Izvori',                 en: 'Sources',
      shows: 'The sources enter as cards; the eighteen fields fill in record order, each in its state.' },
    { k: 'conflict',  d: 20, sr: 'Sukob izvora',           en: 'Sources in conflict',
      shows: 'Two published spans drawn over each other; span, width and arch mass side by side; a source flag.' },
    { k: 'travel',    d: 21, sr: 'Put',                    en: 'The path',
      shows: 'Dortmund, the Tisa and the Sava at European scale; then Batajnica and the abandoned Veliko Selo plan; the next location as a question.' },
    { k: 'condition', d: 17, sr: 'Masa i stanje',          en: 'Mass and condition',
      shows: 'One square per tonne; the two arch figures; zero tonnes with a public finding; a statement that is not a report.' },
    { k: 'decision',  d: 14, sr: 'Šta pasoš omogućava',    en: 'What the passport makes possible',
      shows: 'Seven conditions for reuse, each in its state; how many a public record meets; an argument, labelled as one.' },
    { k: 'end',       d: 17, sr: 'Nepoznato je zapis',     en: 'Unknown is a record',
      shows: 'The assembled passport, the state counts, the scope and all sources; then the call to make a passport.' }
  ];
  var DURATION = SCENES.reduce(function (a, s) { return a + s.d; }, 0);
  (function () {
    var t = 0;
    SCENES.forEach(function (s, i) { s.i = i; s.t0 = t; t += s.d; s.t1 = t; });
  }());
  function sceneAt(t) {
    for (var i = 0; i < SCENES.length; i++) if (t < SCENES[i].t1 || i === SCENES.length - 1) return SCENES[i];
    return SCENES[0];
  }

  /* ---------- podloga karte / the base map ----------
     Reke se crtaju kao prave linije kroz koordinate mostova i ušća, kako ih daju
     članci Vikipedije (en), provereno 06.10.2026. To nije obala; to je najmanje
     što je provereno. Rivers are drawn as straight lines through the bridge and
     mouth coordinates given by the Wikipedia (en) articles, checked 6 October
     2026. Not a bank; the least that was verified. */
  var ANCHORS = {
    ada:     { lon: 20.42667, lat: 44.79500, sr: 'Most na Adi',     en: 'Ada Bridge',      tag: true },
    gazela:  { lon: 20.44080, lat: 44.80280, sr: 'Gazela',          en: 'Gazela',          tag: true },
    stari:   { lon: 20.44778, lat: 44.81083, sr: 'Stari savski most', en: 'Old Sava Bridge', tag: false },
    branko:  { lon: 20.44833, lat: 44.81472, sr: 'Brankov most',    en: 'Branko’s Bridge', tag: true },
    usce:    { lon: 20.44389, lat: 44.82417, sr: 'ušće Save',       en: 'mouth of the Sava', tag: true },
    pupin:   { lon: 20.38110, lat: 44.86450, sr: 'Pupinov most',    en: 'Pupin Bridge',    tag: true },
    pancevo: { lon: 20.49200, lat: 44.82800, sr: 'Pančevački most', en: 'Pančevo Bridge',  tag: true }
  };
  var RIVERS = {
    sava:  { sr: 'SAVA', en: 'SAVA', pts: ['ada', 'gazela', 'stari', 'branko', 'usce'] },
    dunav: { sr: 'DUNAV', en: 'DANUBE', pts: ['pupin', 'usce', 'pancevo'] }
  };
  var CITY = { lon0: 20.398, lon1: 20.504, lat0: 44.778, lat1: 44.834 };

  /* ---------- jezik i brojevi / language and numbers ---------- */
  var NSR = ['nula', 'jedan', 'dva', 'tri', 'četiri', 'pet', 'šest', 'sedam', 'osam', 'devet', 'deset',
    'jedanaest', 'dvanaest', 'trinaest', 'četrnaest', 'petnaest', 'šesnaest', 'sedamnaest', 'osamnaest', 'devetnaest', 'dvadeset'];
  var NEN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
  function wSr(n) { return n >= 5 && n <= 20 ? NSR[n] : String(n); }
  function wEn(n) { return n >= 0 && n <= 20 ? NEN[n] : String(n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function godina(n) {
    var d = n % 10, dd = n % 100;
    if (d === 1 && dd !== 11) return 'godinu';
    if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'godine';
    return 'godina';
  }
  function fmtSr(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function fmtEn(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function dash(s) { return String(s).replace(/(\d)-(\d)/g, '$1–$2'); }
  /* „A, ali b.“ -> „A. B.“ — ista rečenica iz pasoša, kraća za ekran. / the record's sentence, cut for screen */
  function sentences(s, re) { return String(s).replace(re, function (m, c) { return '. ' + c.toUpperCase(); }); }
  function tags(list) { return list && list.length ? '[' + list.join(' ') + ']' : ''; }
  var MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];
  function dateSr(iso) { var p = iso.split('-'); return p[2] + '.' + p[1] + '.' + p[0] + '.'; }
  function dateEn(iso) { var p = iso.split('-'); return Number(p[2]) + ' ' + MONTHS_EN[Number(p[1]) - 1] + ' ' + p[0]; }

  /* ---------- model: film čita pasoš, ne obrnuto ----------
     The film reads the passport record; the record never reads the film. */
  function prepare(rec) {
    var counts = {}, primary = 0;
    ORDER.forEach(function (k) { counts[k] = 0; });
    var claim = {};
    rec.claims.forEach(function (c) {
      counts[c.st] = (counts[c.st] || 0) + 1;
      if (c.src.some(function (id) { return rec.sources.some(function (s) { return s.id === id && (s.kind === 'D' || s.kind === 'M'); }); })) primary++;
      claim[c.k] = c;
    });
    var byLayer = LAYERS.map(function (l) {
      return { layer: l, claims: rec.claims.filter(function (c) { return c.l === l.k; }) };
    });
    var srcIndex = {};
    rec.sources.forEach(function (s, i) { srcIndex[s.id] = i + 1; });
    var place = {};
    rec.places.forEach(function (p) { place[p.k] = p; });
    function measures(ck, kind) {
      return ((claim[ck] && claim[ck].m) || []).filter(function (m) { return m.k === kind; });
    }
    function val(m, lang) {
      return (m.approx ? '≈' : '') + (lang === 'en' ? fmtEn(m.v) : fmtSr(m.v)) + ' ' + m.u;
    }

    var total = rec.claims.length, nSrc = rec.sources.length;
    var life = rec.object.life.split('-').map(Number);
    var years = life[1] - life[0];
    var mass = measures('kolic', 'mass-total')[0];
    var arch = measures('kolic', 'mass-arch').slice().sort(function (a, b) { return a.v - b.v; });
    var spans = measures('gabarit', 'span'), widths = measures('gabarit', 'width');
    var length = measures('gabarit', 'length')[0];
    var prot = rec.timeline.filter(function (e) { return e.k === 'zastita'; })[0];
    var quote = claim.nosiv && claim.nosiv.quote;
    var nextQ = claim.dozvola && claim.dozvola.quote;
    var proven = ['izvor', 'dokaz', 'nosiv'].every(function (k) { return claim[k] && claim[k].st === 'confirmed'; }) ? mass.v : 0;
    var NEED = [
      { k: 'kolic',   sr: 'masa',                   en: 'mass' },
      { k: 'gabarit', sr: 'geometrija',             en: 'geometry' },
      { k: 'izvor',   sr: 'marka čelika',           en: 'steel grade' },
      { k: 'rastav',  sr: 'spojevi, rastavljivost', en: 'joints, separability' },
      { k: 'nosiv',   sr: 'stanje',                 en: 'condition' },
      { k: 'dokaz',   sr: 'dokaz svojstava',        en: 'proof of properties' },
      { k: 'dozvola', sr: 'dozvola za ugradnju',    en: 'permission to build in' }
    ];
    var met = NEED.filter(function (n) { return claim[n.k].st === 'confirmed'; }).length;
    var unk = counts.unknown;

    var T = {
      blank: {
        title: { sr: 'Kako objekat postaje vidljiv', en: 'How an object becomes visible' },
        box: { sr: 'PASOŠ JOŠ NE POSTOJI', en: 'NO PASSPORT YET' },
        h: { sr: 'Ovde je stajao objekat.', en: 'An object stood here.' },
        coord: rec.object.lat.toFixed(4) + ' N   ' + rec.object.lon.toFixed(4) + ' E   ·   SAVA, BEOGRAD',
        coordNote: rec.object.coordNote,
        p: { sr: 'Postojao je ' + years + ' ' + godina(years) + '. Prelazio ga je ceo grad. Njegov javni zapis je rasut.',
             en: 'It stood for ' + years + ' years. The whole city crossed it. Its public record is scattered.' }
      },
      cover: {
        eyebrow: 'PASOŠ OBJEKTA / OBJECT PASSPORT',
        name: rec.object.name, life: dash(rec.object.life),
        count: { sr: 'odgovorenih polja na početku', en: 'fields answered at the start' },
        p: prot ? {
          sr: prot.y + '  ·  ' + prot.sr + '. Nijedan izvor ne beleži da je zaštita uspostavljena. ' + tags(prot.s),
          en: prot.y + '  ·  ' + prot.en + '. No source records that protection was granted. ' + tags(prot.s)
        } : null,
        stamp: { sr: 'ZAŠTITA NIJE U ZAPISU', en: 'NO PROTECTION ON RECORD' }
      },
      city: {
        legend: [
          { sr: 'reka: prava linija kroz koordinate mostova i ušća (Vikipedija, ' + dateSr(rec.updated) + '), nije obala',
            en: 'river: straight line through bridge and mouth coordinates (Wikipedia), not a bank' },
          { sr: 'osa mosta: ' + (length ? length.v + ' m ' + tags(length.src) : '') + ', položaj orijentacioni',
            en: 'bridge axis: ' + (length ? length.v + ' m' : '') + ', position approximate' }
        ],
        foot: { sr: 'Sada ga nema ni na mapi. Ostalo je samo ono što je o njemu zapisano.',
                en: 'Now it is not on the map either. All that is left is what was recorded about it.' }
      },
      sources: {
        h: { sr: cap(wSr(nSrc)) + ' izvora, ' + wSr(total) + ' pitanja.', en: cap(wEn(nSrc)) + ' sources, ' + wEn(total) + ' questions.' },
        foot: {
          sr: 'Potvrđeno je ' + counts.confirmed + ' od ' + total + ' polja. Nepoznato ostaje ' + unk + '. ' +
              (primary ? 'Dokument ili merenje direktno navodi ' + primary + '.' : 'Nijedno ne navodi izvorni dokument ili merenje.'),
          en: counts.confirmed + ' of ' + total + ' fields are confirmed. ' + unk + ' remain unknown. ' +
              (primary ? primary + ' directly cite a document or measurement.' : 'None directly cites an original document or measurement.')
        }
      },
      conflict: {
        h: { sr: 'Isto pitanje, dva broja.', en: 'The same question, two numbers.' },
        rows: [
          { sr: 'raspon', en: 'span', a: spans[0], b: spans[1] },
          { sr: 'širina', en: 'width', a: widths[0], b: widths[1] },
          { sr: 'masa luka', en: 'arch mass', a: arch[0], b: arch[1] }
        ],
        flag: (claim.gabarit.flags || [])[0] || null,
        stamp: { sr: 'IZVORI U SUKOBU', en: 'SOURCES CONFLICT' },
        foot: { sr: sentences(claim.gabarit.note.sr, /, ali (\S)/) + ' Dok se to ne zapiše, crtež je odluka, ne podatak.',
                en: sentences(claim.gabarit.note.en, /, but (\S)/) + ' Until that is recorded, the drawing is a decision, not data.' }
      },
      travel: {
        h: { sr: 'Put mosta nije završen.', en: 'The bridge’s journey is not finished.' },
        next: { sr: 'Sledeća lokacija nije određena. Ponovna montaža je „' + (nextQ ? nextQ.text : '') + '“. ' + tags(nextQ ? nextQ.src : []),
                en: 'The next location is not determined. Reassembly is “at some location to be determined by the republic bodies and institutions”. ' + tags(nextQ ? nextQ.src : []) },
        note: rec.placeNote
      },
      condition: {
        h: { sr: 'Oko ' + fmtSr(mass.v) + ' t čeka svoj dosije.', en: 'About ' + fmtEn(mass.v) + ' t await their file.' },
        archLine: { sr: 'luk: ' + arch.map(function (m) { return val(m, 'sr') + ' (' + m.by.sr + ') ' + tags(m.src); }).join('  ·  '),
                    en: 'the arch: ' + arch.map(function (m) { return val(m, 'en') + ' (' + m.by.en + ')'; }).join('  ·  ') },
        totalLine: { sr: 'ukupno ' + val(mass, 'sr') + ': ' + mass.by.sr + ' ' + tags(mass.src) + '   ·   1 kvadrat = 1 t',
                     en: 'in total ' + val(mass, 'en') + ': ' + mass.by.en + '   ·   1 square = 1 t' },
        zero: String(proven),
        zeroText: { sr: 'tona sa javnim nalazom o stanju, marki čelika i dokazu svojstava',
                    en: 'tonnes with a public finding on condition, steel grade and proof of properties' },
        quote: quote ? { sr: '„' + cap(quote.text) + '.“', who: quote.who, src: tags(quote.src) } : null,
        stamp: { sr: 'IZJAVA, NE IZVEŠTAJ', en: 'A STATEMENT, NOT A REPORT' }
      },
      decision: {
        h: { sr: 'Da bi ' + fmtSr(mass.v) + ' t ponovo bilo konstrukcija, treba ' + wSr(NEED.length) + ' polja.',
             en: 'For ' + fmtEn(mass.v) + ' t to be structure again, ' + wEn(NEED.length) + ' fields are needed.' },
        need: NEED, met: met,
        metText: { sr: 'uslova je ispunjeno javnim zapisom', en: 'conditions met by a public record' },
        argLabel: 'ARGUMENT, NE IZVOR / AN ARGUMENT, NOT A SOURCE',
        arg: { sr: 'Čelik koji se ne može dokazati nije konstrukcija, nego staro gvožđe. Razlika nije u čeliku, nego u zapisu.',
               en: 'Steel that cannot be proven is not structure, it is scrap. The difference is not in the steel, it is in the record.' }
      },
      end: {
        h: { sr: 'Nepoznato je zapis, ne praznina.', en: 'Unknown is a record, not a blank.' },
        scope: rec.scope,
        sourcesHead: 'IZVORI / SOURCES  ·  ' + dateSr(rec.updated),
        course: 'OSNOVE RAČUNARSTVA / COMPUTING STUDIO',
        call: { sr: 'Napravi pasoš za svoj objekat.', en: 'Make a passport for your object.' },
        url: '3esign.github.io/computing-studio',
        sum: { sr: rec.object.name.sr + '  ·  ' + dash(rec.object.life) + '  ·  ' + total + ' pitanja  ·  ' + nSrc + ' izvora  ·  ' +
                   unk + (unk === 1 ? ' nepoznato polje' : unk >= 2 && unk <= 4 ? ' nepoznata polja' : ' nepoznatih polja'),
               en: rec.object.name.en + '  ·  ' + dash(rec.object.life) + '  ·  ' + total + ' questions  ·  ' + nSrc + ' sources  ·  ' +
                   unk + ' unknown field' + (unk === 1 ? '' : 's') },
        recorded: 'Zapisano ' + dateSr(rec.updated) + ' iz javnih izvora.  /  Recorded on ' + dateEn(rec.updated) + ' from public sources.'
      }
    };

    return {
      rec: rec, counts: counts, total: total, primary: primary, byLayer: byLayer,
      srcIndex: srcIndex, claim: claim, place: place, T: T, years: years
    };
  }

  /* Rečenice filma po scenama, za titl, prepis i kapiju. / The film's sentences per scene. */
  function script(M) {
    var T = M.T;
    var lines = {
      blank: [T.blank.title, T.blank.h, T.blank.p],
      cover: [T.cover.name, { sr: '0 / ' + M.total + ' ' + T.cover.count.sr, en: '0 / ' + M.total + ' ' + T.cover.count.en }].concat(T.cover.p ? [T.cover.p] : []),
      city: [T.city.foot],
      sources: [T.sources.h, T.sources.foot],
      conflict: [T.conflict.h].concat(T.conflict.flag ? [T.conflict.flag] : [], [T.conflict.foot]),
      travel: [T.travel.h, T.travel.next],
      condition: [T.condition.h, { sr: T.condition.zero + ' ' + T.condition.zeroText.sr, en: T.condition.zero + ' ' + T.condition.zeroText.en }],
      decision: [T.decision.h, { sr: T.decision.met + ' / ' + T.decision.need.length + ' ' + T.decision.metText.sr,
                                 en: T.decision.met + ' / ' + T.decision.need.length + ' ' + T.decision.metText.en }, T.decision.arg],
      end: [T.end.h, T.end.call, T.end.sum]
    };
    return SCENES.map(function (s) {
      return { k: s.k, t0: s.t0, t1: s.t1, title: { sr: s.sr, en: s.en }, lines: lines[s.k] };
    });
  }

  /* ---------- vreme i lakoća / time and easing ---------- */
  function cl01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeOut(x) { x = cl01(x); return 1 - Math.pow(1 - x, 3); }
  /* pojavi se u a, traje, nestane do b / appear at a, hold, leave by b */
  function win(t, a, b, fi, fo) {
    fi = fi === undefined ? 0.7 : fi; fo = fo === undefined ? 0.5 : fo;
    if (t < a || t > b) return 0;
    return Math.min(easeOut((t - a) / fi), easeOut((b - t) / fo), 1);
  }
  function lerp(a, b, x) { return a + (b - a) * cl01(x); }
  /* determinističan šum iz celog broja / deterministic noise from an integer */
  function nz(i) { var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }

  /* ---------- pisanje / type ---------- */
  function font(size, weight, mono) { return (weight ? weight + ' ' : '') + Math.round(size) + 'px ' + (mono ? MONO : SANS); }
  function tx(ctx, s, x, y, o) {
    o = o || {};
    s = String(s);
    var size = o.size || 20;
    ctx.save();
    ctx.font = font(size, o.weight, o.mono);
    ctx.fillStyle = o.color || C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    var ls = o.ls || 0, wsum = 0, i, chars = null;
    if (ls) {
      chars = s.split('');
      for (i = 0; i < chars.length; i++) wsum += ctx.measureText(chars[i]).width + ls;
      wsum -= ls;
    } else wsum = ctx.measureText(s).width;
    var x0 = o.align === 'right' ? x - wsum : o.align === 'center' ? x - wsum / 2 : x;
    if (ctx.__boxes && ctx.globalAlpha > 0.06 && s.trim()) {
      var mt = ctx.measureText(s), up = mt.actualBoundingBoxAscent, dn = mt.actualBoundingBoxDescent;
      ctx.__boxes.push({ s: s, x0: x0, x1: x0 + wsum, y0: y - (up === undefined ? size * 0.74 : up), y1: y + (dn === undefined ? size * 0.22 : dn),
                         a: ctx.globalAlpha, layer: o.layer || 0, tr: ctx.getTransform ? ctx.getTransform() : null });
    }
    if (ls) {
      var cx = x0;
      for (i = 0; i < chars.length; i++) { ctx.fillText(chars[i], cx, y); cx += ctx.measureText(chars[i]).width + ls; }
    } else ctx.fillText(s, x0, y);
    ctx.restore();
    return wsum;
  }
  function measure(ctx, s, o) {
    ctx.save(); ctx.font = font(o.size || 20, o.weight, o.mono);
    var w = ctx.measureText(String(s)).width; ctx.restore(); return w;
  }
  function wrap(ctx, s, maxw, o) {
    ctx.save();
    ctx.font = font(o.size || 20, o.weight, o.mono);
    var words = String(s).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      var probe = cur ? cur + ' ' + w : w;
      if (ctx.measureText(probe).width > maxw && cur) { lines.push(cur); cur = w; } else cur = probe;
    });
    if (cur) lines.push(cur);
    ctx.restore();
    return lines;
  }
  /* Jedan red koji staje u širinu; višak postaje „…“. / One line that fits; the rest becomes "…". */
  function fitText(ctx, s, maxw, o) {
    s = String(s);
    if (measure(ctx, s, o) <= maxw) return s;
    while (s.length > 1 && measure(ctx, s + ' …', o) > maxw) s = s.slice(0, -1);
    return s.replace(/\s+$/, '') + ' …';
  }
  /* Pasus: vraća osnovnu liniju poslednjeg reda. / A paragraph: returns the last line's baseline. */
  function para(ctx, s, x, y, maxw, o) {
    var lines = wrap(ctx, s, maxw, o), lh = o.lh || (o.size || 20) * 1.36;
    if (o.max && lines.length > o.max) {
      if (ctx.__boxes) ctx.__boxes.push({ s: s, trunc: true, x0: 0, x1: 0, y0: 0, y1: 0, a: 1, layer: 9 });
      lines = lines.slice(0, o.max);
      lines[o.max - 1] = lines[o.max - 1].replace(/\s*\S*$/, '') + ' …';
    }
    lines.forEach(function (l, i) { tx(ctx, l, x, y + i * lh, o); });
    return y + (lines.length - 1) * lh;
  }
  /* Dvojezični blok: srpski nosi, engleski stoji pod njim. Vraća dno bloka.
     Bilingual block: Serbian carries, English stands under it. Returns the block's bottom. */
  function bi(ctx, sr, en, x, y, maxw, o) {
    o = o || {};
    var s1 = o.size || 46, s2 = o.size2 || Math.max(15, Math.round(s1 * 0.4));
    var last = para(ctx, sr, x, y, maxw, { size: s1, weight: o.weight, color: o.color || C.ink, lh: s1 * 1.12, align: o.align, mono: o.mono });
    var y2 = last + s1 * 0.30 + s2 * 1.25;
    var end = para(ctx, en, x, y2, o.maxw2 || maxw, { size: s2, color: o.color2 || C.muted, lh: s2 * 1.34, align: o.align, mono: o.mono });
    return end + s2 * 0.3;
  }
  /* Zaključna traka na dnu kadra: srpski levo, engleski desno.
     The closing band at the foot of the frame: Serbian left, English right. */
  function foot(ctx, T, a, o) {
    if (a <= 0) return;
    o = o || {};
    ctx.save(); ctx.globalAlpha *= a;
    rect(ctx, X0, 902, X1 - X0, 1.5, { fill: o.rule || C.ink });
    para(ctx, T.sr, X0, 946, 860, { size: 24, color: C.ink, lh: 32, max: 2 });
    para(ctx, T.en, 1070, 946, X1 - 1070, { size: 18, color: C.muted, lh: 25, max: 3 });
    ctx.restore();
  }

  /* ---------- crtački pribor / drawing kit ---------- */
  function rect(ctx, x, y, w, h, o) {
    o = o || {};
    ctx.save();
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fillRect(x, y, w, h); }
    if (o.stroke) {
      ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 1;
      if (o.dash) ctx.setLineDash(o.dash);
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
    ctx.restore();
  }
  function poly(ctx, pts, o) {
    o = o || {};
    ctx.save();
    ctx.strokeStyle = o.stroke || C.ink;
    ctx.lineWidth = o.lw || 1.4;
    ctx.lineJoin = 'round'; ctx.lineCap = o.cap || 'round';
    if (o.dash) ctx.setLineDash(o.dash);
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.beginPath();
    pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.stroke();
    ctx.restore();
  }
  function dot(ctx, x, y, r, o) {
    o = o || {};
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    if (o.stroke) {
      ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 1.4;
      if (o.dash) ctx.setLineDash(o.dash);
      ctx.stroke();
    }
    ctx.restore();
  }
  function check(ctx, x, y, s, col) {
    poly(ctx, [[x - s * 0.5, y], [x - s * 0.15, y + s * 0.38], [x + s * 0.55, y - s * 0.42]], { stroke: col, lw: 3.2 });
  }
  /* Pečat: oznaka klase dokaza, ne ukras. / A stamp: an evidence class mark, not decoration. */
  function stampBox(ctx, x, y, sr, en, o) {
    o = o || {};
    var col = o.color || C.stamp, size = o.size || 26, pad = 18;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.rot === undefined ? -0.028 : o.rot);
    var w1 = measure(ctx, sr, { size: size, weight: '700', mono: true }) + sr.length * 1.5;
    var w2 = measure(ctx, en, { size: size * 0.46, mono: true }) + en.length * 1.1;
    var w = Math.max(w1, w2) + pad * 2, h = size * 2.05;
    rect(ctx, -w / 2, -h / 2, w, h, { stroke: col, lw: 2.6 });
    rect(ctx, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, { stroke: col, lw: 0.8 });
    tx(ctx, sr, 0, -h / 2 + size * 1.08, { size: size, weight: '700', mono: true, color: col, align: 'center', ls: 1.5, layer: 2 });
    tx(ctx, en, 0, h / 2 - size * 0.36, { size: size * 0.46, mono: true, color: col, align: 'center', ls: 1.1, layer: 2 });
    ctx.restore();
    return w;
  }
  /* Znak stanja u kvadratiću (knjiga, legenda). / The state mark in a small square (ledger, legend). */
  function swatch(ctx, x, y, s, st) {
    var S = STATUS[st] || STATUS.unknown;
    if (S.mark === 'full') { rect(ctx, x, y, s, s, { fill: S.c }); return; }
    rect(ctx, x, y, s, s, { fill: C.white, stroke: S.mark === 'none' ? C.muted : S.c, lw: 1.2, dash: S.mark === 'none' || S.mark === 'dash' ? [3, 2] : null });
    marks(ctx, x, y, s, S, s * 0.28);
  }
  function marks(ctx, x, y, h, S, bw) {
    if (S.mark === 'bar') rect(ctx, x, y, bw, h, { fill: S.c });
    else if (S.mark === 'twin') { rect(ctx, x, y, bw * 0.42, h, { fill: S.c }); rect(ctx, x + bw * 0.62, y, bw * 0.42, h, { fill: S.c }); }
    else if (S.mark === 'dash') {
      ctx.save(); ctx.fillStyle = S.c;
      for (var yy = y; yy < y + h; yy += 6) ctx.fillRect(x, yy, bw, Math.min(3, y + h - yy));
      ctx.restore();
    }
  }
  /* Ćelija pasoša. / A passport cell. Returns the text colours to use on it. */
  function cell(ctx, x, y, w, h, claim) {
    var S = STATUS[claim.st] || STATUS.unknown;
    if (S.mark === 'full') {
      rect(ctx, x, y, w, h, { fill: S.c });
      return { ink: C.white, sub: 'rgba(255,255,255,0.78)', x: x + 14 };
    }
    var dashed = S.mark === 'none' || S.mark === 'dash';
    rect(ctx, x, y, w, h, { fill: C.white, stroke: S.mark === 'none' ? C.line : S.c, lw: dashed ? 1 : 1.4, dash: dashed ? [5, 4] : null });
    marks(ctx, x, y, h, S, 8);
    if (S.mark === 'none') tx(ctx, '?', x + w - 12, y + h - 10, { size: 18, mono: true, color: C.muted, align: 'right', layer: 1 });
    return { ink: C.ink, sub: S.mark === 'none' ? C.muted : S.c, x: x + (S.mark === 'none' ? 12 : 18) };
  }

  /* ---------- projekcija / projection ----------
     Ekvirektangularna, skalirana na srednjoj širini okvira; ista jedinica po x i y.
     Equirectangular, scaled at the frame's mid latitude; one unit on x and y. */
  function fit(box, x, y, w, h) {
    var latMid = (box.lat0 + box.lat1) / 2;
    var kx = Math.cos(latMid * Math.PI / 180);
    var dLon = (box.lon1 - box.lon0) * kx, dLat = (box.lat1 - box.lat0);
    var s = Math.min(w / dLon, h / dLat);
    var ox = x + (w - dLon * s) / 2, oy = y + (h - dLat * s) / 2;
    return {
      s: s, kx: kx,
      p: function (lon, lat) { return { x: ox + (lon - box.lon0) * kx * s, y: oy + (box.lat1 - lat) * s }; },
      inv: function (px, py) { return { lon: box.lon0 + (px - ox) / (kx * s), lat: box.lat1 - (py - oy) / s }; },
      km: function () { return s / 111.32; }
    };
  }
  function haversine(a, b) {
    var R = 6371, d = Math.PI / 180;
    var dLat = (b.lat - a.lat) * d, dLon = (b.lon - a.lon) * d;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function clipRect(ctx, x, y, w, h) { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); }
  function graticule(ctx, pr, x, y, w, h, step, digits) {
    var a = pr.inv(x, y + h), b = pr.inv(x + w, y), lo, la;
    ctx.save();
    /* oznake idu uz gornju i desnu ivicu, da dno i levo ostanu za legendu
       labels sit on the top and right edges, so bottom and left stay free for the legend */
    for (lo = Math.ceil(a.lon / step) * step; lo < b.lon; lo += step) {
      var q = pr.p(lo, 0).x;
      poly(ctx, [[q, y], [q, y + h]], { stroke: '#e6e4dc', lw: 1 });
      if (q < x + w - 70) tx(ctx, lo.toFixed(digits) + '°E', q + 5, y + 18, { size: 12, mono: true, color: '#b3b2ab', layer: 1 });
    }
    for (la = Math.ceil(a.lat / step) * step; la < b.lat; la += step) {
      var r = pr.p(0, la).y;
      poly(ctx, [[x, r], [x + w, r]], { stroke: '#e6e4dc', lw: 1 });
      if (r > y + 30) tx(ctx, la.toFixed(digits) + '°N', x + w - 8, r - 6, { size: 12, mono: true, color: '#b3b2ab', align: 'right', layer: 1 });
    }
    ctx.restore();
  }
  function rivers(ctx, pr, lw, labels) {
    Object.keys(RIVERS).forEach(function (k) {
      var pts = RIVERS[k].pts.map(function (a) { var q = pr.p(ANCHORS[a].lon, ANCHORS[a].lat); return [q.x, q.y]; });
      poly(ctx, pts, { stroke: C.river, lw: lw });
    });
    if (!labels) return;
    Object.keys(ANCHORS).forEach(function (k) {
      var A = ANCHORS[k];
      if (!A.tag) return;
      var q = pr.p(A.lon, A.lat);
      dot(ctx, q.x, q.y, 3.2, { fill: C.white, stroke: C.riverInk, lw: 1.2 });
      if (labels[k]) tx(ctx, A.sr, q.x + labels[k][0], q.y + labels[k][1], { size: 13, mono: true, color: C.riverInk, align: labels[k][2] || 'left', layer: 1 });
    });
  }

  /* ---------- luk, nacrtan iz objavljenih brojeva / the arch, drawn from the published figures ---------- */
  function archPath(x0, y0, span, rise, n) {
    var pts = [], i;
    for (i = 0; i <= n; i++) {
      var u = i / n;
      pts.push([x0 + span * u, y0 - rise * Math.sin(Math.PI * u) * (1 - 0.18 * Math.pow(2 * u - 1, 2))]);
    }
    return pts;
  }
  function drawBridge(ctx, x0, y, span, rise, o) {
    o = o || {};
    var col = o.color || C.ink, a = o.grow === undefined ? 1 : cl01(o.grow), N = 64;
    var top = archPath(x0, y, span, rise, N);
    var cut = Math.max(2, Math.round(top.length * a));
    poly(ctx, top.slice(0, cut), { stroke: col, lw: o.lw || 3, dash: o.dash });
    poly(ctx, [[x0, y], [x0 + span * a, y]], { stroke: col, lw: (o.lw || 3) * 0.8, dash: o.dash });
    for (var i = 1; i < 12; i++) {
      var u = i / 12;
      if (u > a) break;
      var p = top[Math.round(u * N)];
      poly(ctx, [[p[0], p[1]], [p[0], y]], { stroke: col, lw: 1, dash: o.dash });
    }
    if (o.lattice) {
      for (var j = 0; j < N; j += 2) {
        if (j / N > a) break;
        var q = top[j], r = top[Math.min(N, j + 2)];
        poly(ctx, [[q[0], q[1] + 9], [r[0], r[1]]], { stroke: col, lw: 0.7 });
      }
      poly(ctx, top.slice(0, cut).map(function (p) { return [p[0], p[1] + 9]; }), { stroke: col, lw: 1 });
    }
  }
  function dimension(ctx, x1, x2, y, label, o) {
    o = o || {};
    var col = o.color || C.muted;
    poly(ctx, [[x1, y], [x2, y]], { stroke: col, lw: 1 });
    poly(ctx, [[x1, y - 7], [x1, y + 7]], { stroke: col, lw: 1 });
    poly(ctx, [[x2, y - 7], [x2, y + 7]], { stroke: col, lw: 1 });
    if (label) tx(ctx, label, (x1 + x2) / 2, y - 12, { size: o.size || 20, mono: true, color: col, align: 'center' });
  }

  /* ---------- okvir filma / the film frame ---------- */
  function timecode(t) {
    var f = Math.round(t * FPS), s = Math.floor(f / FPS), m = Math.floor(s / 60);
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return p2(m) + ':' + p2(s % 60) + ':' + p2(f % FPS);
  }
  function chrome(ctx, t, M) {
    var sc = sceneAt(t), i, x, y;
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.fillStyle = 'rgba(32,35,41,0.055)';
    for (x = 48; x < W; x += 48) for (y = 48; y < H; y += 48) ctx.fillRect(x, y, 1, 1);
    ctx.restore();
    rect(ctx, 56, 56, W - 112, H - 112, { stroke: C.line, lw: 1 });
    [[56, 56], [W - 56, 56], [56, H - 56], [W - 56, H - 56]].forEach(function (p) {
      poly(ctx, [[p[0] - 9, p[1]], [p[0] + 9, p[1]]], { stroke: C.signal, lw: 1 });
      poly(ctx, [[p[0], p[1] - 9], [p[0], p[1] + 9]], { stroke: C.signal, lw: 1 });
    });
    tx(ctx, 'OBJEKAT 001 / OBJECT 001', 88, 40, { size: 15, mono: true, color: C.ink, ls: 2.4, layer: 3 });
    tx(ctx, 'DIGITALNI PASOŠ / DIGITAL PASSPORT', W - 88, 40, { size: 15, mono: true, color: C.muted, ls: 2.4, align: 'right', layer: 3 });
    var num = (sc.i + 1 < 10 ? '0' : '') + (sc.i + 1) + ' / ' + SCENES.length;
    var nw = tx(ctx, num, 88, H - 30, { size: 15, mono: true, color: C.signal, ls: 2, layer: 3 });
    tx(ctx, sc.sr + '  ·  ' + sc.en, 88 + nw + 24, H - 30, { size: 15, mono: true, color: C.muted, ls: 0.6, layer: 3 });
    tx(ctx, timecode(t), W - 88, H - 30, { size: 15, mono: true, color: C.muted, align: 'right', ls: 2, layer: 3 });
    /* knjiga stanja: brojevi dolaze iz pasoša / the ledger: figures come from the record */
    if (sc.i >= 3 && sc.i < SCENES.length - 1) {
      var a = win(t, sc.t0 + 0.4, DURATION, 1, 0.01);
      var cx = X1;
      ctx.save(); ctx.globalAlpha *= a;
      for (i = ORDER.length - 1; i >= 0; i--) {
        var st = STATUS[ORDER[i]], n = M.counts[ORDER[i]] || 0;
        var label = n + ' ' + st.sr;
        var w = measure(ctx, label, { size: 15, mono: true }) + 40;
        rect(ctx, cx - w, 76, w, 32, { fill: 'rgba(255,254,250,0.6)', stroke: st.mark === 'none' || st.mark === 'dash' ? C.line : st.c, lw: 1, dash: st.mark === 'none' || st.mark === 'dash' ? [4, 3] : null });
        swatch(ctx, cx - w + 10, 85, 14, ORDER[i]);
        tx(ctx, label, cx - w + 31, 97, { size: 15, mono: true, color: C.ink, layer: 3 });
        cx -= w + 10;
      }
      ctx.restore();
    }
  }

  /* ================= KADROVI / SCENES ================= */

  /* 01 — Naslov, pa prazno mesto. / The title, then an empty place. */
  function scBlank(ctx, lt, M) {
    var T = M.T.blank, cxp = W / 2;
    /* naslov stoji od prvog kadra, jer prvi kadar videa postaje njegova sličica
       the title holds from the first frame, because a video's first frame becomes its thumbnail */
    var a0 = win(lt, -1, 4.0, 0.001, 0.8);
    if (a0 > 0) {
      ctx.save(); ctx.globalAlpha *= a0;
      tx(ctx, 'OBJEKAT 001  ·  ' + M.rec.object.name.sr.toUpperCase(), cxp, 430, { size: 18, mono: true, color: C.signal, align: 'center', ls: 4 });
      bi(ctx, T.title.sr, T.title.en, cxp, 530, 1500, { size: 72, size2: 30, align: 'center' });
      ctx.restore();
    }
    var cyp = 380;
    var a = win(lt, 4.2, 15, 1.4, 0.6);
    if (a > 0) {
      ctx.save(); ctx.globalAlpha *= a;
      var bw = 980, bh = 280, grow = easeOut(cl01((lt - 4.4) / 2.2));
      ctx.save();
      ctx.setLineDash([12, 9]);
      ctx.lineDashOffset = -lt * 9;
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1.4;
      ctx.strokeRect(cxp - bw / 2 * grow, cyp - bh / 2 * grow, bw * grow, bh * grow);
      ctx.restore();
      tx(ctx, 'OBJEKAT / OBJECT', cxp, cyp - 10, { size: 19, mono: true, color: '#b9b8b1', align: 'center', ls: 6 });
      tx(ctx, T.box.sr + ' / ' + T.box.en, cxp, cyp + 26, { size: 19, mono: true, color: '#b9b8b1', align: 'center', ls: 6 });
      ctx.restore();
    }
    var a2 = win(lt, 6.0, 15, 1.2, 0.6);
    if (a2 > 0) {
      ctx.save(); ctx.globalAlpha *= a2;
      bi(ctx, T.h.sr, T.h.en, X0, 660, 1300, { size: 86, size2: 30 });
      ctx.restore();
    }
    var a3 = win(lt, 8.0, 15, 1.0, 0.6);
    if (a3 > 0) {
      ctx.save(); ctx.globalAlpha *= a3;
      var typed = Math.round(lerp(0, 1, (lt - 8.1) / 2.0) * T.coord.length);
      tx(ctx, T.coord.slice(0, typed), X0, 806, { size: 24, mono: true, color: C.signal, ls: 2 });
      tx(ctx, T.coordNote.sr + '  /  ' + T.coordNote.en, X0, 838, { size: 14, mono: true, color: C.muted, alpha: cl01((lt - 9.6) / 0.8) });
      ctx.restore();
    }
    foot(ctx, T.p, win(lt, 10.4, 15, 1.0, 0.6), { rule: C.line });
  }

  /* 02 — Osamnaest praznih polja i pečat koji nije stavljen.
     Eighteen empty fields, and the stamp that was never applied. */
  function scCover(ctx, lt, M) {
    var T = M.T.cover;
    var a = win(lt, 0.3, 15, 1.1, 0.6);
    ctx.save(); ctx.globalAlpha *= a;
    tx(ctx, T.eyebrow, X0, 196, { size: 17, mono: true, color: C.muted, ls: 4 });
    var b = bi(ctx, T.name.sr, T.name.en, X0, 284, 1100, { size: 72, size2: 28 });
    tx(ctx, T.life, X0, b + 58, { size: 40, mono: true, color: C.signal, ls: 4 });
    ctx.restore();

    var gx = X0, gy = 460, cw = 150, ch = 52, gap = 12, lx = 490;
    M.byLayer.forEach(function (row, li) {
      var ay = win(lt, 2.0 + li * 0.32, 15, 0.8, 0.5);
      if (ay <= 0) return;
      ctx.save(); ctx.globalAlpha *= ay;
      var y = gy + li * (ch + gap);
      tx(ctx, row.layer.sr.toUpperCase(), gx, y + 22, { size: 15, mono: true, color: C.ink, ls: 2 });
      tx(ctx, row.layer.en.toUpperCase(), gx, y + 42, { size: 12, mono: true, color: C.muted, ls: 2 });
      row.claims.forEach(function (c, ci) {
        var x = lx + ci * (cw + gap), n = li * 3 + ci + 1;
        rect(ctx, x, y, cw, ch, { fill: C.white, stroke: C.line, lw: 1, dash: [5, 4] });
        tx(ctx, (n < 10 ? '0' : '') + n, x + 10, y + 22, { size: 15, mono: true, color: '#b9b8b1' });
        tx(ctx, '?', x + cw - 12, y + ch - 12, { size: 20, mono: true, color: '#b9b8b1', align: 'right', layer: 1 });
      });
      ctx.restore();
    });

    var a2 = win(lt, 4.8, 15, 1.1, 0.6);
    if (a2 > 0) {
      ctx.save(); ctx.globalAlpha *= a2;
      var zx = 1210;
      var zw = tx(ctx, '0', zx, 690, { size: 230, mono: true, color: C.ink });
      tx(ctx, '/ ' + M.total, zx + zw + 22, 690, { size: 76, mono: true, color: C.muted });
      tx(ctx, T.count.sr, zx + 6, 742, { size: 22, color: C.ink });
      tx(ctx, T.count.en, zx + 6, 772, { size: 17, color: C.muted });
      ctx.restore();
    }
    if (T.p) {
      var a3 = win(lt, 8.0, 15, 1.0, 0.6);
      if (a3 > 0) {
        ctx.save(); ctx.globalAlpha *= a3;
        stampBox(ctx, 1520, 846, T.stamp.sr, T.stamp.en, { size: 30, rot: -0.045 });
        ctx.restore();
      }
      foot(ctx, T.p, win(lt, 8.6, 15, 1.0, 0.6));
    }
  }

  /* 03 — Godine na mapi, pa nestanak sa mape. / The years on the map, then leaving it. */
  function scCity(ctx, lt, M) {
    var rec = M.rec, T = M.T.city;
    var mx = X0, my = 150, mw = 1060, mh = 720;
    var pr = fit(CITY, mx, my, mw, mh);
    var a = win(lt, 0.3, 21, 1.1, 0.7);
    ctx.save(); ctx.globalAlpha *= a;
    rect(ctx, mx, my, mw, mh, { fill: C.white });
    ctx.save();
    clipRect(ctx, mx, my, mw, mh);
    graticule(ctx, pr, mx, my, mw, mh, 0.02, 2);
    rivers(ctx, pr, 10, { ada: [14, 18], gazela: [-12, 20, 'right'], branko: [14, -8], usce: [-12, -12, 'right'], pancevo: [-10, 24, 'right'] });
    var sl = pr.p((ANCHORS.ada.lon + ANCHORS.gazela.lon) / 2, (ANCHORS.ada.lat + ANCHORS.gazela.lat) / 2);
    tx(ctx, 'SAVA', sl.x + 26, sl.y + 26, { size: 17, mono: true, color: C.riverInk, ls: 3 });
    var dl = pr.p(20.468, 44.8235);
    tx(ctx, 'DUNAV / DANUBE', dl.x, dl.y + 34, { size: 17, mono: true, color: C.riverInk, ls: 2 });

    /* osa mosta / the bridge axis */
    var p1 = pr.p(rec.object.line[0][0], rec.object.line[0][1]);
    var p2 = pr.p(rec.object.line[1][0], rec.object.line[1][1]);
    var gone = cl01((lt - 13.0) / 3.0);
    if (lt > 1.4 && gone < 1) {
      var seg = 18;
      for (var i = 0; i < seg; i++) {
        var u0 = i / seg, u1 = (i + 1) / seg;
        var fall = cl01((gone - nz(i * 7.3) * 0.55) / 0.45);
        var dy = fall * fall * 160, al = (1 - fall) * cl01((lt - 1.4) / 0.6);
        if (al <= 0.02) continue;
        poly(ctx, [[lerp(p1.x, p2.x, u0), lerp(p1.y, p2.y, u0) + dy], [lerp(p1.x, p2.x, u1), lerp(p1.y, p2.y, u1) + dy]],
             { stroke: C.ink, lw: 7, cap: 'butt', alpha: al });
      }
      ctx.save(); ctx.globalAlpha *= (1 - gone) * cl01((lt - 1.6) / 0.6);
      tx(ctx, 'STARI SAVSKI MOST', p2.x + 20, p2.y + 6, { size: 18, mono: true, color: C.ink, ls: 1.6 });
      tx(ctx, 'OLD SAVA BRIDGE', p2.x + 20, p2.y + 28, { size: 14, mono: true, color: C.muted, ls: 1.4 });
      ctx.restore();
    }
    if (gone > 0.5) poly(ctx, [[p1.x, p1.y], [p2.x, p2.y]], { stroke: C.muted, lw: 1.6, dash: [8, 6], alpha: win(lt, 14.6, 21, 1.0, 0.7) });
    ctx.restore();
    rect(ctx, mx, my, mw, mh, { stroke: C.line, lw: 1 });

    /* razmernik i legenda iz projekcije / scale bar and legend from the projection */
    var km = pr.km(), lyb = my + mh - 30;
    rect(ctx, mx + 1, my + mh - 104, 660, 103, { fill: 'rgba(255,254,250,0.92)' });
    poly(ctx, [[mx + 24, lyb - 44], [mx + 24 + km, lyb - 44]], { stroke: C.ink, lw: 1.4 });
    poly(ctx, [[mx + 24, lyb - 50], [mx + 24, lyb - 38]], { stroke: C.ink, lw: 1.4 });
    poly(ctx, [[mx + 24 + km, lyb - 50], [mx + 24 + km, lyb - 38]], { stroke: C.ink, lw: 1.4 });
    tx(ctx, '1 km', mx + 34 + km, lyb - 39, { size: 14, mono: true, color: C.ink });
    poly(ctx, [[mx + 24, lyb - 17], [mx + 52, lyb - 17]], { stroke: C.river, lw: 6 });
    tx(ctx, T.legend[0].sr, mx + 64, lyb - 12, { size: 12, mono: true, color: C.muted });
    poly(ctx, [[mx + 24, lyb + 8], [mx + 52, lyb + 8]], { stroke: C.ink, lw: 5, cap: 'butt' });
    tx(ctx, T.legend[1].sr, mx + 64, lyb + 13, { size: 12, mono: true, color: C.muted });
    ctx.restore();

    /* godine, svaka sa izvorom / the years, each with its source */
    var a2 = win(lt, 1.4, 21, 0.9, 0.7);
    if (a2 > 0) {
      ctx.save(); ctx.globalAlpha *= a2;
      var first = rec.timeline[0].y, last = rec.timeline[rec.timeline.length - 1].y;
      var year = Math.min(last, Math.round(lerp(first, last, (lt - 1.6) / 10.5)));
      var rx = 1270;
      tx(ctx, year, rx, 290, { size: 140, mono: true, color: C.ink });
      var shown = rec.timeline.filter(function (e) { return e.y <= year; }).slice(-5);
      var y = 372;
      shown.forEach(function (e) {
        var cur = e.y === shown[shown.length - 1].y;
        ctx.save(); ctx.globalAlpha *= cur ? 1 : 0.46;
        tx(ctx, e.y, rx, y, { size: 22, mono: true, color: C.signal });
        tx(ctx, tags(e.s), rx, y + 22, { size: 12, mono: true, color: C.muted });
        var l1 = para(ctx, e.sr, rx + 84, y, X1 - rx - 84, { size: 19, color: C.ink, lh: 24 });
        var l2 = para(ctx, e.en, rx + 84, l1 + 23, X1 - rx - 84, { size: 15, color: C.muted, lh: 20 });
        ctx.restore();
        y = Math.max(l2, y + 22) + 40;
      });
      ctx.restore();
    }
    foot(ctx, T.foot, win(lt, 15.6, 21, 1.2, 0.8));
  }

  /* 04 — Izvori: šta se napuni, a šta ostane prazno. / Sources: what fills up, what stays empty. */
  function scSources(ctx, lt, M) {
    var rec = M.rec, T = M.T.sources;
    var a = win(lt, 0.3, 21, 1.0, 0.7);
    ctx.save(); ctx.globalAlpha *= a;
    bi(ctx, T.h.sr, T.h.en, X0, 214, 1200, { size: 56, size2: 22 });
    ctx.restore();

    var n = rec.sources.length, sy = 318, sh = Math.min(78, Math.floor((870 - sy) / n) - 8);
    rec.sources.forEach(function (s, i) {
      var av = win(lt, 1.2 + i * 0.4, 21, 0.6, 0.5);
      if (av <= 0) return;
      ctx.save(); ctx.globalAlpha *= av;
      var y = sy + i * (sh + 8);
      rect(ctx, X0, y, 700, sh, { fill: C.white, stroke: C.line, lw: 1 });
      rect(ctx, X0, y, 5, sh, { fill: s.kind === 'O' ? C.stamp : C.signal });
      tx(ctx, 'S' + (i + 1), X0 + 22, y + 36, { size: 24, mono: true, color: s.kind === 'O' ? C.stamp : C.signal });
      var lines = wrap(ctx, s.t, 570, { size: 16 });
      var tl = lines.slice(0, 2);
      if (lines.length > 2) tl[1] = tl[1] + ' …';
      tl.forEach(function (l, li) { tx(ctx, l, X0 + 100, y + 24 + li * 19, { size: 16, color: C.ink }); });
      tx(ctx, fitText(ctx, EVIDENCE[s.kind].sr + '  ·  ' + s.pub, 580, { size: 12, mono: true }), X0 + 100, y + sh - 9, { size: 12, mono: true, color: C.muted });
      ctx.restore();
    });

    var gx = 890, gy = 318, cw = 284, ch = Math.floor((870 - gy) / 6) - 8, gap = 9;
    var filled = Math.floor(cl01((lt - 4.0) / 11.0) * (M.total + 0.999));
    rec.claims.forEach(function (c, i) {
      var col = i % 3, row = Math.floor(i / 3);
      var x = gx + col * (cw + gap), y = gy + row * (ch + 8);
      var num = (i + 1 < 10 ? '0' : '') + (i + 1);
      ctx.save(); ctx.globalAlpha *= a;
      if (i >= filled) {
        rect(ctx, x, y, cw, ch, { fill: C.white, stroke: C.line, lw: 1, dash: [5, 4] });
        tx(ctx, num, x + 10, y + 22, { size: 14, mono: true, color: '#b9b8b1' });
      } else {
        ctx.globalAlpha *= easeOut(cl01((lt - 4.0 - i * (11.0 / (M.total + 1))) / 0.5));
        var k = cell(ctx, x, y, cw, ch, c);
        tx(ctx, num, k.x, y + 22, { size: 14, mono: true, color: k.sub });
        tx(ctx, c.ev || '', x + cw - 12, y + 22, { size: 14, mono: true, color: k.sub, align: 'right' });
        var lines = wrap(ctx, c.q.sr, cw - (k.x - x) - 12, { size: 15 });
        lines.slice(0, 2).forEach(function (l, li) { tx(ctx, l, k.x, y + 42 + li * 17, { size: 15, color: k.ink }); });
        if (c.src.length) tx(ctx, c.src.map(function (s) { return 'S' + M.srcIndex[s]; }).join(' '), k.x, y + ch - 6, { size: 11, mono: true, color: k.sub });
      }
      ctx.restore();
    });
    foot(ctx, T.foot, win(lt, 16.2, 21, 1.1, 0.7));
  }

  /* 05 — Isto pitanje, dva broja. / The same question, two numbers. */
  function scConflict(ctx, lt, M) {
    var T = M.T.conflict, span = T.rows[0];
    var a = win(lt, 0.3, 20, 1.0, 0.7);
    ctx.save(); ctx.globalAlpha *= a;
    bi(ctx, T.h.sr, T.h.en, X0, 214, 1100, { size: 56, size2: 22 });
    ctx.restore();

    var y0 = 690, x0 = X0, scale = 760 / Math.max(span.a.v, span.b.v);
    var wA = span.a.v * scale, wB = span.b.v * scale;
    var a1 = win(lt, 1.4, 20, 1.0, 0.7);
    if (a1 > 0) {
      ctx.save(); ctx.globalAlpha *= a1;
      drawBridge(ctx, x0, y0, wA, wA * 0.15, { color: C.ink, lw: 3, lattice: true, grow: easeOut((lt - 1.6) / 2.2) });
      dimension(ctx, x0, x0 + wA, y0 + 58, span.a.v + ' ' + span.a.u, { color: C.ink, size: 22 });
      tx(ctx, span.a.by.sr + ' / ' + span.a.by.en + '   ' + tags(span.a.src), x0, y0 + 100, { size: 16, mono: true, color: C.muted });
      ctx.restore();
    }
    var a2 = win(lt, 4.4, 20, 1.0, 0.7);
    if (a2 > 0) {
      ctx.save(); ctx.globalAlpha *= a2;
      drawBridge(ctx, x0, y0, wB, wB * 0.15, { color: C.stamp, lw: 2.4, dash: [9, 6], grow: easeOut((lt - 4.6) / 1.8) });
      dimension(ctx, x0, x0 + wB, 474, span.b.v + ' ' + span.b.u, { color: C.stamp, size: 22 });
      tx(ctx, span.b.by.sr + ' / ' + span.b.by.en + '   ' + tags(span.b.src), x0, 418, { size: 16, mono: true, color: C.stamp });
      ctx.restore();
    }

    var tx0 = 1190, ty0 = 352, colB = 1490;
    var a3 = win(lt, 7.0, 20, 1.0, 0.7);
    if (a3 > 0) {
      ctx.save(); ctx.globalAlpha *= a3;
      rect(ctx, tx0, ty0 - 46, X1 - tx0, 2, { fill: C.ink });
      T.rows.forEach(function (r, i) {
        if (!r.a || !r.b) return;
        var y = ty0 + i * 104, av = win(lt, 7.2 + i * 0.7, 20, 0.6, 0.5);
        ctx.save(); ctx.globalAlpha *= av;
        tx(ctx, r.sr + ' / ' + r.en, tx0, y - 10, { size: 15, mono: true, color: C.muted, ls: 1.2 });
        var va = (r.a.approx ? '≈' : '') + r.a.v + ' ' + r.a.u, vb = (r.b.approx ? '≈' : '') + r.b.v + ' ' + r.b.u;
        tx(ctx, va, tx0, y + 34, { size: 38, mono: true, color: C.ink });
        tx(ctx, tags(r.a.src), tx0, y + 58, { size: 13, mono: true, color: C.muted });
        tx(ctx, vb, colB, y + 34, { size: 38, mono: true, color: C.stamp });
        tx(ctx, tags(r.b.src), colB, y + 58, { size: 13, mono: true, color: C.stamp });
        rect(ctx, tx0, y + 74, X1 - tx0, 1, { fill: C.line });
        ctx.restore();
      });
      ctx.restore();
    }
    if (T.flag) {
      var af = win(lt, 10.2, 20, 1.0, 0.7);
      if (af > 0) {
        ctx.save(); ctx.globalAlpha *= af;
        tx(ctx, 'ZASTAVICA IZVORA / SOURCE FLAG', tx0, 692, { size: 13, mono: true, color: C.stamp, ls: 2 });
        var lf = para(ctx, T.flag.sr, tx0, 722, X1 - tx0, { size: 17, color: C.ink, lh: 23 });
        para(ctx, T.flag.en, tx0, lf + 26, X1 - tx0, { size: 14, color: C.muted, lh: 19 });
        ctx.restore();
      }
    }
    var a4 = win(lt, 11.6, 20, 1.0, 0.7);
    if (a4 > 0) {
      ctx.save(); ctx.globalAlpha *= a4;
      stampBox(ctx, 980, 330, T.stamp.sr, T.stamp.en, { size: 28, rot: -0.04 });
      ctx.restore();
    }
    foot(ctx, T.foot, win(lt, 13.0, 20, 1.1, 0.7));
  }

  /* 06 — Put mosta: Dortmund, Tisa, Sava, Batajnica, pa znak pitanja.
     The bridge's path: Dortmund, the Tisa, the Sava, Batajnica, then a question mark. */
  function scTravel(ctx, lt, M) {
    var rec = M.rec, T = M.T.travel, P = M.place;
    var a = win(lt, 0.3, 21, 1.0, 0.7);
    ctx.save(); ctx.globalAlpha *= a;
    bi(ctx, T.h.sr, T.h.en, X0, 214, 1250, { size: 56, size2: 22 });
    ctx.restore();

    var phase = lt < 10.0 ? 0 : 1;
    var mx = X0, my = 300, mw = 1110, mh = 570;
    var box = phase === 0 ? { lon0: 4.6, lon1: 23.4, lat0: 43.6, lat1: 52.6 }
                          : { lon0: 20.235, lon1: 20.635, lat0: 44.776, lat1: 44.926 };
    var pr = fit(box, mx, my, mw, mh);
    var av = phase === 0 ? win(lt, 1.0, 10.0, 0.9, 0.6) : win(lt, 10.1, 21, 0.9, 0.8);
    ctx.save(); ctx.globalAlpha *= av;
    rect(ctx, mx, my, mw, mh, { fill: C.white });
    ctx.save();
    clipRect(ctx, mx, my, mw, mh);
    graticule(ctx, pr, mx, my, mw, mh, phase === 0 ? 2 : 0.1, phase === 0 ? 0 : 1);
    if (phase === 1) {
      rivers(ctx, pr, 5, null);
      rect(ctx, mx + 1, my + mh - 34, 640, 33, { fill: 'rgba(255,254,250,0.92)' });
      poly(ctx, [[mx + 20, my + mh - 17], [mx + 46, my + mh - 17]], { stroke: C.river, lw: 5 });
      tx(ctx, M.T.city.legend[0].sr, mx + 58, my + mh - 12, { size: 12, mono: true, color: C.muted });
    }

    /* oznake puta stoje tamo gde ih nijedna linija ne preseca / leg labels sit where no line crosses them */
    var legs = phase === 0
      ? [{ a: 'dortmund', b: 'zabalj', dashed: true, at: 0.45, dx: 30, dy: -14, al: 'left', sr: 'prvobitno predviđeno', en: 'first intended' },
         { a: 'dortmund', b: 'sava', dashed: false, at: 0.56, dx: -30, dy: 22, al: 'right', sr: 'montiran ' + rec.timeline[0].y, en: 'erected ' + rec.timeline[0].y }]
      : [{ a: 'sava', b: 'batajnica', dashed: false, at: 0.28, dx: -26, dy: 28, al: 'right', sr: 'delovi posle demontaže', en: 'parts after dismantling' },
         { a: 'sava', b: 'veliko-selo', dashed: true, at: 0.6, dx: 0, dy: 34, al: 'center', sr: 'plan iz 2021, napušten', en: 'the 2021 plan, abandoned' }];
    var t0 = phase === 0 ? 2.0 : 11.2;
    legs.forEach(function (lg, i) {
      var A = P[lg.a], B = P[lg.b];
      if (!A || !B || A.lon === null || B.lon === null) return;
      var qa = pr.p(A.lon, A.lat), qb = pr.p(B.lon, B.lat);
      var g = easeOut(cl01((lt - t0 - i * 1.4) / 1.6));
      poly(ctx, [[qa.x, qa.y], [lerp(qa.x, qb.x, g), lerp(qa.y, qb.y, g)]],
           { stroke: lg.dashed ? C.muted : C.ink, lw: lg.dashed ? 1.6 : 2.6, dash: lg.dashed ? [9, 7] : null });
      if (g > 0.98 && phase === 0) {
        var km = Math.round(haversine(A, B));
        var px = lerp(qa.x, qb.x, lg.at) + lg.dx, py = lerp(qa.y, qb.y, lg.at) + lg.dy;
        tx(ctx, km + ' km, vazdušno / straight line', px, py, { size: 15, mono: true, color: lg.dashed ? C.muted : C.ink, align: lg.al });
        tx(ctx, lg.sr + ' / ' + lg.en, px, py + 22, { size: 15, mono: true, color: lg.dashed ? C.muted : C.signal, align: lg.al });
      }
    });

    var show = phase === 0 ? { dortmund: [24, -4], zabalj: [-24, 30, 'right'], sava: [24, 10] }
                           : { sava: [-30, 42, 'right'], batajnica: [24, -8], 'veliko-selo': [0, -44, 'center'] };
    rec.places.forEach(function (p, i) {
      var off = show[p.k];
      if (!off || p.lon === null) return;
      var q = pr.p(p.lon, p.lat);
      var ap = easeOut(cl01((lt - (phase === 0 ? 1.4 : 10.6) - i * 0.4) / 0.8));
      if (ap <= 0.02) return;
      ctx.save(); ctx.globalAlpha *= ap;
      var faint = p.role === 'dropped' || p.role === 'intended';
      dot(ctx, q.x, q.y, 13, { fill: C.white, stroke: faint ? C.muted : C.ink, lw: 2, dash: faint ? [4, 3] : null });
      dot(ctx, q.x, q.y, 4.5, { fill: faint ? C.muted : C.signal });
      var al = off[2] || 'left';
      tx(ctx, dash(p.sr), q.x + off[0], q.y + off[1], { size: 19, color: C.ink, align: al });
      tx(ctx, dash(p.en) + '   ' + tags(p.s), q.x + off[0], q.y + off[1] + 22, { size: 14, color: C.muted, align: al });
      ctx.restore();
    });
    ctx.restore();
    rect(ctx, mx, my, mw, mh, { stroke: C.line, lw: 1 });
    ctx.restore();

    /* desna kolona: putevi posle demontaže, pa nepoznato odredište
       right column: the paths after dismantling, then the unknown destination */
    var ux = 1330;
    if (phase === 1) {
      legs.forEach(function (lg, i) {
        var A = P[lg.a], B = P[lg.b], al = win(lt, 12.6 + i * 1.4, 21, 0.8, 0.8);
        if (al <= 0 || !A || !B || B.lon === null) return;
        ctx.save(); ctx.globalAlpha *= al;
        var y = 330 + i * 96;
        poly(ctx, [[ux, y - 6], [ux + 44, y - 6]], { stroke: lg.dashed ? C.muted : C.ink, lw: lg.dashed ? 1.6 : 2.6, dash: lg.dashed ? [9, 7] : null });
        tx(ctx, A.sr.split(':')[0] + ' → ' + B.sr.split(':')[0], ux + 60, y, { size: 18, color: C.ink });
        tx(ctx, Math.round(haversine(A, B)) + ' km, vazdušno / straight line   ' + tags(B.s), ux + 60, y + 24, { size: 13, mono: true, color: C.muted });
        tx(ctx, lg.sr + ' / ' + lg.en, ux + 60, y + 46, { size: 13, mono: true, color: lg.dashed ? C.muted : C.signal });
        ctx.restore();
      });
    }
    var a4 = win(lt, 15.6, 21, 1.0, 0.8);
    if (a4 > 0) {
      ctx.save(); ctx.globalAlpha *= a4;
      var uy = 590;
      dot(ctx, ux + 30, uy, 30, { stroke: C.muted, lw: 2, dash: [8, 6] });
      tx(ctx, '?', ux + 30, uy + 15, { size: 44, mono: true, color: C.muted, align: 'center' });
      var nb = para(ctx, T.next.sr, ux, uy + 70, X1 - ux, { size: 18, color: C.ink, lh: 24 });
      para(ctx, T.next.en, ux, nb + 30, X1 - ux, { size: 14, color: C.muted, lh: 19 });
      ctx.restore();
    }
    var a5 = win(lt, 1.0, 21, 1.0, 0.7);
    if (a5 > 0) {
      ctx.save(); ctx.globalAlpha *= a5;
      rect(ctx, X0, 902, X1 - X0, 1, { fill: C.line });
      para(ctx, T.note.sr, X0, 942, 860, { size: 17, color: C.muted, lh: 24, max: 3 });
      para(ctx, T.note.en, 1070, 942, X1 - 1070, { size: 15, color: '#8e9098', lh: 21, max: 3 });
      ctx.restore();
    }
  }

  /* 07 — Masa bez dosijea. / Mass with no file. */
  function scCondition(ctx, lt, M) {
    var T = M.T.condition, kolic = M.claim.kolic;
    var mass = kolic.m.filter(function (m) { return m.k === 'mass-total'; })[0];
    var arch = kolic.m.filter(function (m) { return m.k === 'mass-arch'; }).map(function (m) { return m.v; }).sort(function (x, y) { return x - y; });
    var a = win(lt, 0.3, 17, 1.0, 0.7);
    ctx.save(); ctx.globalAlpha *= a;
    bi(ctx, T.h.sr, T.h.en, X0, 214, 1300, { size: 56, size2: 22 });
    ctx.restore();

    /* jedan kvadrat po toni / one square per tonne */
    var gx = X0, gy = 382, cols = 50, pitch = 15, sz = 11;
    var N = mass.v, rows = Math.ceil(N / cols);
    var shown = Math.round(easeOut(cl01((lt - 1.2) / 3.4)) * N);
    ctx.save(); ctx.globalAlpha *= a;
    for (var i = 0; i < shown; i++) {
      var cx = gx + (i % cols) * pitch, cy = gy + Math.floor(i / cols) * pitch;
      var inArch = i < arch[0], range = i >= arch[0] && i < arch[arch.length - 1];
      ctx.fillStyle = inArch ? '#cfc9bd' : range ? '#efe2df' : '#e3dfd6';
      ctx.fillRect(cx, cy, sz, sz);
      if (range) rect(ctx, cx, cy, sz, sz, { stroke: C.stamp, lw: 1, dash: [2, 2] });
    }
    ctx.restore();
    var gb = gy + rows * pitch;
    var a2 = win(lt, 4.6, 17, 0.9, 0.7);
    if (a2 > 0) {
      ctx.save(); ctx.globalAlpha *= a2;
      tx(ctx, T.archLine.sr, gx, gy - 18, { size: 15, mono: true, color: C.stamp });
      tx(ctx, T.archLine.en, gx, gb + 30, { size: 14, mono: true, color: C.muted });
      tx(ctx, T.totalLine.sr, gx, gb + 56, { size: 14, mono: true, color: C.ink });
      tx(ctx, T.totalLine.en, gx, gb + 78, { size: 13, mono: true, color: C.muted });
      ctx.restore();
    }

    var px = 1010;
    var a3 = win(lt, 6.2, 17, 1.0, 0.7);
    if (a3 > 0) {
      ctx.save(); ctx.globalAlpha *= a3;
      tx(ctx, T.zero, px, 520, { size: 160, mono: true, color: C.stamp });
      var zb = para(ctx, T.zeroText.sr, px + 130, 452, X1 - px - 130, { size: 22, color: C.ink, lh: 29 });
      para(ctx, T.zeroText.en, px + 130, zb + 30, X1 - px - 130, { size: 16, color: C.muted, lh: 22 });
      ctx.restore();
    }
    if (T.quote) {
      var a4 = win(lt, 8.8, 17, 1.0, 0.7);
      if (a4 > 0) {
        ctx.save(); ctx.globalAlpha *= a4;
        rect(ctx, px, 600, X1 - px, 2, { fill: C.stamp });
        var qb = para(ctx, T.quote.sr, px, 646, X1 - px, { size: 22, color: C.ink, lh: 30 });
        tx(ctx, T.quote.who.sr + '   ' + T.quote.src, px, qb + 40, { size: 14, mono: true, color: C.muted });
        tx(ctx, T.quote.who.en, px, qb + 62, { size: 13, mono: true, color: '#8e9098' });
        stampBox(ctx, px + 230, qb + 132, T.stamp.sr, T.stamp.en, { size: 22, rot: -0.03 });
        ctx.restore();
      }
    }
  }

  /* 08 — Šta pasoš omogućava. / What the passport makes possible. */
  function scDecision(ctx, lt, M) {
    var T = M.T.decision;
    var a = win(lt, 0.3, 14, 1.0, 0.7);
    ctx.save(); ctx.globalAlpha *= a;
    bi(ctx, T.h.sr, T.h.en, X0, 214, 1500, { size: 52, size2: 21 });
    ctx.restore();

    T.need.forEach(function (n, i) {
      var c = M.claim[n.k], S = STATUS[c.st] || STATUS.unknown;
      var av = win(lt, 1.2 + i * 0.45, 14, 0.6, 0.5);
      if (av <= 0) return;
      ctx.save(); ctx.globalAlpha *= av;
      var y = 330 + i * 78;
      rect(ctx, X0, y, 1100, 66, { fill: C.white, stroke: C.line, lw: 1 });
      swatch(ctx, X0 + 18, y + 22, 22, c.st);
      tx(ctx, (i + 1) + '.', X0 + 62, y + 42, { size: 20, mono: true, color: C.muted });
      tx(ctx, n.sr, X0 + 104, y + 31, { size: 23, color: C.ink });
      tx(ctx, n.en, X0 + 104, y + 54, { size: 15, color: C.muted });
      tx(ctx, S.sr + ' / ' + S.en, X0 + 560, y + 41, { size: 16, mono: true, color: S.mark === 'none' || S.mark === 'dash' ? C.muted : S.c });
      if (c.st === 'confirmed') check(ctx, X0 + 1060, y + 34, 26, S.c);
      else tx(ctx, c.st === 'unknown' ? '?' : '!', X0 + 1070, y + 45, { size: 28, mono: true, color: S.mark === 'none' ? C.muted : S.c, align: 'right' });
      ctx.restore();
    });

    var a2 = win(lt, 5.4, 14, 1.0, 0.7);
    if (a2 > 0) {
      ctx.save(); ctx.globalAlpha *= a2;
      tx(ctx, T.met + ' / ' + T.need.length, X1, 450, { size: 110, mono: true, color: C.ink, align: 'right' });
      tx(ctx, T.metText.sr, X1, 500, { size: 21, color: C.ink, align: 'right' });
      tx(ctx, T.metText.en, X1, 528, { size: 16, color: C.muted, align: 'right' });
      ctx.restore();
    }
    var a3 = win(lt, 7.6, 14, 1.0, 0.7);
    if (a3 > 0) {
      ctx.save(); ctx.globalAlpha *= a3;
      var ax = 1300;
      tx(ctx, T.argLabel, ax, 640, { size: 12, mono: true, color: C.stamp, ls: 1.6 });
      var ab = para(ctx, T.arg.sr, ax, 682, X1 - ax, { size: 22, color: C.ink, lh: 30 });
      para(ctx, T.arg.en, ax, ab + 36, X1 - ax, { size: 15, color: C.muted, lh: 21 });
      ctx.restore();
    }
  }

  /* 09 — Nepoznato je zapis, ne praznina. / Unknown is a record, not a blank. */
  function scEnd(ctx, lt, M) {
    var rec = M.rec, T = M.T.end;
    var callA = win(lt, 9.4, 17 + 1, 1.4, 0.01);
    if (callA < 1) {
      ctx.save(); ctx.globalAlpha *= win(lt, 0.3, 17, 1.0, 0.01);
      bi(ctx, T.h.sr, T.h.en, X0, 214, 1200, { size: 58, size2: 23 });

      var gx = X0, gy = 330, cw = 112, ch = 62, gap = 8, lx = gx + 240;
      M.byLayer.forEach(function (row, li) {
        var y = gy + li * (ch + gap);
        tx(ctx, row.layer.sr, gx, y + 28, { size: 17, mono: true, color: C.ink });
        tx(ctx, row.layer.en, gx, y + 48, { size: 13, mono: true, color: C.muted });
        row.claims.forEach(function (c, ci) { cell(ctx, lx + ci * (cw + gap), y, cw, ch, c); });
      });

      var lgx = 790;
      ctx.save(); ctx.globalAlpha *= cl01((lt - 1.8) / 1.0);
      ORDER.forEach(function (k, i) {
        var S = STATUS[k], y = gy + 8 + i * 58;
        swatch(ctx, lgx, y, 28, k);
        tx(ctx, M.counts[k], lgx + 46, y + 24, { size: 30, mono: true, color: C.ink });
        tx(ctx, S.sr, lgx + 92, y + 12, { size: 16, mono: true, color: C.ink });
        tx(ctx, S.en, lgx + 92, y + 31, { size: 13, mono: true, color: C.muted });
      });
      ctx.restore();

      ctx.save(); ctx.globalAlpha *= cl01((lt - 3.2) / 1.0);
      var sx = 1180;
      rect(ctx, sx, 330, 2, 410, { fill: C.line });
      var sb = para(ctx, T.scope.sr, sx + 36, 360, X1 - sx - 36, { size: 19, color: C.ink, lh: 26 });
      para(ctx, T.scope.en, sx + 36, sb + 40, X1 - sx - 36, { size: 15, color: C.muted, lh: 21 });
      ctx.restore();

      ctx.save(); ctx.globalAlpha *= cl01((lt - 4.8) / 1.0);
      rect(ctx, X0, 776, X1 - X0, 1, { fill: C.line });
      tx(ctx, T.sourcesHead, X0, 808, { size: 14, mono: true, color: C.muted, ls: 2 });
      var rowsN = Math.ceil(rec.sources.length / 2);
      rec.sources.forEach(function (s, i) {
        var col = Math.floor(i / rowsN), x = X0 + col * 820, y = 842 + (i % rowsN) * 34;
        tx(ctx, 'S' + (i + 1), x, y, { size: 15, mono: true, color: s.kind === 'O' ? C.stamp : C.signal });
        var line = wrap(ctx, s.t + ' — ' + s.pub, 740, { size: 15, mono: true });
        tx(ctx, line[0] + (line.length > 1 ? ' …' : ''), x + 44, y, { size: 15, mono: true, color: C.ink });
      });
      ctx.restore();
      ctx.restore();
    }

    /* poziv: tamni list prekrije kadar do kraja / the call: a dark sheet covers the frame to the end */
    if (callA > 0) {
      ctx.save(); ctx.globalAlpha *= callA;
      ctx.fillStyle = C.ink; ctx.fillRect(56, 56, W - 112, H - 112);
      var ca = cl01((lt - 10.9) / 1.2);
      ctx.globalAlpha *= ca;
      tx(ctx, T.course, W / 2, 300, { size: 17, mono: true, color: '#9aa3c9', align: 'center', ls: 5 });
      bi(ctx, T.call.sr, T.call.en, W / 2, 440, 1500, { size: 80, size2: 30, color: C.paper, color2: '#b9c8ff', align: 'center' });
      tx(ctx, T.url, W / 2, 640, { size: 32, mono: true, color: '#8ea3ff', align: 'center', ls: 2 });
      tx(ctx, T.sum.sr, W / 2, 760, { size: 20, mono: true, color: '#d0d2d5', align: 'center' });
      tx(ctx, T.sum.en, W / 2, 792, { size: 16, mono: true, color: '#9a9ca1', align: 'center' });
      tx(ctx, T.recorded, W / 2, 900, { size: 15, mono: true, color: '#797b80', align: 'center' });
      ctx.restore();
    }
  }

  var DRAW = {
    blank: scBlank, cover: scCover, city: scCity, sources: scSources, conflict: scConflict,
    travel: scTravel, condition: scCondition, decision: scDecision, end: scEnd
  };

  /* ---------- jedan kadar / one frame ---------- */
  function render(ctx, t, M) {
    t = Math.max(0, Math.min(DURATION - 0.0001, t));
    var sc = sceneAt(t);
    chrome(ctx, t, M);
    ctx.save();
    DRAW[sc.k](ctx, t - sc.t0, M);
    ctx.restore();
    /* rez: tanka linija preko kadra, da se montaža vidi i bez zvuka
       the cut: a thin line across the frame, so the edit reads without sound */
    var since = t - sc.t0;
    if (since < 0.34 && sc.i > 0) {
      var u = since / 0.34;
      ctx.save();
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = C.signal;
      ctx.fillRect(0, 0, W * easeOut(u), 3);
      ctx.restore();
    }
  }
  function renderFrame(ctx, n, M) { render(ctx, n / FPS, M); }

  return {
    W: W, H: H, FPS: FPS, DURATION: DURATION, FRAMES: Math.round(DURATION * FPS),
    SCENES: SCENES, STATUS: STATUS, ORDER: ORDER, LAYERS: LAYERS, EVIDENCE: EVIDENCE, C: C,
    ANCHORS: ANCHORS, RIVERS: RIVERS,
    prepare: prepare, script: script, render: render, renderFrame: renderFrame,
    sceneAt: sceneAt, timecode: timecode, haversine: haversine, fit: fit
  };
}));
