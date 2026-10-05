/* Chain of custody — how much of what a building knows survives to the end.
   Lanac porekla — koliko od onoga što zgrada zna preživi do kraja.

   Pure module: no DOM, no network, no dependencies. The home page and the
   proof gate call the same functions, so a number on screen and a number in
   the test cannot drift apart.

   WHAT THIS IS: an authored list of twenty-six facts that a real building
   produces, each tagged with who makes it, which passport layer it belongs
   to, what carries it, and what it would cost to write it down. The
   arithmetic over that list is exact. The list itself is a teaching model,
   not a measurement of real projects — the page says so on screen.

   Evidence carriers: mark  written into the material itself (stamp, brand)
                      doc   a document somebody files
                      oral  spoken, held only in the head of whoever did it
*/
(function (root, factory) {
  'use strict';
  var M = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else root.LanacModel = M;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------- the same six layers the passport pilot uses ---------- */
  var LAYERS = [
    { k: 'id',   en: 'Identity',  sr: 'Identitet' },
    { k: 'geo',  en: 'Geometry',  sr: 'Geometrija' },
    { k: 'mat',  en: 'Material',  sr: 'Materijal' },
    { k: 'org',  en: 'Origin',    sr: 'Poreklo' },
    { k: 'cond', en: 'Condition', sr: 'Stanje' },
    { k: 'use',  en: 'Reuse',     sr: 'Ponovna upotreba' }
  ];

  var CARRIERS = [
    { k: 'mark', en: 'in the material',  sr: 'u samom materijalu',
      note: { en: 'a stamp, a brand, a mark that outlives every file',
              sr: 'pečat, žig, oznaka koja nadživi svaki fajl' } },
    { k: 'doc',  en: 'in a document',    sr: 'u dokumentu',
      note: { en: 'filed somewhere by somebody, findable only if kept',
              sr: 'neko ga negde zavede, nađivo samo ako se čuva' } },
    { k: 'oral', en: 'only spoken',      sr: 'samo usmeno',
      note: { en: 'in the head of the person who did the work',
              sr: 'u glavi osobe koja je radila posao' } }
  ];

  /* ---------- ten hands the data passes through ----------
     late  = this actor is still present when the building is finished
     yours = you can require it by contract on your own project
     ev    = the evidence class you typically get from this actor
             D document · M measured · O spoken · S secondary literature */
  var STATIONS = [
    { k: 'kamenolom', n: '01', late: false, yours: false, ev: 'D',
      en: 'Quarry and pit', sr: 'Kamenolom i majdan',
      role: { en: 'Where the stone, sand and gravel physically come out of the ground.',
              sr: 'Mesto gde kamen, pesak i šljunak fizički izlaze iz zemlje.' },
      reach: { en: 'Delivery notes held by whoever bought the material; the operating permit is public.',
               sr: 'Otpremnice kod onoga ko je kupio materijal; dozvola za eksploataciju je javna.' } },
    { k: 'fabrika', n: '02', late: false, yours: false, ev: 'D',
      en: 'Brickworks, plant, sawmill', sr: 'Ciglana, fabrika, strugara',
      role: { en: 'Turns raw material into a product with a name, a batch and a declared class.',
              sr: 'Pretvara sirovinu u proizvod sa imenom, serijom i deklarisanom klasom.' },
      reach: { en: 'Declaration of performance, the stamp on the product itself, the maker’s catalogue.',
               sr: 'Izjava o svojstvima, žig na samom proizvodu, katalog proizvođača.' } },
    { k: 'ispitivanje', n: '03', late: false, yours: false, ev: 'M',
      en: 'Factory testing', sr: 'Fabričko ispitivanje',
      role: { en: 'Measures a sample and turns a material into a number you are allowed to calculate with.',
              sr: 'Izmeri uzorak i pretvori materijal u broj sa kojim smeš da računaš.' },
      reach: { en: 'Test reports, accredited laboratory registers, the certificate behind the class.',
               sr: 'Izveštaji o ispitivanju, registri akreditovanih laboratorija, sertifikat iza klase.' } },
    { k: 'prevoz', n: '04', late: false, yours: false, ev: 'D',
      en: 'Transporter', sr: 'Prevoznik',
      role: { en: 'The only actor who knows what actually arrived, when, and in what shape.',
              sr: 'Jedini učesnik koji zna šta je stvarno stiglo, kada i u kakvom stanju.' },
      reach: { en: 'Waybills and site delivery log; damage is usually settled by a phone call.',
               sr: 'Tovarni listovi i gradilišna knjiga prijema; šteta se obično reši telefonom.' } },
    { k: 'stovariste', n: '05', late: false, yours: false, ev: 'O',
      en: 'Builders’ merchant, depot', sr: 'Stovarište',
      role: { en: 'Where batches from different days and different plants quietly become one pile.',
              sr: 'Mesto gde serije iz različitih dana i različitih pogona tiho postanu jedna gomila.' },
      reach: { en: 'An invoice says what you bought; nothing says which batch you carried away.',
               sr: 'Račun kaže šta si kupio; ništa ne kaže koju si seriju odneo.' } },
    { k: 'projektant', n: '06', late: true, yours: true, ev: 'D',
      en: 'Designer', sr: 'Projektant',
      role: { en: 'Writes down the intent: what each element is for and what may replace it.',
              sr: 'Zapisuje nameru: čemu svaki element služi i čime sme da se zameni.' },
      reach: { en: 'The design set, the specification, the model file — if anyone kept the native format.',
               sr: 'Projekat, specifikacija, model — ako je iko sačuvao izvorni format.' } },
    { k: 'inzenjer', n: '07', late: true, yours: true, ev: 'D',
      en: 'Engineer', sr: 'Inženjer',
      role: { en: 'Carries the assumption: which load, which safety factor, which deviation was accepted.',
              sr: 'Nosi pretpostavku: koje opterećenje, koji koeficijent sigurnosti, koje je odstupanje prihvaćeno.' },
      reach: { en: 'Structural calculation, site diary, the minutes where a deviation was signed off.',
               sr: 'Statički proračun, građevinski dnevnik, zapisnik u kome je odstupanje potpisano.' } },
    { k: 'majstor', n: '08', late: true, yours: true, ev: 'O',
      en: 'Builder on site', sr: 'Majstor na gradilištu',
      role: { en: 'Knows what was really built, and is the last person to see what is now hidden.',
              sr: 'Zna šta je stvarno izvedeno i poslednji je koji vidi ono što je sada skriveno.' },
      reach: { en: 'Ask, while the people are still reachable. One photo before the finish closes it.',
               sr: 'Pitaj, dok su ljudi još dostupni. Jedna fotografija pre nego što obrada sve zatvori.' } },
    { k: 'primopredaja', n: '09', late: true, yours: true, ev: 'D',
      en: 'Acceptance and handover', sr: 'Primopredaja',
      role: { en: 'The one moment when the state also keeps a copy, and the only paper that reliably outlives the project.',
              sr: 'Jedini trenutak kada i država zadrži primerak, i jedini papir koji pouzdano nadživi projekat.' },
      reach: { en: 'Permit and as-built set in the public register; ask the authority, not the contractor.',
               sr: 'Dozvola i izvedeno stanje u javnom registru; traži od organa, ne od izvođača.' } },
    { k: 'vlasnik', n: '10', late: true, yours: true, ev: 'O',
      en: 'Owner and occupant', sr: 'Vlasnik i korisnik',
      role: { en: 'Over decades changes more of the building than anyone who designed it.',
              sr: 'Kroz decenije promeni više na zgradi nego iko ko ju je projektovao.' },
      reach: { en: 'Maintenance invoices, building council minutes, the memory of whoever lives there.',
               sr: 'Računi za održavanje, zapisnici skupštine zgrade, sećanje onoga ko tu živi.' } }
  ];

  /* ---------- twenty-six facts a building produces ----------
     st   station that creates it   l   passport layer
     car  what carries it today     arh kept by a public authority
     cost 0 already written down, only has to be carried on
          1 one line or one photo by someone already on the job
          2 someone outside your contract has to change how they work */
  var FACTS = [
    { k: 'q-majdan', st: 'kamenolom', l: 'org', car: 'doc', cost: 0,
      en: 'Which quarry or pit it came out of', sr: 'Iz kog kamenoloma ili majdana je izašlo' },
    { k: 'q-sloj', st: 'kamenolom', l: 'org', car: 'oral', cost: 2,
      en: 'Which seam, and what the rock actually is', sr: 'Koji sloj, i koja je to zapravo stena' },
    { k: 'q-datum', st: 'kamenolom', l: 'org', car: 'doc', cost: 0,
      en: 'When it was extracted', sr: 'Kada je izvađeno' },

    { k: 'p-pogon', st: 'fabrika', l: 'org', car: 'mark', cost: 0,
      en: 'Which plant and which line made it', sr: 'Koji pogon i koja linija su ga napravili' },
    { k: 'p-serija', st: 'fabrika', l: 'id', car: 'mark', cost: 0,
      en: 'The batch number pressed into the product', sr: 'Broj serije utisnut u proizvod' },
    { k: 'p-sastav', st: 'fabrika', l: 'mat', car: 'doc', cost: 1,
      en: 'The recipe: mixture, species, drying', sr: 'Receptura: mešavina, vrsta drveta, sušenje' },
    { k: 'p-klasa', st: 'fabrika', l: 'mat', car: 'doc', cost: 0,
      en: 'The declared class and performance', sr: 'Deklarisana klasa i svojstva' },

    { k: 't-ispit', st: 'ispitivanje', l: 'mat', car: 'doc', cost: 0,
      en: 'The strength actually measured on the batch', sr: 'Čvrstoća stvarno izmerena na seriji' },
    { k: 't-uzorak', st: 'ispitivanje', l: 'mat', car: 'oral', cost: 2,
      en: 'Which sample off which pallet stands behind that number', sr: 'Koji uzorak sa koje palete stoji iza tog broja' },

    { k: 'tr-kolicina', st: 'prevoz', l: 'id', car: 'doc', cost: 0,
      en: 'How much actually arrived, and when', sr: 'Koliko je stvarno stiglo, i kada' },
    { k: 'tr-steta', st: 'prevoz', l: 'cond', car: 'oral', cost: 1,
      en: 'What was damaged on the way', sr: 'Šta je oštećeno na putu' },

    { k: 'st-mesanje', st: 'stovariste', l: 'org', car: 'oral', cost: 2,
      en: 'Which batches ended up in the same pile', sr: 'Koje su serije završile u istoj gomili' },
    { k: 'st-uslovi', st: 'stovariste', l: 'cond', car: 'oral', cost: 1,
      en: 'How long and in what conditions it was stored', sr: 'Koliko dugo i u kakvim uslovima je stajalo' },

    { k: 'pr-namera', st: 'projektant', l: 'use', car: 'doc', cost: 0,
      en: 'What this element is supposed to do', sr: 'Šta ovaj element treba da radi' },
    { k: 'pr-geo', st: 'projektant', l: 'geo', car: 'doc', cost: 0,
      en: 'The designed dimensions and position', sr: 'Projektovane dimenzije i položaj' },
    { k: 'pr-zamena', st: 'projektant', l: 'use', car: 'doc', cost: 1,
      en: 'Which substitutions the design allows', sr: 'Koje zamene projekat dozvoljava' },

    { k: 'in-racun', st: 'inzenjer', l: 'use', car: 'doc', cost: 0,
      en: 'The calculation and the assumption under it', sr: 'Proračun i pretpostavka ispod njega' },
    { k: 'in-odstup', st: 'inzenjer', l: 'cond', car: 'doc', cost: 1,
      en: 'What was accepted as a deviation', sr: 'Šta je prihvaćeno kao odstupanje' },

    { k: 'maj-izvedeno', st: 'majstor', l: 'geo', car: 'oral', cost: 1,
      en: 'What was really built where the drawing says otherwise', sr: 'Šta je stvarno izvedeno tamo gde crtež kaže drugačije' },
    { k: 'maj-postupak', st: 'majstor', l: 'mat', car: 'oral', cost: 1,
      en: 'How it was done on site: mix, curing, fastening', sr: 'Kako je rađeno na licu mesta: mešavina, nega, pričvršćenje' },
    { k: 'maj-skriveno', st: 'majstor', l: 'geo', car: 'oral', cost: 1,
      en: 'What is now behind the finish', sr: 'Šta je sada iza završne obrade' },

    { k: 'pp-izvedeno', st: 'primopredaja', l: 'geo', car: 'doc', cost: 0, arh: true,
      en: 'The as-built set filed at acceptance', sr: 'Projekat izvedenog stanja predat na primopredaji' },
    { k: 'pp-dozvola', st: 'primopredaja', l: 'id', car: 'doc', cost: 0, arh: true,
      en: 'The permit and the papers the authority keeps', sr: 'Dozvola i papiri koje čuva nadležni organ' },

    { k: 'vl-izmene', st: 'vlasnik', l: 'geo', car: 'oral', cost: 1,
      en: 'Every change made during use', sr: 'Svaka izmena napravljena tokom korišćenja' },
    { k: 'vl-kvar', st: 'vlasnik', l: 'cond', car: 'oral', cost: 1,
      en: 'Faults, leaks and repairs', sr: 'Kvarovi, prokišnjavanja i popravke' },
    { k: 'vl-odrzavanje', st: 'vlasnik', l: 'cond', car: 'doc', cost: 1,
      en: 'The maintenance that was actually carried out', sr: 'Održavanje koje je stvarno izvedeno' }
  ];

  /* ---------- the three settings a class can argue about ---------- */
  var REGIMES = [
    { k: 'danas', max: -1,
      en: 'Today’s practice', sr: 'Današnja praksa',
      note: { en: 'Nobody keeps one record. Each carrier decides on its own how long a fact lives.',
              sr: 'Niko ne vodi jedan zapis. Svaki nosilac sam odlučuje koliko jedna činjenica živi.' } },
    { k: 'lako', max: 1,
      en: 'Passport, small effort', sr: 'Pasoš, mali trud',
      note: { en: 'Everything already written down is carried on, plus one line or one photo from people already on the job.',
              sr: 'Sve što je već zapisano se prenosi, plus jedna rečenica ili jedna fotografija od ljudi koji su ionako na poslu.' } },
    { k: 'pun', max: 2,
      en: 'Passport, full', sr: 'Pasoš, pun',
      note: { en: 'Also the facts that only exist if someone outside your contract changes how they work.',
              sr: 'I one činjenice koje postoje samo ako neko van tvog ugovora promeni način rada.' } }
  ];

  var SCOPES = [
    { k: 'tvoji', en: 'Only who you pay', sr: 'Samo oni koje plaćaš',
      note: { en: 'Designer, engineer, builder, acceptance, owner — the five you can bind by contract.',
              sr: 'Projektant, inženjer, majstor, primopredaja, vlasnik — petoro koje možeš da obavežeš ugovorom.' } },
    { k: 'svi', en: 'The whole chain', sr: 'Ceo lanac',
      note: { en: 'Also quarry, plant, testing, transport and depot — who answer to the market, not to you.',
              sr: 'I kamenolom, fabrika, ispitivanje, prevoz i stovarište — koji odgovaraju tržištu, ne tebi.' } }
  ];

  var POINTS = [
    { k: 'zid', en: 'in the finished wall', sr: 'u gotovom zidu' },
    { k: 'kraj', en: 'at disassembly, decades later', sr: 'pri rastavljanju, decenijama kasnije' }
  ];

  /* ---------- the rule that decides, in one place ---------- */
  var ST = {};
  STATIONS.forEach(function (s) { ST[s.k] = s; });
  var FK = {};
  FACTS.forEach(function (f) { FK[f.k] = f; });

  function norm(o) {
    o = o || {};
    var r = REGIMES.some(function (x) { return x.k === o.regime; }) ? o.regime : 'danas';
    var s = SCOPES.some(function (x) { return x.k === o.scope; }) ? o.scope : 'svi';
    return { regime: r, scope: s, predaja: o.predaja !== false };
  }

  /* Is this fact written into the passport at all? */
  function entered(fact, opts) {
    var o = norm(opts), r = REGIMES.filter(function (x) { return x.k === o.regime; })[0];
    if (r.max < 0) return false;
    if (fact.cost > r.max) return false;
    if (o.scope === 'tvoji' && !ST[fact.st].yours) return false;
    return true;
  }

  /* Without a passport entry, the carrier alone decides. */
  function carried(fact, point) {
    if (fact.car === 'mark') return true;
    if (fact.car === 'doc') return point === 'zid' ? true : !!fact.arh;
    return point === 'zid' ? ST[fact.st].late : false;   // oral
  }

  /* Three readable states, and the difference between them is the lesson. */
  function state(fact, point, opts) {
    var o = norm(opts);
    if (entered(fact, o) && (point === 'zid' || o.predaja)) return 'pasos';
    return carried(fact, point) ? 'nosilac' : 'izgubljen';
  }

  function alive(fact, point, opts) { return state(fact, point, opts) !== 'izgubljen'; }

  /* ---------- the arithmetic the page prints ---------- */
  function count(opts) {
    var o = norm(opts);
    var upisa = FACTS.filter(function (f) { return entered(f, o); }).length;
    var zid = FACTS.filter(function (f) { return alive(f, 'zid', o); }).length;
    var kraj = FACTS.filter(function (f) { return alive(f, 'kraj', o); }).length;
    var perStation = STATIONS.map(function (s) {
      var mine = FACTS.filter(function (f) { return f.st === s.k; });
      return {
        k: s.k,
        created: mine.length,
        zid: mine.filter(function (f) { return alive(f, 'zid', o); }).length,
        kraj: mine.filter(function (f) { return alive(f, 'kraj', o); }).length
      };
    });
    var perLayer = LAYERS.map(function (L) {
      var mine = FACTS.filter(function (f) { return f.l === L.k; });
      return {
        k: L.k,
        total: mine.length,
        zid: mine.filter(function (f) { return alive(f, 'zid', o); }).length,
        kraj: mine.filter(function (f) { return alive(f, 'kraj', o); }).length
      };
    });
    return {
      total: FACTS.length, upisa: upisa, zid: zid, kraj: kraj,
      perStation: perStation, perLayer: perLayer,
      lost: FACTS.filter(function (f) { return !alive(f, 'kraj', o); }).map(function (f) { return f.k; })
    };
  }

  /* Which hands leave nothing behind, and which layer ends up thinnest.
     Ties resolve by chain order and by layer order, so the answer is stable. */
  function silentStations(opts) {
    return count(opts).perStation
      .filter(function (r) { return r.kraj === 0; })
      .map(function (r) { return r.k; });
  }
  function weakestLayer(opts) {
    var c = count(opts), best = null;
    c.perLayer.forEach(function (r) {
      var share = r.kraj / r.total;
      if (!best || share < best.share) best = { k: r.k, share: share, kraj: r.kraj, total: r.total };
    });
    return best;
  }

  return {
    LAYERS: LAYERS, CARRIERS: CARRIERS, STATIONS: STATIONS, FACTS: FACTS,
    REGIMES: REGIMES, SCOPES: SCOPES, POINTS: POINTS,
    station: function (k) { return ST[k]; },
    fact: function (k) { return FK[k]; },
    norm: norm, entered: entered, carried: carried, state: state, alive: alive,
    count: count, silentStations: silentStations, weakestLayer: weakestLayer
  };
}));
