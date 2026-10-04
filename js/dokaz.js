/* dokaz.js — "proveri sam": provere iz dokazi/verify.js i verify2.js, uzivo u browseru.
   Bez zavisnosti. Svaka provera sama sudi (polje ok), pa PAD je stvaran pad, ne izostanak greske.
   Isti fajl pokrece i node: `node dokazi/dokaz_node.js` (ucitava ovaj fajl). */
(function (global) {
  'use strict';

  var P = [];
  function add(blok, id, tvrdnja, run) { P.push({ blok: blok, id: id, tvrdnja: tvrdnja, run: run }); }
  function blizu(a, b, eps) { return Math.abs(a - b) <= (eps === undefined ? 1e-9 : eps); }

  /* ---------- Blok 1: binarni svet ---------- */
  add(1, 'ASCII', 'A = 65 = 0x41 = 01000001', function () {
    var c = 'A'.charCodeAt(0);
    var got = c + ' = 0x' + c.toString(16).toUpperCase() + ' = ' + c.toString(2).padStart(8, '0');
    return { got: got, want: '65 = 0x41 = 01000001', ok: got === '65 = 0x41 = 01000001' };
  });
  add(1, 'UTF-8', 'slovo c sa kvacicom (U+010D) zauzima 2 bajta: C4 8D', function () {
    var b = new TextEncoder().encode('č'), h = [];
    for (var i = 0; i < b.length; i++) h.push(b[i].toString(16).toUpperCase());
    var got = b.length + ' bajta: ' + h.join(' ');
    return { got: got, want: '2 bajta: C4 8D', ok: got === '2 bajta: C4 8D' };
  });
  add(1, 'IEEE 754', '0.1 + 0.2 nije 0.3 — ni u jednom CAD-u na svetu', function () {
    var s = 0.1 + 0.2;
    return { got: String(s), want: 'razlikuje se od 0.3', ok: s !== 0.3 && blizu(s, 0.3, 1e-15) };
  });
  add(1, 'float32', 'koordinata u mesh-u (float32): 0.1 postaje 0.10000000149011612', function () {
    var f = new Float32Array(1); f[0] = 0.1;
    return { got: String(f[0]), want: '0.10000000149011612', ok: String(f[0]) === '0.10000000149011612' };
  });
  add(1, 'zaokruzivanje', '1.005 na dve decimale daje 1.00, jer fp vidi 1.00499...', function () {
    var r = (1.005).toFixed(2);
    return { got: r, want: '1.00', ok: r === '1.00' };
  });
  add(1, 'binarni STL', 'STL sa jednim trouglom = 134 B (80 B zaglavlje + 4 B brojac + 50 B trougao)', function () {
    var buf = new ArrayBuffer(84 + 50), dv = new DataView(buf);
    dv.setUint32(80, 1, true);
    var n = dv.getUint32(80, true);
    var got = buf.byteLength + ' B, trouglova = ' + n;
    return { got: got, want: '134 B, trouglova = 1', ok: buf.byteLength === 134 && n === 1 };
  });

  /* ---------- Blok 2: algoritam ---------- */
  add(2, 'slojevi', 'stub 2000 mm na sloju 0.3 mm: 6667 slojeva, a ne 6666.67 — algoritam zaokruzuje gore', function () {
    var a = Math.ceil(2000 / 0.2), b = Math.ceil(2000 / 0.3);
    return { got: '0.2 mm -> ' + a + ' slojeva | 0.3 mm -> ' + b + ' slojeva',
             want: '10000 i 6667', ok: a === 10000 && b === 6667 };
  });
  add(2, 'ekstruzija', 'obod 640 mm, sloj 0.2 mm, dizna 0.4 mm: 21.29 mm filamenta 1.75 mm', function () {
    var V = 640 * 0.2 * 0.4;                     /* mm^3 materijala na stazi */
    var A = Math.PI * 0.875 * 0.875;             /* presek filamenta 1.75 mm */
    var E = V / A;
    return { got: V.toFixed(2) + ' mm3 = ' + E.toFixed(2) + ' mm filamenta',
             want: '51.20 mm3 = 21.29 mm', ok: blizu(V, 51.2, 1e-9) && blizu(E, 21.29, 0.01) };
  });
  add(2, 'parser G-koda', 'masina ne vidi oblik, vidi parove slovo+broj: G1 X10.5 Y-3 E0.42 F1200', function () {
    var red = 'G1 X10.5 Y-3 E0.42 F1200', par = {};
    red.split(/\s+/).forEach(function (t) { par[t[0]] = t.length > 1 ? parseFloat(t.slice(1)) : 1; });
    var got = 'X = ' + par.X + ', Y = ' + par.Y + ', E = ' + par.E + ', F = ' + par.F;
    return { got: got, want: 'X = 10.5, Y = -3, E = 0.42, F = 1200',
             ok: par.X === 10.5 && par.Y === -3 && par.E === 0.42 && par.F === 1200 };
  });
  add(2, 'redosled nije zamenjiv', 'ista 4 temena, drugi redosled: 300 mm naspram 382.84 mm putanje', function () {
    var P = { A: [0, 0], B: [100, 0], C: [100, 100], D: [0, 100] };
    function duzina(red) {
      var s = 0, i;
      for (i = 1; i < red.length; i++) {
        var a = P[red[i - 1]], b = P[red[i]];
        s += Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
      }
      return s;
    }
    var d1 = duzina(['A', 'B', 'C', 'D']), d2 = duzina(['A', 'C', 'B', 'D']);
    return { got: 'A-B-C-D = ' + d1.toFixed(2) + ' mm | A-C-B-D = ' + d2.toFixed(2) + ' mm',
             want: '300.00 i 382.84', ok: blizu(d1, 300, 1e-9) && blizu(d2, 382.84, 0.01) };
  });
  add(2, 'determinizam', 'isti ulaz dva puta daje identican G-kod; jedna promenjena cifra menja sumu', function () {
    function slajsuj(h) {
      var s = '', i;
      for (i = 0; i < 20; i++) s += 'G1 X' + (i * 5).toFixed(2) + ' Z' + (h * (i + 1)).toFixed(2) + '\n';
      return s;
    }
    function suma(t) {                            /* FNV-1a, 32 bita */
      var x = 0x811c9dc5, i;
      for (i = 0; i < t.length; i++) { x ^= t.charCodeAt(i); x = (x * 0x01000193) >>> 0; }
      return x.toString(16);
    }
    var a = suma(slajsuj(0.2)), b = suma(slajsuj(0.2)), cc = suma(slajsuj(0.21));
    return { got: 'dva puta 0.2 -> ' + a + ' i ' + b + ' | 0.21 -> ' + cc,
             want: 'prve dve iste, treca drugacija', ok: a === b && a !== cc };
  });

  /* ---------- Blok 3: geometrija ---------- */
  add(3, 'diskretizacija', 'pravilni 24-ugao u krugu R = 1 m: greska strelice je oko 8.6 mm', function () {
    var n = 24, sag = (1 - Math.cos(Math.PI / n)) * 1000;
    return { got: sag.toFixed(2) + ' mm', want: 'izmedju 8 i 9 mm', ok: sag > 8 && sag < 9 };
  });
  add(3, 'Euler', 'kocka kao B-rep: V - E + F = 2 (topologija se proverava racunom)', function () {
    var e = 8 - 12 + 6;
    return { got: '8 - 12 + 6 = ' + e, want: '2', ok: e === 2 };
  });

  /* ---------- Blok 5: simulacija i AI ---------- */
  add(5, 'gradijentni spust', 'f(x) = (x-3)^2, korak 0.1, 100 iteracija: priblizava se 3, ne stize', function () {
    var x = 0, i;
    for (i = 0; i < 100; i++) x = x - 0.1 * 2 * (x - 3);
    return { got: 'x = ' + x + ' (razlika ' + (3 - x).toExponential(3) + ')',
             want: 'blizu 3, ali ne tacno 3', ok: x !== 3 && blizu(x, 3, 1e-8) };
  });

  /* ---------- Blok 6: logika i automat ---------- */
  add(6, 'De Morgan', 'negacija konjunkcije je disjunkcija negacija — za sve 4 kombinacije', function () {
    var ok = 0, a, b;
    for (a = 0; a < 2; a++) for (b = 0; b < 2; b++) if (!(!!a && !!b) === (!a || !b)) ok++;
    return { got: ok + '/4 kombinacije', want: '4/4', ok: ok === 4 };
  });
  add(6, 'FSM lifta', 'nemaran automat otvara vrata TOKOM voznje; strogi nikad', function () {
    var ulazi = ['poziv', 'kreni', 'dugme', 'stigao', 'poziv', 'kreni', 'dugme', 'stigao'];
    function sim(strog) {
      var st = 'stoji', open = 0, bad = 0;
      for (var i = 0; i < ulazi.length; i++) {
        var u = ulazi[i];
        if (u === 'kreni' && st === 'stoji') st = 'vozi';
        else if (u === 'stigao') { st = 'stoji'; open++; }
        else if (u === 'dugme' && !strog) { open++; if (st === 'vozi') bad++; }
      }
      return { open: open, bad: bad };
    }
    var s = sim(true), n = sim(false);
    return { got: 'strogi: ' + s.open + ' otvaranja, ' + s.bad + ' u voznji | nemarni: ' + n.open + ' otvaranja, ' + n.bad + ' u voznji',
             want: 'strogi 0 u voznji, nemarni 2 u voznji', ok: s.bad === 0 && n.bad === 2 };
  });

  /* ---------- Blok 7: grafovi ---------- */
  /* isti tlocrt kao dokazi/verify2.js — brojevi na hubu i brojevi u dokazima su jedan izvor */
  var ZGRADA = {
    S: { hodnik1: 5, hodnik2: 10 },
    hodnik1: { A: 2, hodnik2: 3 },
    hodnik2: { hodnik1: 3, C: 4 },
    A: { C: 12, hodnik1: 2 },
    C: { izlaz: 6, hodnik2: 4 },
    izlaz: {}
  };
  function dijkstra(g, from, to, zatvoreno) {
    var d = {}, done = {}, k;
    for (k in g) d[k] = Infinity;
    d[from] = 0;
    for (;;) {
      var u = null, best = Infinity;
      for (k in d) if (!done[k] && d[k] < best) { best = d[k]; u = k; }
      if (u === null) break;
      done[u] = true;
      for (var v in g[u]) {
        if (zatvoreno && zatvoreno[u + '|' + v]) continue;
        if (d[u] + g[u][v] < d[v]) d[v] = d[u] + g[u][v];
      }
    }
    return d[to];
  }
  add(7, 'Dijkstra evakuacija', 'najkraci put od sobe S do izlaza je 18 m', function () {
    var m = dijkstra(ZGRADA, 'S', 'izlaz');
    return { got: m + ' m', want: '18 m', ok: m === 18 };
  });
  add(7, 'Dijkstra sa vatrom', 'pozar zatvara spoj hodnik1-hodnik2: put se preusmerava na 20 m', function () {
    var m = dijkstra(ZGRADA, 'S', 'izlaz', { 'hodnik1|hodnik2': 1 });
    return { got: m + ' m', want: '20 m', ok: m === 20 };
  });
  var POSAO = [
    { id: 'iskop', t: 5, pre: [] }, { id: 'temelj', t: 10, pre: ['iskop'] },
    { id: 'zidovi', t: 8, pre: ['temelj'] }, { id: 'krov', t: 6, pre: ['zidovi'] },
    { id: 'instalacije', t: 3, pre: ['zidovi'] }, { id: 'fasada', t: 4, pre: ['krov', 'instalacije'] }
  ];
  function cpm(zad) {
    var ef = {}, T = 0, i, j;
    for (i = 0; i < zad.length; i++) {
      var z = zad[i], s = 0;
      for (j = 0; j < z.pre.length; j++) s = Math.max(s, ef[z.pre[j]] || 0);
      ef[z.id] = s + z.t;
      if (ef[z.id] > T) T = ef[z.id];
    }
    return T;
  }
  add(7, 'CPM', 'kriticni put kroz 6 zadataka gradnje = 33 dana', function () {
    var T = cpm(POSAO);
    return { got: T + ' dana', want: '33 dana', ok: T === 33 };
  });
  add(7, 'CPM: nekriticni zadatak', 'instalacije skracene 3 -> 1 dan: kraj projekta OSTAJE 33 dana', function () {
    var z = POSAO.map(function (x) { return x.id === 'instalacije' ? { id: x.id, t: 1, pre: x.pre } : x; });
    var T = cpm(z);
    return { got: T + ' dana', want: '33 dana (nepromenjeno)', ok: T === 33 };
  });

  /* ---------- Blok 8: computational geometry ---------- */
  add(8, 'konveksni omotac', 'od 7 tacaka parcele, ograda ide oko 6; (4,5) ostaje unutra', function () {
    var pts = [[0, 0], [10, 0], [10, 10], [0, 10], [4, 5], [5, 12], [12, 5]];
    var s = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    function half(arr) {
      var h = [];
      for (var i = 0; i < arr.length; i++) {
        while (h.length >= 2 && cr(h[h.length - 2], h[h.length - 1], arr[i]) <= 0) h.pop();
        h.push(arr[i]);
      }
      return h;
    }
    var n = half(s).length + half(s.slice().reverse()).length - 2;
    return { got: n + ' temena ograde', want: '6 temena', ok: n === 6 };
  });
  add(8, 'point-in-polygon', 'L-prostorija: (3,1) unutra, (1,3) unutra, (3,3) u useku — van', function () {
    var L = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]];
    function pip(x, y) {
      var inside = false;
      for (var i = 0, j = L.length - 1; i < L.length; j = i++) {
        var xi = L[i][0], yi = L[i][1], xj = L[j][0], yj = L[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
      }
      return inside;
    }
    var a = pip(3, 1), b = pip(1, 3), c = pip(3, 3);
    return { got: '(3,1) = ' + a + ', (1,3) = ' + b + ', (3,3) = ' + c,
             want: 'true, true, false', ok: a === true && b === true && c === false };
  });

  /* ---------- Blok 9: numerika ---------- */
  add(9, 'resetka: ravnoteza cvora', 'konzola 3-4-5, sila 5 kN: dijagonala nosi 6.25 kN', function () {
    var N = 5 * 5 / 4;
    return { got: N.toFixed(2) + ' kN', want: '6.25 kN', ok: blizu(N, 6.25, 1e-12) };
  });
  add(9, 'katastrofalno skracenje', 'x^2 - 1e8 x + 1 = 0: standardna formula gresi, Vietina ne', function () {
    var b = -1e8, c = 1;
    var d = Math.sqrt(b * b - 4 * c);
    var x1 = (-b + d) / 2;
    var naivno = (-b - d) / 2;
    var vieta = c / x1;
    var tacno = 1e-8;
    return { got: 'naivno = ' + naivno + ' | Vieta = ' + vieta + ' | tacno = ' + tacno,
             want: 'Vieta tacna, naivno netacno', ok: naivno !== vieta && blizu(vieta, tacno, 1e-16) };
  });
  add(9, 'uslovljenost', 'kruta opruga 1e16 i meka 0.1: meka nestaje iz zbira', function () {
    var ostatak = (1e16 + 0.1) - 1e16;
    return { got: '(1e16 + 0.1) - 1e16 = ' + ostatak, want: '0 — meka opruga izgubljena', ok: ostatak === 0 };
  });

  /* ---------- Blok 10: granica ---------- */
  add(10, 'kombinatorna eksplozija', '12 prostorija ima 479.001.600 rasporeda', function () {
    var f = 1, i;
    for (i = 2; i <= 12; i++) f *= i;
    return { got: f.toLocaleString('sr-RS') + ' rasporeda', want: '479001600', ok: f === 479001600 };
  });
  add(10, '20 prostorija', '20! rasporeda na milion u sekundi traje preko 70.000 godina', function () {
    var f = 1, i;
    for (i = 2; i <= 20; i++) f *= i;
    var god = f / 1e6 / 3600 / 24 / 365.25;
    return { got: Math.round(god).toLocaleString('sr-RS') + ' godina', want: '> 70000 godina', ok: god > 70000 };
  });
  add(10, 'entropija', 'cetiri materijala sa p = 0.5 / 0.25 / 0.125 / 0.125: H = 1.75 bita', function () {
    var p = [0.5, 0.25, 0.125, 0.125], H = 0, i;
    for (i = 0; i < p.length; i++) H -= p[i] * Math.log2(p[i]);
    return { got: 'H = ' + H.toFixed(3) + ' bita', want: '1.750 bita', ok: blizu(H, 1.75, 1e-12) };
  });

  /* ---------- izvrsavanje ---------- */
  function izvrsi(provere) {
    return provere.map(function (p) {
      try {
        var r = p.run();
        return { p: p, ok: !!r.ok, got: r.got, want: r.want };
      } catch (e) {
        return { p: p, ok: false, got: 'greska: ' + e.message, want: '—' };
      }
    });
  }

  var API = {
    sve: function () { return P.slice(); },
    blok: function (n) { return P.filter(function (p) { return p.blok === n; }); },
    izvrsi: izvrsi,
    montiraj: function (sel, blok) {
      var el = typeof sel === 'string' ? document.querySelector(sel) : sel;
      if (!el) return;
      var provere = blok ? API.blok(blok) : P;
      var head = document.createElement('div');
      head.className = 'proof-head';
      var btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = 'Proveri sam (' + provere.length + ')';
      var note = document.createElement('span');
      note.className = 'thread';
      note.textContent = 'broju u tekstu se ne veruje — pokrece se';
      head.appendChild(btn); head.appendChild(note);
      el.appendChild(head);
      btn.addEventListener('click', function () {
        var rez = izvrsi(provere), pass = 0;
        var out = document.createElement('div');
        out.className = 'proof-out';
        rez.forEach(function (r, i) {
          if (r.ok) pass++;
          var d = document.createElement('div');
          d.innerHTML =
            '<span class="' + (r.ok ? 'p' : 'f') + '">' + (r.ok ? 'RADI' : 'PAD ') + '</span> ' +
            '<span class="n">[' + String(i + 1).padStart(2, '0') + '] blok ' + r.p.blok + ' · ' + r.p.id + '</span>\n' +
            '      ' + r.p.tvrdnja + '\n' +
            '      <span class="n">izracunato ovde:</span> ' + r.got +
            '  <span class="n">| ocekivano: ' + r.want + '</span>';
          out.appendChild(d);
        });
        var sum = document.createElement('div');
        sum.style.marginTop = '.6rem';
        sum.innerHTML = '<span class="' + (pass === rez.length ? 'p' : 'f') + '">' + pass + ' / ' + rez.length +
          '</span> provera izvrseno u ovom pretrazivacu, na ovom racunaru, sada.';
        out.appendChild(sum);
        var old = el.querySelector('.proof-out');
        if (old) old.remove();
        el.appendChild(out);
      });
    }
  };

  global.Dokaz = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
