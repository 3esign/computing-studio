/* Belgrade passport pilot — data model and coverage arithmetic.
   Pasoš Beograda (pilot) — model podataka i račun pokrivenosti.

   Pure module: no DOM, no network, no dependencies. The page and the proof
   gate use the same functions, so a number on screen and a number in the
   test cannot drift apart.

   Honesty rule carried in the data itself: every recorded value has an
   evidence class, and a missing value is a first-class state, not a blank.
   Evidence classes: D document · M measured · S secondary literature
                     O oral · I constructed for class
*/
(function (root, factory) {
  'use strict';
  var M = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else root.PasosModel = M;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------- six layers of one passport ---------- */
  var LAYERS = [
    { k: 'id',   en: 'Identity',  sr: 'Identitet' },
    { k: 'geo',  en: 'Geometry',  sr: 'Geometrija' },
    { k: 'mat',  en: 'Material',  sr: 'Materijal' },
    { k: 'org',  en: 'Origin',    sr: 'Poreklo' },
    { k: 'cond', en: 'Condition', sr: 'Stanje' },
    { k: 'use',  en: 'Reuse',     sr: 'Ponovna upotreba' }
  ];

  /* ---------- six places an answer can come from ---------- */
  var SOURCES = [
    { k: 'reg', en: 'Public registry',   sr: 'Javni registar',
      cost: { en: 'free, from a phone',   sr: 'besplatno, sa telefona' } },
    { k: 'arh', en: 'Archive drawings',  sr: 'Arhivski crteži',
      cost: { en: 'a request, then days', sr: 'zahtev, pa dani' } },
    { k: 'obi', en: 'Visit and measure', sr: 'Obilazak i merenje',
      cost: { en: 'you, tape, phone',     sr: 'ti, metar, telefon' } },
    { k: 'lab', en: 'Material testing',  sr: 'Ispitivanje materijala',
      cost: { en: 'paid, often destructive', sr: 'plaća se, često razorno' } },
    { k: 'maj', en: 'Builder, occupant', sr: 'Majstor i korisnik',
      cost: { en: 'spoken, unverified',   sr: 'usmeno, nepotvrđeno' } },
    { k: 'sen', en: 'Sensor record',     sr: 'Zapis senzora',
      cost: { en: 'only if something was installed', sr: 'samo ako je nešto ugrađeno' } }
  ];

  /* ---------- eighteen questions, the same for every object ----------
     src  = sources that can answer this question
     need = 'any' (one source is enough) or 'all' (the question needs them together) */
  var FIELDS = [
    { k: 'naziv',   l: 'id',   src: ['reg', 'arh', 'maj'], need: 'any',
      en: 'What is it called?',              sr: 'Kako se zove?' },
    { k: 'parcela', l: 'id',   src: ['reg'], need: 'any',
      en: 'Which cadastral parcel?',         sr: 'Koja je katastarska parcela?' },
    { k: 'godina',  l: 'id',   src: ['reg', 'arh', 'maj'], need: 'any',
      en: 'When was it finished?',           sr: 'Kada je završena?' },

    { k: 'gabarit', l: 'geo',  src: ['arh', 'obi'], need: 'any',
      en: 'What is the outline and height?', sr: 'Koliki su gabarit i visina?' },
    { k: 'etaze',   l: 'geo',  src: ['reg', 'arh', 'obi'], need: 'any',
      en: 'How many storeys?',               sr: 'Koliko ima etaža?' },
    { k: 'odstup',  l: 'geo',  src: ['arh', 'obi'], need: 'all',
      en: 'Does the built thing match the drawn one?', sr: 'Da li izvedeno odgovara nacrtanom?' },

    { k: 'konstr',  l: 'mat',  src: ['arh', 'obi', 'lab'], need: 'any',
      en: 'What carries the load?',          sr: 'Šta nosi konstrukciju?' },
    { k: 'fasada',  l: 'mat',  src: ['arh', 'obi', 'lab'], need: 'any',
      en: 'What is the facade made of?',     sr: 'Od čega je fasada?' },
    { k: 'kolic',   l: 'mat',  src: ['arh', 'lab'], need: 'all',
      en: 'How much material, by mass?',     sr: 'Koliko materijala, po masi?' },

    { k: 'projekt', l: 'org',  src: ['reg', 'arh'], need: 'any',
      en: 'Who designed it?',                sr: 'Ko je projektovao?' },
    { k: 'izvod',   l: 'org',  src: ['arh', 'maj'], need: 'any',
      en: 'Who built it?',                   sr: 'Ko je gradio?' },
    { k: 'izvor',   l: 'org',  src: ['arh', 'lab', 'maj'], need: 'any',
      en: 'Where did the material come from?', sr: 'Odakle je materijal došao?' },

    { k: 'nosiv',   l: 'cond', src: ['obi', 'lab'], need: 'any',
      en: 'What state is the structure in?', sr: 'U kakvom je stanju konstrukcija?' },
    { k: 'opasne',  l: 'cond', src: ['lab'], need: 'any',
      en: 'Is there a hazardous substance?', sr: 'Ima li opasnih materija?' },
    { k: 'ponasa',  l: 'cond', src: ['sen', 'maj'], need: 'any',
      en: 'How does it behave in use?',      sr: 'Kako se ponaša u upotrebi?' },

    { k: 'rastav',  l: 'use',  src: ['obi', 'arh'], need: 'any',
      en: 'Can the parts come apart?',       sr: 'Mogu li se delovi rastaviti?' },
    { k: 'dokaz',   l: 'use',  src: ['lab'], need: 'any',
      en: 'Is there proof of the properties?', sr: 'Ima li dokaza o svojstvima?' },
    { k: 'dozvola', l: 'use',  src: ['reg', 'lab'], need: 'all',
      en: 'May it formally be reused?',      sr: 'Sme li formalno da se upotrebi ponovo?' }
  ];

  /* ---------- five objects on the pilot map ----------
     kind 'real'     — a public landmark; values are general literature, class S,
                       which is exactly why a passport cannot rest on them
     kind 'teaching' — a case constructed for class; every value is authored,
                       and the evidence class describes the scenario, not a report */
  var SITES = [
    {
      k: 'albanija', kind: 'real', lon: 20.4596, lat: 44.8140,
      en: 'Palata Albanija, Terazije', sr: 'Palata Albanija, Terazije',
      note: {
        en: 'A public landmark. Every value below is general literature, not a primary record.',
        sr: 'Javni reper. Svaka vrednost ispod je opšta literatura, ne primarni zapis.'
      },
      v: {
        naziv:   ['Palata Albanija', 'S'],
        godina:  ['1940', 'S'],
        gabarit: [{ en: 'h = 53 m, approximately; no outline in this record',
                    sr: 'h = 53 m, približno; osnova nije u ovom zapisu' }, 'S'],
        etaze:   ['13', 'S'],
        konstr:  [{ en: 'reinforced concrete skeleton', sr: 'armiranobetonski skelet' }, 'S'],
        projekt: [{ en: 'attribution contested: the literature separates competition authors from executing architects',
                    sr: 'autorstvo sporno: literatura razdvaja autore konkursa od arhitekata izvođenja' }, 'S']
      }
    },
    {
      k: 'beogradjanka', kind: 'real', lon: 20.4639, lat: 44.8063,
      en: 'Palata Beograd, known as Beograđanka', sr: 'Palata Beograd, „Beograđanka”',
      note: {
        en: 'A public landmark. Published height figures differ between sources.',
        sr: 'Javni reper. Objavljeni podaci o visini se razlikuju među izvorima.'
      },
      v: {
        naziv:   ['Palata Beograd', 'S'],
        godina:  ['1974', 'S'],
        gabarit: [{ en: 'h = 101 m, approximately; published figures differ',
                    sr: 'h = 101 m, približno; objavljeni podaci se razlikuju' }, 'S'],
        etaze:   ['24', 'S'],
        konstr:  [{ en: 'reinforced concrete core and frame',
                    sr: 'armiranobetonsko jezgro i okvir' }, 'S'],
        fasada:  [{ en: 'dark glazed curtain wall', sr: 'tamno zastakljena zavesna fasada' }, 'S'],
        projekt: ['Branko Pešić', 'S']
      }
    },
    {
      k: 'msu', kind: 'real', lon: 20.4388, lat: 44.8186,
      en: 'Museum of Contemporary Art, Ušće', sr: 'Muzej savremene umetnosti, Ušće',
      note: {
        en: 'An awarded building with a famous outside and an almost empty passport.',
        sr: 'Nagrađena zgrada sa poznatim spoljnim izgledom i gotovo praznim pasošem.'
      },
      v: {
        naziv:   [{ en: 'Museum of Contemporary Art', sr: 'Muzej savremene umetnosti' }, 'S'],
        godina:  ['1965', 'S'],
        fasada:  [{ en: 'white marble cladding', sr: 'obloga od belog mermera' }, 'S'],
        projekt: ['Ivan Antić, Ivanka Raspopović', 'S']
      }
    },
    {
      k: 'lamela', kind: 'teaching', lon: 20.4030, lat: 44.8060,
      en: 'Lamella in a large-panel system, New Belgrade',
      sr: 'Lamela u krupnopanelnom sistemu, Novi Beograd',
      note: {
        en: 'Constructed for class. It stands for the ordinary building, which is most of the city.',
        sr: 'Konstruisano za čas. Stoji za običnu zgradu, a to je veći deo grada.'
      },
      v: {
        naziv:   [{ en: 'Lamella, panel system', sr: 'Lamela, panelni sistem' }, 'I'],
        parcela: [{ en: 'constructed for class: 1234/5', sr: 'konstruisano za čas: 1234/5' }, 'I'],
        godina:  ['1974', 'I'],
        gabarit: ['62 x 12 m, h 18 m', 'I'],
        etaze:   ['6', 'I'],
        odstup:  [{ en: 'panel joints 15 mm wider than drawn, measured at four joints',
                    sr: 'spojevi panela 15 mm širi od nacrtanog, merenje na četiri spoja' }, 'M'],
        konstr:  [{ en: 'large prefabricated concrete panels',
                    sr: 'krupni prefabrikovani betonski paneli' }, 'I'],
        fasada:  [{ en: 'panel, 4 cm mineral wool, render',
                    sr: 'panel, 4 cm mineralne vune, malter' }, 'I'],
        kolic:   [{ en: '1 900 t concrete and 95 t steel, approximately, from drawings and density',
                    sr: 'oko 1 900 t betona i 95 t čelika, iz crteža i gustine' }, 'I'],
        izvod:   [{ en: 'plant stamp found on three panels',
                    sr: 'pečat fabrike nađen na tri panela' }, 'M'],
        nosiv:   [{ en: 'no visible structural damage; joint sealant has failed',
                    sr: 'bez vidljivih oštećenja konstrukcije; kit u spojevima je propao' }, 'M'],
        opasne:  [{ en: 'asbestos cement sheet on the roof, sample confirmed',
                    sr: 'azbestcementna ploča na krovu, uzorak potvrdio' }, 'M'],
        ponasa:  [{ en: 'no meter record; occupants report cold north rooms',
                    sr: 'nema zapisa brojila; stanari navode hladne sobe sa severne strane' }, 'O'],
        rastav:  [{ en: 'panels bolted, joints grouted: only partly separable',
                    sr: 'paneli na zavrtnjima, spojevi zaliveni: samo delimično rastavljivi' }, 'M'],
        dokaz:   [{ en: 'two cores tested, class about C25/30',
                    sr: 'dva uzorka ispitana, klasa oko C25/30' }, 'M']
      }
    },
    {
      k: 'magacin', kind: 'teaching', lon: 20.4600, lat: 44.8290,
      en: 'Riverside warehouse, awaiting demolition, Dorćol',
      sr: 'Magacin na obali, pred rušenjem, Dorćol',
      note: {
        en: 'Constructed for class. The circular case: the building worth reusing is the one with no file.',
        sr: 'Konstruisano za čas. Cirkularni slučaj: zgrada koju vredi ponovo upotrebiti je ona bez dosijea.'
      },
      v: {
        naziv:   [{ en: 'Riverside warehouse', sr: 'Magacin na obali' }, 'I'],
        parcela: [{ en: 'constructed for class: 7788/1', sr: 'konstruisano za čas: 7788/1' }, 'I'],
        godina:  [{ en: '1951, extended 1968', sr: '1951, dograđen 1968' }, 'I'],
        gabarit: ['84 x 22 m, h 9,5 m', 'I'],
        etaze:   ['1', 'I'],
        odstup:  [{ en: 'the 1968 extension is missing from the archive set',
                    sr: 'dogradnja iz 1968. ne postoji u arhivskom setu' }, 'M'],
        konstr:  [{ en: 'solid brick walls, timber trusses, one concrete slab from 1968',
                    sr: 'zidovi od pune opeke, drvene krovne rešetke, jedna betonska ploča iz 1968.' }, 'I'],
        fasada:  [{ en: 'solid brick, 38 cm, no insulation',
                    sr: 'puna opeka, 38 cm, bez izolacije' }, 'I'],
        kolic:   [{ en: '310 000 bricks and 46 m3 timber, approximately, counted from the survey',
                    sr: 'oko 310 000 opeka i 46 m3 drveta, iz premera' }, 'I'],
        izvod:   [{ en: 'spoken: a local builders cooperative, no written record',
                    sr: 'usmeno: lokalna građevinska zadruga, bez pisanog zapisa' }, 'O'],
        izvor:   [{ en: 'stamps of two brickworks, read off the wall',
                    sr: 'pečati dve ciglane, pročitani sa zida' }, 'M'],
        nosiv:   [{ en: 'trusses sound; two members rotted where they bear on the wall',
                    sr: 'rešetke zdrave; dva elementa propala na nalegu uz zid' }, 'M'],
        opasne:  [{ en: 'lead paint on the steel doors', sr: 'olovna boja na čeličnim vratima' }, 'M'],
        rastav:  [{ en: 'brick laid in lime mortar: it comes out by hand',
                    sr: 'opeka u krečnom malteru: vadi se rukom' }, 'M'],
        dokaz:   [{ en: 'twelve bricks tested, mean 15 N/mm2',
                    sr: 'dvanaest opeka ispitano, srednja vrednost 15 N/mm2' }, 'M']
      }
    }
  ];

  var ALL_SOURCES = SOURCES.map(function (s) { return s.k; });
  var PRIMARY = ['D', 'M'];

  /* ---------- the projection, written out rather than assumed ----------
     Equirectangular, scaled at the latitude of the frame. One unit of the
     drawing is the same number of metres horizontally and vertically. */
  var FRAME = { lon0: 20.385, lon1: 20.481, lat0: 44.843, lat1: 44.795, w: 640, h: 450 };

  function metresPerUnit() {
    var latMid = (FRAME.lat0 + FRAME.lat1) / 2;
    return {
      x: (FRAME.lon1 - FRAME.lon0) * 111320 * Math.cos(latMid * Math.PI / 180) / FRAME.w,
      y: (FRAME.lat0 - FRAME.lat1) * 111132 / FRAME.h
    };
  }
  function project(lon, lat) {
    return {
      x: (lon - FRAME.lon0) / (FRAME.lon1 - FRAME.lon0) * FRAME.w,
      y: (FRAME.lat0 - lat) / (FRAME.lat0 - FRAME.lat1) * FRAME.h
    };
  }

  /* ---------- hand-placed river centre lines ----------
     Two polylines, placed by eye from the shape of the city. Good to a few
     hundred metres. This is orientation, not a survey base. */
  var RIVERS = {
    sava: [[20.392, 44.787], [20.404, 44.792], [20.415, 44.797], [20.427, 44.804],
           [20.436, 44.812], [20.443, 44.819], [20.4495, 44.8243]],
    dunav: [[20.388, 44.856], [20.404, 44.850], [20.420, 44.843], [20.436, 44.833],
            [20.4495, 44.8243], [20.462, 44.8215], [20.476, 44.824], [20.490, 44.830]]
  };
  var CONFLUENCE = [20.4495, 44.8243];

  /* ---------- the one computation this instrument makes ---------- */
  function answerable(field, sources) {
    var have = 0, i;
    for (i = 0; i < field.src.length; i++) if (sources.indexOf(field.src[i]) >= 0) have++;
    return field.need === 'all' ? have === field.src.length : have > 0;
  }

  function fieldsOf(layer) {
    if (!layer || layer === 'all') return FIELDS.slice();
    return FIELDS.filter(function (f) { return f.l === layer; });
  }

  /* Three states, and they are not the same problem:
       known   — a source is at hand and the answer exists
       blocked — the question has a source, you have not got it yet
       lost    — the source is at hand and nobody ever wrote the answer down
     More effort fixes 'blocked'. Nothing fixes 'lost'. */
  function assess(site, sources, layer) {
    var fields = fieldsOf(layer);
    var out = { total: fields.length, known: 0, blocked: 0, lost: 0, primary: 0, rows: [] };
    fields.forEach(function (f) {
      var rec = Object.prototype.hasOwnProperty.call(site.v, f.k) ? site.v[f.k] : null;
      var can = answerable(f, sources);
      var state = !can ? 'blocked' : (rec ? 'known' : 'lost');
      out[state]++;
      if (state === 'known' && PRIMARY.indexOf(rec[1]) >= 0) out.primary++;
      out.rows.push({
        field: f, state: state,
        value: rec ? rec[0] : null,
        evidence: rec ? rec[1] : null,
        missing: f.src.filter(function (s) { return sources.indexOf(s) < 0; })
      });
    });
    return out;
  }

  /* Which single source you have not selected would answer the most questions? */
  function bestNextSource(site, sources, layer) {
    var base = assess(site, sources, layer).known, best = null;
    ALL_SOURCES.forEach(function (s) {
      if (sources.indexOf(s) >= 0) return;
      var gain = assess(site, sources.concat([s]), layer).known - base;
      if (gain > 0 && (!best || gain > best.gain)) best = { source: s, gain: gain };
    });
    return best;
  }

  var PRESETS = {
    phone:    ['reg'],
    visit:    ['reg', 'obi', 'maj'],
    forensic: ALL_SOURCES.slice()
  };

  return {
    LAYERS: LAYERS, SOURCES: SOURCES, FIELDS: FIELDS, SITES: SITES,
    ALL_SOURCES: ALL_SOURCES, PRESETS: PRESETS, PRIMARY: PRIMARY,
    FRAME: FRAME, RIVERS: RIVERS, CONFLUENCE: CONFLUENCE,
    project: project, metresPerUnit: metresPerUnit,
    answerable: answerable, fieldsOf: fieldsOf, assess: assess,
    bestNextSource: bestNextSource,
    site: function (k) { return SITES.filter(function (s) { return s.k === k; })[0] || null; }
  };
}));
