/* The origin layer, drawn.

   One decision shapes this page: the map is not the atlas. The atlas is
   Belgrade at 25 m to the unit; here Brač, Kavala and Vienna have to stand in
   the same picture as a clay pit in Karaburma, so the projection is plain
   equirectangular over whatever bounding box the records actually produced.
   It stretches north-south and it is honest about that: it exists to show
   that the Palata Srbije is an island in the Adriatic and the Hram is a hill
   in Šumadija, not to measure anything.

   Distances are computed, not quoted: great-circle kilometres between the
   gazetteer point and the centre of Belgrade. They inherit the gazetteer's
   precision, which is a settlement, so they are rounded to 5 km and never
   presented as a haul distance. */
'use strict';
(() => {
  const $ = s => document.querySelector(s), node = (t, text, cls) => {
    const n = document.createElement(t); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n;
  };
  const BELGRADE = { lat: 44.8147, lng: 20.4525 };
  const nf = new Intl.NumberFormat('sr-RS');

  function km(a, b) {
    const R = 6371, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  fetch('data/poreklo.json', { cache: 'no-cache' })
    .then(r => { if (!r.ok) throw Error('poreklo.json ' + r.status); return r.json(); })
    .then(draw)
    .catch(e => { $('#read').textContent = 'Sloj porekla nije dostupan: ' + e.message; });

  function draw(d) {
    const linksOf = id => d.links.filter(l => l.entity === id);
    const places = d.entities.filter(e => e.kind === 'poreklo');

    /* ---- tally ---- */
    for (const [value, label] of [
      [d.counts.entities, 'pojmova'],
      [d.counts.links, 'veza sa zapisom'],
      [places.length, 'imenovanih mesta porekla'],
      [d.counts.teamsWithMaterial + ' / ' + d.counts.teams, 'objekata sa zapisom o materijalu'],
      [d.counts.teamsWithOrigin + ' / ' + d.counts.teams, 'objekata sa imenovanim poreklom'],
      [d.workforce ? nf.format(d.workforce.total) : '—', 'nadnica (samo B.I.G.Z.)']
    ]) { const s = node('span'); s.append(node('b', String(value)), node('i', label)); s.lastChild.style.fontStyle = 'normal'; $('#tally').append(s); }

    /* ---- the map ---- */
    const pts = places.concat([{ id: 'bg', name: 'Beograd', lat: BELGRADE.lat, lng: BELGRADE.lng, target: true }]);
    const pad = 1.6;
    const lat0 = Math.min(...pts.map(p => p.lat)) - pad, lat1 = Math.max(...pts.map(p => p.lat)) + pad;
    const lng0 = Math.min(...pts.map(p => p.lng)) - pad, lng1 = Math.max(...pts.map(p => p.lng)) + pad;
    const W = 1000, H = Math.round(W * (lat1 - lat0) / (lng1 - lng0));
    const X = l => (l - lng0) / (lng1 - lng0) * W, Y = l => (lat1 - l) / (lat1 - lat0) * H;

    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Mesta porekla materijala i njihove veze sa Beogradom');

    /* A one-degree graticule is the only scale cue an equirectangular sketch
       can honestly offer: squares that are not square say "stretched". */
    for (let l = Math.ceil(lng0); l <= lng1; l++) addLine(X(l), 0, X(l), H);
    for (let l = Math.ceil(lat0); l <= lat1; l++) addLine(0, Y(l), W, Y(l));
    function addLine(x1, y1, x2, y2) {
      const n = document.createElementNS(NS, 'line');
      n.setAttribute('x1', x1); n.setAttribute('y1', y1); n.setAttribute('x2', x2); n.setAttribute('y2', y2);
      n.setAttribute('class', 'graticule'); svg.append(n);
    }

    const bx = X(BELGRADE.lng), by = Y(BELGRADE.lat), arcs = new Map(), nodes = new Map();
    for (const p of places) {
      const x = X(p.lng), y = Y(p.lat);
      /* The arc bows away from the straight line so two places on the same
         bearing do not draw one stroke on top of another. */
      const mx = (x + bx) / 2 + (by - y) * 0.16, my = (y + by) / 2 + (x - bx) * 0.16;
      const arc = document.createElementNS(NS, 'path');
      arc.setAttribute('d', 'M' + x.toFixed(1) + ',' + y.toFixed(1) + ' Q' + mx.toFixed(1) + ',' + my.toFixed(1) + ' ' + bx.toFixed(1) + ',' + by.toFixed(1));
      arc.setAttribute('class', 'arc'); svg.append(arc); arcs.set(p.id, arc);
    }
    /* Karaburma, Višnjica and Belgrade itself are three dots inside one
       kilometre, so a label parked at a fixed offset lands on its neighbour.
       Labels are nudged vertically until the boxes stop touching, and a label
       that would run off the right edge is flipped to the left of its dot.
       The dot never moves: only the writing does. */
    const taken = [], CH = 4.55, LH = 11;
    for (const p of [...pts].sort((a, b) => Y(a.lat) - Y(b.lat))) {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'node' + (p.target ? ' target' : ''));
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      const n = p.target ? 0 : linksOf(p.id).length;
      const px = X(p.lng), py = Y(p.lat), r = p.target ? 7 : 3.4 + Math.sqrt(n) * 2.1;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', px); c.setAttribute('cy', py); c.setAttribute('r', r);
      const w = p.name.length * CH, flip = px + r + 6 + w > W - 4;
      let ly = py + 3.4;
      for (let i = 0; i < 24; i++) {
        const x0 = flip ? px - r - 6 - w : px + r + 6;
        if (!taken.some(b => x0 < b[2] && x0 + w > b[0] && ly - LH < b[3] && ly > b[1])) break;
        ly += (i % 2 ? -1 : 1) * LH * Math.ceil((i + 1) / 2);
      }
      const x0 = flip ? px - r - 6 : px + r + 6;
      taken.push([flip ? x0 - w : x0, ly - LH, flip ? x0 : x0 + w, ly]);
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x0); t.setAttribute('y', ly);
      if (flip) t.setAttribute('text-anchor', 'end');
      t.textContent = p.name;
      /* A label pushed off its dot needs a thread back to it. */
      if (Math.abs(ly - (py + 3.4)) > 2) {
        const leader = document.createElementNS(NS, 'line');
        leader.setAttribute('x1', px + (flip ? -r : r)); leader.setAttribute('y1', py);
        leader.setAttribute('x2', x0); leader.setAttribute('y2', ly - 3);
        leader.setAttribute('stroke', '#b9b4a6'); leader.setAttribute('stroke-width', '.6');
        g.append(leader);
      }
      g.append(c, t); svg.append(g); nodes.set(p.id, g);
      const open = () => show(p);
      g.addEventListener('click', open);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      g.addEventListener('mouseenter', open);
    }
    $('#map').append(svg);

    function show(p) {
      for (const [id, a] of arcs) a.classList.toggle('on', id === p.id);
      for (const [id, g] of nodes) g.classList.toggle('on', id === p.id);
      const read = $('#read'); read.replaceChildren();
      if (p.target) {
        read.append(node('b', 'Beograd'), node('span', 'Sve veze na ovoj karti završavaju ovde. ' +
          places.length + ' imenovanih mesta, ' + d.counts.teamsWithOrigin + ' od ' + d.counts.teams + ' objekata sa imenovanim poreklom.'));
        return;
      }
      const ls = linksOf(p.id), dist = Math.round(km(BELGRADE, p) / 5) * 5;
      read.append(node('b', p.name));
      read.append(node('span', [p.placeKind, p.precision, p.country, '≈ ' + nf.format(dist) + ' km od Beograda', 'lokacija približna']
        .filter(Boolean).join(' · ')));
      for (const l of ls) {
        const line = node('div');
        const a = node('a', l.team + ' / ' + l.object);
        a.href = '../timovi/' + l.team + '.html';
        line.append(a, node('span', ' — ' + l.claimTitle));
        line.append(node('q', l.quote));
        read.append(line);
      }
      if (!ls.length) read.append(node('q', 'Nema zapisa.'));
    }
    show(pts[pts.length - 1]);

    /* ---- materials ---- */
    for (const e of d.entities.filter(e => e.kind === 'materijal')) {
      const r = node('div', undefined, 'row');
      r.append(node('b', e.name), node('span', String(e.links), 'n'),
        node('small', e.teams.join(' · ')));
      $('#materials').append(r);
    }

    /* ---- organisations, institutions, people ---- */
    const order = { organizacija: 0, institucija: 1, osoba: 2 };
    const actors = d.entities.filter(e => order[e.kind] !== undefined)
      .sort((a, b) => order[a.kind] - order[b.kind] || b.links - a.links || a.name.localeCompare(b.name, 'sr'));
    for (const e of actors) {
      const r = node('div', undefined, 'row'), ls = linksOf(e.id);
      const label = node('b', e.name);
      if (e.status === 'izvedeno') label.append(node('small', ' · ime izvedeno iz rečenice'));
      const what = node('small', (e.role ? e.role + ' · ' : '') + ls.map(l => l.team).join(' · '));
      if (ls[0]) what.title = ls[0].quote;
      r.append(label, node('span', String(e.links), 'n'), what);
      $('#actors').append(r);
    }

    /* ---- the one measured workforce ---- */
    if (d.workforce && d.trades.length) {
      const w = d.workforce, max = d.trades[0].days;
      $('#labour-note').textContent = 'Jedina izbrojana radna snaga u celom registru: ' +
        nf.format(w.total) + ' nadnica na objektu ' + w.object + ' (' + w.team + '), ' +
        nf.format(w.qualified) + ' kvalifikovanih i ' + nf.format(w.common) + ' običnih, pročitano sa ' +
        w.lists.length + ' platna spiska (' + w.lists.map(l => l.from + ' → ' + l.to).join('; ') +
        '). Ovo važi za taj objekat i to razdoblje, ni za jedan drugi.';
      for (const t of d.trades) {
        const b = node('div', undefined, 'bar'), track = node('div'), fill = node('i');
        fill.style.width = Math.max(1.5, t.days / max * 100) + '%';
        track.append(fill);
        b.append(node('span', t.name), track, node('span', nf.format(t.days), 'n'));
        $('#labour').append(b);
      }
    } else $('#labour-note').textContent = 'Nijedan pročitani platni spisak nije dostupan.';

    /* ---- machine ---- */
    const m = d.machine;
    if (m) for (const [k, v] of [
      ['Visina dizanja', m.hoistMetres != null ? m.hoistMetres.toFixed(2) + ' m' : '—'],
      ['Stajališta', m.stops], ['Nosivost', m.capacityKg ? m.capacityKg + ' kg' : '—'],
      ['Brzina', m.speed], ['Struja', m.power], ['Porudžbina', m.order], ['Objekat', m.team]
    ]) {
      if (v === undefined || v === null || v === '') continue;
      const r = node('div', undefined, 'row');
      r.append(node('b', k), node('span', ''), node('small', String(v)));
      $('#machine').append(r);
    }
    else $('#machine').append(node('p', 'Nijedna mašina nema fabrički list u registru.'));

    /* ---- the hole, said out loud ---- */
    $('#gap-note').textContent = d.gaps.length + ' od ' + d.counts.teams +
      ' timova nema nijedan zapis o materijalu, a ' + (d.counts.teams - d.counts.teamsWithOrigin) +
      ' nema imenovano poreklo. To je najveći nalaz ove stranice: pasoš grada za sada pokriva ' +
      d.counts.teamsWithOrigin + ' objekta. Spisak ispod je spisak posla, ne spisak propusta.';
    for (const g of d.gaps) {
      const a = node('a', g.team + ' / ' + g.object + (g.records ? ' · ' + g.records + ' zapisa' : ' · bez zapisa'));
      a.href = '../timovi/' + g.team + '.html';
      $('#gaps').append(a);
    }

    $('#method').textContent = 'Metod: ' + d.method + ' Sastavljeno ' +
      new Date(d.builtAt).toLocaleDateString('sr-RS') + ' iz stanja ' + d.datasetRevision +
      ' · rečnik: ' + d.lexicon.materials + ' materijala, ' + d.lexicon.places + ' mesta, ' +
      d.lexicon.organisations + ' organizacija · otisak ' + d.sha256 + '.';
  }
})();
