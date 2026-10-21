/* Object 001 in space — pure model behind the 3D passport scene.
   Objekat 001 u prostoru — čist model iza 3D scene digitalnog pasoša.

   No DOM, no WebGL, no network, no dependencies. The page and the proof gate
   import this same module, so a number on screen and a number in the test
   cannot drift apart.

   Three rules this module exists to enforce:

   1. Geometry is never stronger than its evidence. A part of the object is
      drawn only where a claim justifies it; its visual state is DERIVED from
      the record, never authored here.
   2. A dimension that no source measured is a declared proportion, listed in
      PROPORTIONS, and must be labelled as such on screen. Schematic geometry
      must not pose as a survey.
   3. Unknown is a part of the object, not a gap in it: it gets a place, a
      question and a next step, and it is drawn as a marked void.

   The only authored thing here is SPEC: which claim is allowed to justify
   which part of the drawing. That is a teaching decision and it is declared,
   not hidden. The gate proves the mapping is total in both directions.
*/
(function (root, factory) {
  'use strict';
  var M = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else root.ProstorModel = M;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------------------------------------------------------------- lanes */
  /* The six lanes are the `l` field already carried by every claim in the
     passport. Only the bilingual labels are added here. */
  var LANES = [
    { id: 'id',   en: 'Identity',  sr: 'Identitet',
      scopeEn: 'What it is and what it is called.',
      scopeSr: 'Šta je i kako se zove.' },
    { id: 'geo',  en: 'Geometry',  sr: 'Geometrija',
      scopeEn: 'Measure, outline, span, agreement between figures.',
      scopeSr: 'Mera, gabarit, raspon, slaganje brojeva.' },
    { id: 'mat',  en: 'Material',  sr: 'Materijal',
      scopeEn: 'What carries the load, what it is made of, how much of it.',
      scopeSr: 'Šta nosi, od čega je, koliko ga ima.' },
    { id: 'org',  en: 'Authorship', sr: 'Autorstvo',
      scopeEn: 'Who drew it, who built it, where it came from.',
      scopeSr: 'Ko ga je projektovao, ko gradio, odakle je došao.' },
    { id: 'cond', en: 'Condition', sr: 'Stanje',
      scopeEn: 'How it behaved, what was measured, what was never recorded.',
      scopeSr: 'Kako se ponašao, šta je mereno, šta nikad nije zapisano.' },
    { id: 'use',  en: 'Afterlife', sr: 'Dalji vek',
      scopeEn: 'Taken apart, moved, and what the paperwork says about it.',
      scopeSr: 'Rasklopljen, premešten, i šta o tome kaže papir.' }
  ];

  /* ------------------------------------------------- declared proportions */
  /* Every number used by the drawing that NO source measured. Each one must
     be visible in the interface. The gate fails if the page omits them. */
  var PROPORTIONS = [
    { k: 'riseRatio', v: 0.165,
      en: 'Arch rise is drawn as 0.165 of the span. No source gives the rise.',
      sr: 'Strela luka je nacrtana kao 0,165 raspona. Nijedan izvor ne daje strelu.' },
    { k: 'trussDepth', v: 6,
      en: 'Truss depth drawn as 6 m. The lattice form is sourced; its depth is not.',
      sr: 'Visina rešetke nacrtana kao 6 m. Oblik rešetke ima izvor, visina nema.' },
    { k: 'pierDepth', v: 14,
      en: 'Piers are drawn 14 m deep. The count of eight is sourced; the depth is not.',
      sr: 'Stubovi su nacrtani 14 m duboko. Broj osam ima izvor, dubina nema.' },
    { k: 'deckThickness', v: 1.6,
      en: 'Deck drawn 1.6 m thick. Three deck versions are sourced; no thickness is.',
      sr: 'Kolovoz nacrtan debljine 1,6 m. Tri verzije kolovoza imaju izvor, nijedna debljinu.' },
    { k: 'fieldRadius', v: 30,
      en: 'A behaviour is drawn as 30 m rings. The rings have no measured size.',
      sr: 'Ponašanje je nacrtano kao prstenovi od 30 m. Prstenovi nemaju izmerenu veličinu.' },
    { k: 'voidSize', v: 18,
      en: 'A void is drawn as an 18 m cage. The size is not measured and means nothing: it marks a place where nothing is known.',
      sr: 'Šupljina je nacrtana kao kavez od 18 m. Veličina nije merena i ništa ne znači: ona označava mesto o kom se ništa ne zna.' }
  ];
  function proportion(k) {
    for (var i = 0; i < PROPORTIONS.length; i++) {
      if (PROPORTIONS[i].k === k) return PROPORTIONS[i].v;
    }
    throw new Error('undeclared proportion: ' + k);
  }

  /* ----------------------------------------------------------------- SPEC */
  /* The authored mapping: claim (and, where the claim carries measures, one
     measure key) to one part of the scene.
       role  volume  drawn as structure, in metres
             mass    a weight carried by structure already drawn
             field   a behaviour around the object, never a solid
             mark    an annotation anchored in space, no body
             void    a marked absence: an open cage holding a question
       at    anchor in object space, metres [x, y, z], x along the axis   */
  var SPEC = [
    { claim: 'naziv',   part: 'name',       role: 'mark',   at: [0, 46, 0],
      en: 'The names it carried',      sr: 'Imena koja je nosio' },
    { claim: 'parcela', part: 'ground',     role: 'void',   at: [-150, -26, 0],
      en: 'The ground it stood on',    sr: 'Zemlja na kojoj je stajao' },
    { claim: 'godina',  part: 'birth',      role: 'mark',   at: [-215, 12, 0],
      en: 'The year it was finished',  sr: 'Godina kada je završen' },

    { claim: 'gabarit', mk: 'length', part: 'axis', role: 'volume', at: [0, 0, 0],
      en: 'Crossing axis',   sr: 'Osa prelaza' },
    { claim: 'gabarit', mk: 'span',   part: 'arch', role: 'volume', at: [0, 32, 0],
      en: 'Arch and span',   sr: 'Luk i raspon' },
    { claim: 'gabarit', mk: 'width',  part: 'deck', role: 'volume', at: [78, 3, 0],
      en: 'Deck width',      sr: 'Širina kolovoza' },
    { claim: 'etaze', mk: 'piers', part: 'piers', role: 'volume', at: [-120, -10, 0],
      en: 'Eight piers',     sr: 'Osam stubova' },
    { claim: 'odstup',  part: 'asbuilt',    role: 'void',   at: [152, 18, 0],
      en: 'Built against drawn', sr: 'Izvedeno prema nacrtanom' },

    { claim: 'konstr',  part: 'truss',      role: 'volume', at: [0, 20, 0],
      en: 'What carries the load', sr: 'Šta nosi konstrukciju' },
    { claim: 'fasada',  part: 'decklayers', role: 'volume', at: [-70, 4, 0],
      en: 'Three decks in time',   sr: 'Tri kolovoza kroz vreme' },
    { claim: 'kolic',  mk: 'mass-total', part: 'mass',     role: 'mass', at: [105, -8, 0],
      en: 'Mass of the whole',     sr: 'Masa cele konstrukcije' },
    { claim: 'kolic',  mk: 'mass-arch',  part: 'archmass', role: 'mass', at: [0, 44, 0],
      en: 'Mass of the arch',      sr: 'Masa luka' },

    { claim: 'projekt', part: 'author',     role: 'mark',   at: [-192, 28, 0],
      en: 'Who drew it',     sr: 'Ko ga je projektovao' },
    { claim: 'izvod',   part: 'builder',    role: 'mark',   at: [192, 28, 0],
      en: 'Who built it',    sr: 'Ko ga je gradio' },
    { claim: 'izvor',   part: 'supply',     role: 'void',   at: [-152, 36, 0],
      en: 'Where the steel came from', sr: 'Odakle je čelik' },

    { claim: 'nosiv',   part: 'capacity',   role: 'field',  at: [0, -16, 0],
      en: 'How much it could carry', sr: 'Koliko je mogao da nosi' },
    { claim: 'opasne',  part: 'substance',  role: 'void',   at: [112, 22, 0],
      en: 'Hazardous substances',    sr: 'Opasne materije' },
    { claim: 'ponasa',  part: 'load',       role: 'field',  at: [0, 10, 0],
      en: 'How it behaved in use',   sr: 'Kako se ponašao u radu' },

    { claim: 'rastav',  part: 'segments',   role: 'volume', at: [0, 38, 0],
      en: 'Taken apart into segments', sr: 'Rasklopljen na segmente' },
    { claim: 'dokaz',   part: 'record',     role: 'void',   at: [-112, 22, 0],
      en: 'The record of what was removed', sr: 'Zapis o onome što je uklonjeno' },
    { claim: 'dozvola', part: 'permit',     role: 'void',   at: [152, -26, 0],
      en: 'The permit for the move', sr: 'Dozvola za premeštanje' }
  ];

  /* ------------------------------------------------------ state from data */
  function uniq(a) {
    var o = [], i;
    for (i = 0; i < a.length; i++) if (o.indexOf(a[i]) < 0) o.push(a[i]);
    return o;
  }
  function srcOf(entries) {
    var all = [], i, j, s;
    for (i = 0; i < entries.length; i++) {
      s = entries[i].src || [];
      for (j = 0; j < s.length; j++) all.push(s[j]);
    }
    return uniq(all);
  }
  /* Derived, never authored: the state of one measured quantity. */
  function measureState(entries) {
    if (!entries || !entries.length) return null;
    var values = uniq(entries.map(function (e) { return e.v; }));
    if (values.length > 1) return 'conflicting';
    return srcOf(entries).length >= 2 ? 'confirmed' : 'single-source';
  }

  /* Vocabulary shared with docs/data/taxonomy.json — not a second list. */
  var STATE_ORDER = ['confirmed', 'single-source', 'probable',
                     'conflicting', 'unconfirmed', 'unknown'];
  /* How solid a part may ever be drawn. Unknown is never above zero. */
  var STATE_SOLIDITY = {
    'confirmed': 1, 'single-source': 0.5, 'probable': 0.42,
    'conflicting': 0.66, 'unconfirmed': 0.28, 'unknown': 0
  };

  /* ---------------------------------------------------------------- build */
  function build(passport) {
    if (!passport || !passport.claims) throw new Error('build: passport with claims required');
    var byKey = {}, i;
    for (i = 0; i < passport.claims.length; i++) byKey[passport.claims[i].k] = passport.claims[i];

    var parts = SPEC.map(function (spec) {
      var c = byKey[spec.claim];
      if (!c) throw new Error('SPEC names a claim the passport does not carry: ' + spec.claim);

      var entries = spec.mk
        ? (c.m || []).filter(function (e) { return e.k === spec.mk; })
        : [];
      var measured = entries.length > 0;
      if (spec.mk && !measured) throw new Error('SPEC names a measure the passport does not carry: ' + spec.claim + '/' + spec.mk);
      var state = measured ? measureState(entries) : c.st;

      /* Variants exist only where sources disagree. Each keeps its own
         sources and its own attribution; neither is preferred. */
      var variants = [];
      if (measured) {
        uniq(entries.map(function (e) { return e.v; })).forEach(function (v) {
          var same = entries.filter(function (e) { return e.v === v; });
          variants.push({
            v: v, u: same[0].u, approx: !!same[0].approx,
            src: srcOf(same), by: same[0].by
          });
        });
      }

      /* A flag travels to every part whose own sources include the flagged
         source. Derived from the record, not copied by hand. */
      var mine = measured ? srcOf(entries) : (c.src || []);
      var flags = (c.flags || []).filter(function (f) {
        return (f.src || []).some(function (s) { return mine.indexOf(s) >= 0; });
      });

      return {
        k: spec.part,
        claim: spec.claim,
        mk: spec.mk || null,
        lane: c.l,
        role: spec.role,
        at: spec.at,
        label: { en: spec.en, sr: spec.sr },
        question: c.q,
        value: c.v || null,
        note: c.note || null,
        next: c.next || null,
        ev: c.ev || null,
        checked: c.checked || null,
        /* state of THIS part, derived from the measure when there is one */
        state: state,
        /* state recorded for the whole claim — shown beside it, never hidden:
           one measure can agree inside a claim whose other measures conflict */
        claimState: c.st,
        refined: measured && state !== c.st,
        measured: measured,
        variants: variants,
        src: mine,
        flags: flags,
        solidity: STATE_SOLIDITY[state]
      };
    });

    var lanes = LANES.map(function (l) {
      return {
        id: l.id,
        label: { en: l.en, sr: l.sr },
        scope: { en: l.scopeEn, sr: l.scopeSr },
        parts: parts.filter(function (p) { return p.lane === l.id; })
                    .map(function (p) { return p.k; })
      };
    });

    /* What each source actually carries. Put the source down and these parts
       go dark — that is the point of the whole instrument. */
    var sources = (passport.sources || []).map(function (s) {
      var carries = parts.filter(function (p) { return p.src.indexOf(s.id) >= 0; });
      return {
        id: s.id, t: s.t, pub: s.pub, url: s.url, kind: s.kind, checked: s.checked,
        parts: carries.map(function (p) { return p.k; }),
        /* parts for which this is the only source: they go dark alone */
        sole: carries.filter(function (p) { return p.src.length === 1; })
                     .map(function (p) { return p.k; })
      };
    });

    return {
      id: passport.id,
      name: passport.object.name,
      life: passport.object.life,
      scope: passport.scope,
      updated: passport.updated,
      lengthM: lengthOf(parts),
      /* Unresolved lengths stay unresolved. A finite drawing envelope merely
         places schematic decks/piers; it is not another measured length. */
      layoutLengthM: Math.max.apply(null, parts.filter(function (p) { return p.k === 'axis'; })[0].variants.map(function (v) { return v.v; })),
      parts: parts,
      lanes: lanes,
      sources: sources,
      timeline: passport.timeline || [],
      places: passport.places || [],
      placeNote: passport.placeNote || null,
      coordNote: passport.object.coordNote || null,
      lineNote: passport.object.lineNote || null,
      proportions: PROPORTIONS
    };
  }

  function part(scene, k) {
    for (var i = 0; i < scene.parts.length; i++) {
      if (scene.parts[i].k === k) return scene.parts[i];
    }
    return null;
  }
  /* The one length every other drawn dimension is relative to. */
  function lengthOf(parts) {
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].k === 'axis' && parts[i].variants.length === 1) return parts[i].variants[0].v;
    }
    return null;
  }

  /* ------------------------------------------------------------- coverage */
  /* How much of the object the evidence in hand can justify. Counted in
     parts, never rounded up, and the dark share is named, not implied.
     Unknown parts are never counted as lit: no amount of reading turns an
     absent record into a present one. */
  function coverage(scene, heldSources) {
    var held = heldSources || scene.sources.map(function (s) { return s.id; });
    var by = {}, lit = 0, dark = 0, i;
    for (i = 0; i < STATE_ORDER.length; i++) by[STATE_ORDER[i]] = 0;
    scene.parts.forEach(function (p) {
      var on = p.state !== 'unknown' && p.src.some(function (s) { return held.indexOf(s) >= 0; });
      if (on) { lit++; by[p.state]++; } else { dark++; }
      if (p.state === 'unknown') by.unknown++;
    });
    return { total: scene.parts.length, lit: lit, dark: dark,
             byState: by, unknown: by.unknown, held: held.length };
  }

  /* Is this part visible with the evidence currently held? */
  function litWith(p, held) {
    return p.state !== 'unknown' && p.src.some(function (s) { return held.indexOf(s) >= 0; });
  }

  /* ------------------------------------------------------------- geometry */
  /* All geometry is produced here, in metres, so the gate can measure the
     same vertices the renderer draws.
     X along the crossing axis, Y up, Z across the deck. */

  function parabola(span, rise, segs) {
    var pts = [], i, t, x;
    for (i = 0; i <= segs; i++) {
      t = i / segs; x = (t - 0.5) * span;
      pts.push([x, rise * (1 - 4 * (t - 0.5) * (t - 0.5)), 0]);
    }
    return pts;
  }

  function geomAxis(len) {
    var nodes = [[-len / 2, 0, 0], [len / 2, 0, 0]], lines = [[0, 1]], i, x;
    for (i = 0; i * 50 <= len; i++) {                        /* 50 m ticks */
      x = -len / 2 + i * 50;
      nodes.push([x, 0, 0], [x, -5, 0]);
      lines.push([nodes.length - 2, nodes.length - 1]);
    }
    return { nodes: nodes, lines: lines, kind: 'line', len: len };
  }

  function geomArch(span) {
    var rise = span * proportion('riseRatio'), depth = proportion('trussDepth');
    var segs = 24, top = parabola(span, rise, segs), nodes = [], lines = [], i;
    var lower = top.map(function (p) {
      var d = p[1] > depth * 0.5 ? depth : p[1] * 0.5;       /* chord closes at springing */
      return [p[0], p[1] - d, p[2]];
    });
    for (i = 0; i <= segs; i++) nodes.push(top[i]);
    for (i = 0; i <= segs; i++) nodes.push(lower[i]);
    for (i = 0; i < segs; i++) { lines.push([i, i + 1]); lines.push([segs + 1 + i, segs + 2 + i]); }
    for (i = 0; i <= segs; i += 2) lines.push([i, segs + 1 + i]);         /* posts   */
    for (i = 0; i < segs; i++) lines.push([i, segs + 2 + i]);             /* lattice */
    var tie = nodes.length;
    nodes.push([-span / 2, 0, 0], [span / 2, 0, 0]);
    lines.push([tie, tie + 1]);                                           /* tie     */
    for (i = 3; i < segs - 2; i += 3) {                                   /* hangers */
      nodes.push([top[i][0], 0, 0]);
      lines.push([segs + 1 + i, nodes.length - 1]);
    }
    return { nodes: nodes, lines: lines, kind: 'line', rise: rise, span: span };
  }

  function geomDeck(len, width) {
    var t = proportion('deckThickness'), w = width / 2;
    var nodes = [
      [-len / 2, 0, -w], [len / 2, 0, -w], [len / 2, 0, w], [-len / 2, 0, w],
      [-len / 2, -t, -w], [len / 2, -t, -w], [len / 2, -t, w], [-len / 2, -t, w]
    ];
    var lines = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4],
                 [0, 4], [1, 5], [2, 6], [3, 7]];
    var tris = [[0, 1, 2], [0, 2, 3]];
    return { nodes: nodes, lines: lines, tris: tris, kind: 'solid', width: width };
  }

  function geomPiers(count, len, width) {
    var d = proportion('pierDepth'), nodes = [], lines = [], i, j, x;
    var w = Math.max(3, width / 6);
    for (i = 0; i < count; i++) {
      x = -len / 2 + (len / (count - 1)) * i;
      var b = nodes.length;
      nodes.push([x, 0, -w], [x, 0, w], [x, -d, w], [x, -d, -w]);
      for (j = 0; j < 4; j++) lines.push([b + j, b + (j + 1) % 4]);
      nodes.push([x, -d - 6, 0]);                            /* timber pile mark */
      lines.push([b + 2, b + 4], [b + 3, b + 4]);
    }
    return { nodes: nodes, lines: lines, kind: 'line', count: count };
  }

  /* An absence is drawn as an open cage: corner stubs only, no faces and no
     closed edge. It must never read as a solid a viewer could mistake for a
     finding. */
  function geomVoid(at) {
    var s = proportion('voidSize') / 2, n = [], l = [], i, f = 0.3;
    var box = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
    var edge = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    for (i = 0; i < box.length; i++) {
      n.push([at[0] + box[i][0] * s, at[1] + box[i][1] * s, at[2] + box[i][2] * s]);
    }
    for (i = 0; i < edge.length; i++) {
      var a = n[edge[i][0]], b = n[edge[i][1]];
      n.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
      n.push([b[0] + (a[0] - b[0]) * f, b[1] + (a[1] - b[1]) * f, b[2] + (a[2] - b[2]) * f]);
      l.push([edge[i][0], n.length - 2], [edge[i][1], n.length - 1]);
    }
    return { nodes: n, lines: l, kind: 'cage' };
  }

  /* A behaviour is not a body: three open rings, drawn broken, nothing closed. */
  function geomField(at, r) {
    var n = [], l = [], i, k, segs = 36;
    for (k = 0; k < 3; k++) {
      var b = n.length;
      for (i = 0; i < segs; i++) {
        var a = i / segs * Math.PI * 2, u = Math.cos(a) * r, v = Math.sin(a) * r;
        n.push(k === 0 ? [at[0] + u, at[1] + v, at[2]]
             : k === 1 ? [at[0] + u, at[1], at[2] + v]
                       : [at[0], at[1] + u, at[2] + v]);
        if (i % 2 === 0 && i < segs - 1) l.push([b + i, b + i + 1]);
      }
    }
    return { nodes: n, lines: l, kind: 'field' };
  }

  /* The drawable geometry for one part, in the variant asked for.
     Returns null where the part has no body — a name, a year or a mass is
     content, and content belongs in the document, not in invented structure. */
  /* Read one figure back out of the record. Nothing in this file may write a
     measurement down: a figure in code is a figure with no source, which is
     the exact failure this whole page is about. */
  function figure(scene, partKey, variantIndex) {
    var p = part(scene, partKey);
    if (!p || !p.variants.length) {
      throw new Error('no recorded figure for ' + partKey + '; the drawing refuses to invent one');
    }
    return p.variants[Math.min(variantIndex || 0, p.variants.length - 1)].v;
  }

  function geometryOf(scene, k, variantIndex) {
    var p = part(scene, k);
    if (!p) return null;
    var len = scene.lengthM == null ? scene.layoutLengthM : scene.lengthM;
    var v = p.variants[variantIndex || 0];
    if (p.role === 'void' || p.state === 'unknown') return geomVoid(p.at);
    if (p.role === 'field') return geomField(p.at, proportion('fieldRadius'));
    if (p.role === 'mark' || p.role === 'mass') return null;
    switch (k) {
      case 'axis':       return geomAxis(v.v);
      case 'arch':       return geomArch(v.v);
      case 'deck':       return geomDeck(len, v.v);
      case 'piers':      return geomPiers(v.v, len, figure(scene, 'deck'));
      /* The lattice and the segments are the same arch read for a different
         question, so they take the arch's first recorded span, not a second
         number of their own. */
      case 'truss':      return geomArch(figure(scene, 'arch'));
      case 'decklayers': return geomDeck(len, figure(scene, 'deck'));
      case 'segments':   return geomArch(figure(scene, 'arch'));
      default:           return null;
    }
  }

  /* How many variants a part can be drawn in. */
  function variantCount(scene, k) {
    var p = part(scene, k);
    return p ? Math.max(1, p.variants.length) : 0;
  }

  /* ------------------------------------------------ places, in kilometres */
  /* Equirectangular around the crossing. Straight-line distances only — the
     passport says so, and nothing here adds geometry it never verified. */
  function placeGeometry(scene) {
    var home = scene.places.filter(function (p) { return p.k === 'sava'; })[0];
    if (!home) return { nodes: [], unit: 'km' };
    var kx = 111.32 * Math.cos(home.lat * Math.PI / 180), ky = 110.57;
    var nodes = scene.places.map(function (p) {
      if (p.lon == null || p.lat == null) {
        return { k: p.k, known: false, role: p.role, s: p.s || [], at: null, km: null,
                 sr: p.sr, en: p.en };
      }
      var dx = (p.lon - home.lon) * kx, dz = -(p.lat - home.lat) * ky;
      return { k: p.k, known: true, role: p.role, s: p.s || [],
               at: [dx, 0, dz], km: Math.round(Math.hypot(dx, dz)),
               sr: p.sr, en: p.en };
    });
    return { nodes: nodes, unit: 'km' };
  }

  /* -------------------------------------------------------- camera, 4x4 */
  function mul(a, b) {
    var o = new Array(16), i, j, k, s;
    for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) {
      s = 0;
      for (k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      o[i * 4 + j] = s;
    }
    return o;
  }
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), d = near - far;
    return [f / aspect, 0, 0, 0,  0, f, 0, 0,
            0, 0, (far + near) / d, -1,  0, 0, 2 * far * near / d, 0];
  }
  function lookAt(eye, at, up) {
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function nrm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
    function crs(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    var z = nrm(sub(eye, at)), x = nrm(crs(up, z)), y = crs(z, x);
    return [x[0], y[0], z[0], 0,  x[1], y[1], z[1], 0,  x[2], y[2], z[2], 0,
            -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
  }
  /* Orbit position from spherical angles — shared by renderer and gate, so a
     keyboard step and a drag cannot diverge. */
  function orbitEye(target, dist, yaw, pitch) {
    var cp = Math.cos(pitch);
    return [target[0] + dist * cp * Math.sin(yaw),
            target[1] + dist * Math.sin(pitch),
            target[2] + dist * cp * Math.cos(yaw)];
  }
  function clampPitch(p) { return Math.max(-1.45, Math.min(1.45, p)); }
  function clampDist(d) { return Math.max(80, Math.min(1600, d)); }

  /* Project one point to normalised device coordinates; null when behind. */
  function project(mvp, p) {
    var x = mvp[0] * p[0] + mvp[4] * p[1] + mvp[8]  * p[2] + mvp[12];
    var y = mvp[1] * p[0] + mvp[5] * p[1] + mvp[9]  * p[2] + mvp[13];
    var w = mvp[3] * p[0] + mvp[7] * p[1] + mvp[11] * p[2] + mvp[15];
    if (w <= 0.0001) return null;
    return [x / w, y / w, w];
  }

  return {
    LANES: LANES, SPEC: SPEC, PROPORTIONS: PROPORTIONS,
    STATE_ORDER: STATE_ORDER, STATE_SOLIDITY: STATE_SOLIDITY,
    build: build, part: part, coverage: coverage, litWith: litWith,
    measureState: measureState, proportion: proportion,
    geometryOf: geometryOf, variantCount: variantCount, figure: figure,
    placeGeometry: placeGeometry,
    geomAxis: geomAxis, geomArch: geomArch, geomDeck: geomDeck,
    geomPiers: geomPiers, geomVoid: geomVoid, geomField: geomField,
    parabola: parabola,
    mul: mul, perspective: perspective, lookAt: lookAt, orbitEye: orbitEye,
    clampPitch: clampPitch, clampDist: clampDist, project: project
  };
}));
