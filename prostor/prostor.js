/* Object 001 in space — the instrument.
   Objekat 001 u prostoru — instrument.

   The scene is dark until evidence is picked up. Every line that appears is
   carried by a named source; put the source down and the line goes out.
   Nothing here decides what is true: all states come from model.js, which
   derives them from the passport record.

   Division of labour on this page:
     model.js   arithmetic, states, geometry in metres — no DOM, no GL
     prostor.js drawing, camera, input, and writing the record into the DOM
     the DOM    carries the whole content; the canvas is the instrument, not
                the document. With WebGL missing the page still reads.

   Zero dependencies, zero external resources. WebGL 1 shaders, so the page
   runs on a phone that never heard of WebGL 2.
*/
(function () {
  'use strict';

  var M = window.ProstorModel;
  var $ = function (s) { return document.querySelector(s); };
  var root = document.documentElement;
  var KEY = 'or-studio-v1:lang';

  /* ------------------------------------------------------------- language */
  var lang = 'en';
  try { lang = JSON.parse(localStorage.getItem(KEY)) === 'sr' ? 'sr' : 'en'; } catch (e) { lang = 'en'; }
  function tr(v) { return !v ? '' : (typeof v === 'string' ? v : (v[lang] || v.en || '')); }
  function say(en, sr) { return lang === 'sr' ? sr : en; }

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --------------------------------------------------------------- state */
  var scene = null;
  var held = [];            /* source ids currently in hand */
  var selected = null;      /* part key */
  var variant = {};         /* part key -> variant index */
  var view = 'object';      /* object | route | time */
  var intensity = {};       /* part key -> 0..1, eased */
  var target = {};
  var cam = { yaw: 0.62, pitch: 0.17, dist: 500, tx: 0, ty: 14, tz: 0 };
  var camTarget = { yaw: 0.62, pitch: 0.17, dist: 500 };
  var gl = null, prog = null, buf = {}, geom = null, dirty = true, raf = 0;
  var stage, canvas, overlay;

  /* ----------------------------------------------------------- GL set-up */
  var VERT =
    'attribute vec3 aPos;attribute float aKind;attribute float aI;' +
    'uniform mat4 uMVP;' +
    'varying float vI;varying float vKind;varying float vD;' +
    'void main(){vI=aI;vKind=aKind;' +
    'gl_Position=uMVP*vec4(aPos,1.0);vD=gl_Position.w;}';
  var FRAG =
    'precision mediump float;uniform float uNear;' +
    'varying float vI;varying float vKind;varying float vD;' +
    'void main(){' +
    /* 0 structure · 1 the second figure · 2 void cage · 3 field · 4 surface · 5 guide */
    ' vec3 c=vec3(0.95,0.94,0.90); float a=vI;' +
    ' if(vKind>0.5&&vKind<1.5){ c=vec3(1.00,0.78,0.33); }' +
    ' if(vKind>1.5&&vKind<2.5){ c=vec3(0.60,0.58,0.53); a=vI*0.92; }' +
    ' if(vKind>2.5&&vKind<3.5){ c=vec3(0.29,0.80,0.95); a=vI*0.7; }' +
    ' if(vKind>3.5&&vKind<4.5){ c=vec3(0.45,0.60,1.00); a=vI*0.17; }' +
    ' if(vKind>4.5){ c=vec3(0.33,0.36,0.40); a=vI*0.5; }' +
    /* depth makes the far side of the object recede into the dark it came
       out of; it never changes what is drawn, only how far away it reads */
    ' a *= 1.0 - clamp((vD-uNear)/900.0, 0.0, 0.55);' +
    ' if(a<=0.004) discard;' +
    ' gl_FragColor=vec4(c*(0.62+0.38*vI), a);}';

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function initGL() {
    /* preserveDrawingBuffer costs a little and buys a lot: the proof gate can
       read the pixels back and show that the object was actually drawn,
       instead of only that the canvas had a size. */
    var opts = { antialias: true, alpha: false, premultipliedAlpha: false,
                 preserveDrawingBuffer: true, powerPreference: 'low-power' };
    gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts)
       || canvas.getContext('experimental-webgl', opts);
    if (!gl) return false;
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    buf.pos = gl.createBuffer(); buf.kind = gl.createBuffer(); buf.i = gl.createBuffer();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }

  /* ------------------------------------------------------ scene assembly */
  /* One flat vertex list for everything drawn, so the whole scene is one
     draw call per primitive type. Each vertex remembers which part it
     belongs to, and the per-frame intensity buffer is written from that. */
  function assemble() {
    var pos = [], kind = [], owner = [], lineIdx = [], triIdx = [];

    function push(g, partKey, kindCode) {
      if (!g) return;
      var base = pos.length / 3, i;
      for (i = 0; i < g.nodes.length; i++) {
        pos.push(g.nodes[i][0], g.nodes[i][1], g.nodes[i][2]);
        kind.push(kindCode); owner.push(partKey);
      }
      for (i = 0; i < (g.lines || []).length; i++) lineIdx.push(base + g.lines[i][0], base + g.lines[i][1]);
      for (i = 0; i < (g.tris || []).length; i++) triIdx.push(base + g.tris[i][0], base + g.tris[i][1], base + g.tris[i][2]);
    }

    if (view === 'object') {
      scene.parts.forEach(function (p) {
        if (p.role === 'mark' || p.role === 'mass') return;        /* no body: content only */
        var n = Math.max(1, p.variants.length), vi;
        for (vi = 0; vi < n; vi++) {
          var g = M.geometryOf(scene, p.k, vi);
          if (!g) continue;
          var code = p.role === 'void' || p.state === 'unknown' ? 2
                   : p.role === 'field' ? 3
                   : (n > 1 && vi === 1) ? 1 : 0;
          push(g, p.k + (n > 1 ? '#' + vi : ''), code);
          if (g.tris) {
            var base = pos.length / 3 - g.nodes.length, i;
            /* surfaces are drawn as their own faint kind */
            for (i = 0; i < g.nodes.length; i++) kind[base + i] = 4;
          }
        }
      });
      /* No ground and no water are drawn. The passport verified no coastline,
         bank or terrain geometry, so inventing one here would be the exact
         mistake this page is about. */
    } else if (view === 'route') {
      var pg = M.placeGeometry(scene), known = pg.nodes.filter(function (n) { return n.known; });
      var s = 0.42;                                                /* km -> drawing units */
      known.forEach(function (n) {
        var a = [n.at[0] * s, 0, n.at[2] * s], r = 14;
        push({ nodes: [[a[0] - r, 0, a[2]], [a[0] + r, 0, a[2]], [a[0], 0, a[2] - r], [a[0], 0, a[2] + r],
                       [a[0], 0, a[2]], [a[0], 26, a[2]]],
               lines: [[0, 1], [2, 3], [4, 5]] }, 'place:' + n.k, n.role === 'dropped' ? 2 : 0);
      });
      for (var i = 0; i < known.length - 1; i++) {
        var a = known[i], b = known[i + 1];
        push({ nodes: [[a.at[0] * s, 0, a.at[2] * s], [b.at[0] * s, 0, b.at[2] * s]], lines: [[0, 1]] },
             'leg:' + a.k, 5);
      }
      push({ nodes: [[0, 0, 0], [0, 40, 0]], lines: [[0, 1]] }, '#guide', 5);
    } else {
      /* time: the record as a vertical axis, one bar per dated event */
      var ev = scene.timeline, y0 = 1942, y1 = 2025, H = 300;
      ev.forEach(function (e) {
        var y = (e.y - y0) / (y1 - y0) * H - H / 2, w = 24 + (e.s || []).length * 26;
        push({ nodes: [[-w, y, 0], [w, y, 0], [-w, y, 0], [-w, y + 6, 0]],
               lines: [[0, 1], [2, 3]] }, 'event:' + e.y, 0);
      });
      push({ nodes: [[0, -H / 2, 0], [0, H / 2, 0]], lines: [[0, 1]] }, '#guide', 5);
    }

    geom = {
      pos: new Float32Array(pos), kind: new Float32Array(kind), owner: owner,
      lineIdx: lineIdx, triIdx: triIdx, count: pos.length / 3,
      inten: new Float32Array(pos.length / 3)
    };
    if (gl) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos);  gl.bufferData(gl.ARRAY_BUFFER, geom.pos, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.kind); gl.bufferData(gl.ARRAY_BUFFER, geom.kind, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.i);    gl.bufferData(gl.ARRAY_BUFFER, geom.inten, gl.DYNAMIC_DRAW);
      buf.lines = buf.lines || gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.lines);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geom.lineIdx), gl.STATIC_DRAW);
      buf.tris = buf.tris || gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.tris);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geom.triIdx), gl.STATIC_DRAW);
    }
    dirty = false;
  }

  /* --------------------------------------------------- what is lit, and why */
  function wantedIntensity(ownerKey) {
    if (ownerKey === '#guide') return 0.5;
    if (view === 'route') {
      var pk = ownerKey.split(':')[1];
      var pl = scene.places.filter(function (x) { return x.k === pk; })[0];
      if (!pl) return held.length ? 0.5 : 0;
      return (pl.s || []).some(function (s) { return held.indexOf(s) >= 0; }) ? 1 : 0;
    }
    if (view === 'time') {
      var y = Number(ownerKey.split(':')[1]);
      var e = scene.timeline.filter(function (x) { return x.y === y; })[0];
      if (!e) return 0;
      return (e.s || []).some(function (s) { return held.indexOf(s) >= 0; }) ? 1 : 0;
    }
    var hash = ownerKey.split('#'), key = hash[0], vi = hash.length > 1 ? Number(hash[1]) : 0;
    var p = M.part(scene, key);
    if (!p) return 0;
    /* An unknown is visible as a void only once the viewer holds the source
       that establishes the question. It is a finding, not a default. */
    if (p.state === 'unknown') {
      var anchored = p.src.length === 0 || p.src.some(function (s) { return held.indexOf(s) >= 0; });
      if (!anchored && held.length === 0) return 0;
      return selected === p.k ? 0.85 : 0.3;
    }
    if (!M.litWith(p, held)) return 0;
    /* A variant is only drawn if a source in hand carries THAT figure. The
       conflict is not a style: put down the source that reports the shorter
       span and that arch goes out, leaving the longer one alone. */
    if (p.variants.length > 1) {
      var v = p.variants[vi];
      if (!v || !v.src.some(function (s) { return held.indexOf(s) >= 0; })) return 0;
    }
    var base = p.solidity;
    if (selected && selected !== p.k) base *= 0.3;
    if (selected === p.k) base = Math.min(1, base + 0.25);
    return base;
  }

  function refreshTargets() {
    if (!geom) return;
    var cache = {};
    for (var i = 0; i < geom.owner.length; i++) {
      var o = geom.owner[i];
      if (!(o in cache)) cache[o] = wantedIntensity(o);
      target[o] = cache[o];
    }
  }

  /* ------------------------------------------------------------- drawing */
  function resize() {
    var r = stage.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return r;
  }

  function draw() {
    raf = 0;
    if (!gl || !scene) return;
    if (dirty) { assemble(); refreshTargets(); }
    var r = resize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.043, 0.051, 0.063, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    /* ease towards the target; with reduced motion, arrive at once */
    var moving = false, i, o, cur, want, step = reduced ? 1 : 0.11;
    var seen = {};
    for (i = 0; i < geom.owner.length; i++) {
      o = geom.owner[i];
      if (!(o in seen)) {
        cur = intensity[o] || 0; want = target[o] || 0;
        if (Math.abs(want - cur) > 0.002) { cur += (want - cur) * step; moving = true; }
        else cur = want;
        intensity[o] = cur; seen[o] = cur;
      }
      geom.inten[i] = seen[o];
    }
    /* camera easing shares the same switch */
    ['yaw', 'pitch', 'dist'].forEach(function (k) {
      var d = camTarget[k] - cam[k];
      if (Math.abs(d) > (k === 'dist' ? 0.4 : 0.0015)) { cam[k] += d * (reduced ? 1 : 0.16); moving = true; }
      else cam[k] = camTarget[k];
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, buf.i);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, geom.inten);

    var aspect = Math.max(0.2, r.width / Math.max(1, r.height));
    /* Keep the initial horizontal field of view on a square phone canvas.
       Only projection changes: orbit, zoom and all evidence geometry remain
       the same. Wide screens retain the original vertical field of view. */
    var fov = 2 * Math.atan(Math.tan(0.72 / 2) * Math.max(1, 1.4 / aspect));
    var P = M.perspective(fov, aspect, 2, 6000);
    var tgt = [cam.tx, cam.ty, cam.tz];
    var eye = M.orbitEye(tgt, cam.dist, cam.yaw, cam.pitch);
    var V = M.lookAt(eye, tgt, [0, 1, 0]);
    var mvp = M.mul(P, V);

    gl.useProgram(prog);
    gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uMVP'), false, new Float32Array(mvp));
    /* where the fade starts: a viewing distance, not a dimension of the object */
    gl.uniform1f(gl.getUniformLocation(prog, 'uNear'), cam.dist * 0.8);
    bind('aPos', buf.pos, 3); bind('aKind', buf.kind, 1); bind('aI', buf.i, 1);

    if (geom.triIdx.length) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.tris);
      gl.drawElements(gl.TRIANGLES, geom.triIdx.length, gl.UNSIGNED_SHORT, 0);
    }
    if (geom.lineIdx.length) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.lines);
      gl.drawElements(gl.LINES, geom.lineIdx.length, gl.UNSIGNED_SHORT, 0);
    }
    placeMarkers(mvp, r);
    if (moving) schedule();
  }
  function bind(name, b, size) {
    var l = gl.getAttribLocation(prog, name);
    if (l < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(draw); }

  /* --------------------------------------------- markers over the canvas */
  /* Decoration only: every marker here has a real, focusable twin in the
     side list, which is the control the keyboard and a screen reader use. */
  function placeMarkers(mvp, r) {
    if (view !== 'object') { overlay.textContent = ''; return; }
    var want = scene.parts.filter(function (p) {
      return (intensity[p.k] || intensity[p.k + '#0'] || 0) > 0.05 || selected === p.k;
    });
    if (overlay.childElementCount !== want.length) {
      overlay.textContent = '';
      want.forEach(function (p) {
        var el = document.createElement('span');
        el.className = 'mk';
        el.dataset.part = p.k;
        el.innerHTML = '<i></i><b></b>';
        overlay.appendChild(el);
      });
    }
    Array.prototype.forEach.call(overlay.children, function (el, n) {
      var p = want[n]; if (!p) return;
      el.dataset.part = p.k;
      var q = M.project(mvp, p.at);
      if (!q) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.transform = 'translate(' + ((q[0] * 0.5 + 0.5) * r.width).toFixed(1) + 'px,'
                         + ((1 - (q[1] * 0.5 + 0.5)) * r.height).toFixed(1) + 'px)';
      el.className = 'mk st-' + p.state + (selected === p.k ? ' sel' : '');
      el.lastChild.textContent = selected === p.k ? tr(p.label) : '';
    });
  }

  /* -------------------------------------------------------------- panels */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  var STATE_LABEL = {
    'confirmed':     { en: 'Confirmed',      sr: 'Potvrđeno' },
    'single-source': { en: 'One source only', sr: 'Samo jedan izvor' },
    'conflicting':   { en: 'Sources conflict', sr: 'Izvori u sukobu' },
    'probable':      { en: 'Probable',       sr: 'Verovatno' },
    'unconfirmed':   { en: 'Unconfirmed',    sr: 'Nepotvrđeno' },
    'unknown':       { en: 'Unknown',        sr: 'Nepoznato' }
  };
  var ROLE_LABEL = {
    volume: { en: 'drawn as structure', sr: 'crta se kao konstrukcija' },
    void:   { en: 'drawn as a marked absence', sr: 'crta se kao obeležena šupljina' },
    field:  { en: 'drawn as a field, never a body', sr: 'crta se kao polje, nikad kao telo' },
    mark:   { en: 'carries no geometry', sr: 'ne nosi geometriju' },
    mass:   { en: 'a weight, not a shape', sr: 'težina, ne oblik' }
  };

  function renderSources() {
    var rack = $('#rack');
    rack.textContent = '';
    scene.sources.forEach(function (s) {
      var b = el('button', 'src');
      b.type = 'button';
      b.id = 'src-' + s.id;
      b.setAttribute('aria-pressed', held.indexOf(s.id) >= 0 ? 'true' : 'false');
      b.appendChild(el('span', 'src-id', s.id));
      b.appendChild(el('span', 'src-pub', s.pub));
      b.appendChild(el('span', 'src-n',
        s.parts.length + ' ' + say('parts', 'delova') +
        (s.sole.length ? ' · ' + s.sole.length + ' ' + say('only here', 'samo odavde') : '')));
      b.addEventListener('click', function () { toggleSource(s.id); });
      rack.appendChild(b);
    });
  }

  function renderList() {
    var list = $('#parts');
    list.textContent = '';
    scene.lanes.forEach(function (lane) {
      var sec = el('section', 'lane');
      var h = el('h3', null, tr(lane.label));
      h.id = 'lane-' + lane.id;
      sec.appendChild(h);
      sec.appendChild(el('p', 'lane-scope', tr(lane.scope)));
      var ul = el('ul', 'lane-parts');
      ul.setAttribute('aria-labelledby', h.id);
      lane.parts.forEach(function (k) {
        var p = M.part(scene, k);
        var li = el('li');
        var b = el('button', 'part st-' + p.state);
        b.type = 'button';
        b.id = 'part-' + p.k;
        b.setAttribute('aria-pressed', selected === p.k ? 'true' : 'false');
        var lit = M.litWith(p, held);
        b.classList.toggle('dark', !lit && p.state !== 'unknown');
        b.appendChild(el('span', 'part-name', tr(p.label)));
        b.appendChild(el('span', 'part-state', tr(STATE_LABEL[p.state])));
        if (p.variants.length > 1) {
          b.appendChild(el('span', 'part-var',
            p.variants.map(function (v) { return v.v + ' ' + v.u; }).join('  /  ')));
        } else if (p.variants.length === 1) {
          b.appendChild(el('span', 'part-var',
            (p.variants[0].approx ? '≈ ' : '') + p.variants[0].v + ' ' + p.variants[0].u));
        }
        b.addEventListener('click', function () { select(p.k); });
        li.appendChild(b);
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      list.appendChild(sec);
    });
  }

  function renderRead() {
    var box = $('#read');
    box.textContent = '';
    if (!selected) {
      box.appendChild(el('p', 'read-empty',
        say('Pick up a source on the left, or choose a part of the record below. Nothing is drawn that a source does not carry.',
            'Uzmi izvor levo ili izaberi deo zapisa ispod. Ne crta se ništa što izvor ne nosi.')));
      return;
    }
    var p = M.part(scene, selected);
    box.appendChild(el('p', 'read-eyebrow',
      say('Part of the record', 'Deo zapisa') + ' · ' + tr(ROLE_LABEL[p.role])));
    box.appendChild(el('h2', null, tr(p.question)));

    var badge = el('p', 'read-states');
    badge.appendChild(el('b', 'st-' + p.state, tr(STATE_LABEL[p.state])));
    if (p.refined) {
      badge.appendChild(el('span', null,
        ' · ' + say('this measure, inside a claim recorded as: ', 'ova mera, u tvrdnji zapisanoj kao: ')));
      badge.appendChild(el('b', 'st-' + p.claimState + ' faint', tr(STATE_LABEL[p.claimState])));
    }
    box.appendChild(badge);

    if (p.value) box.appendChild(el('p', 'read-value', tr(p.value)));

    if (p.variants.length > 1) {
      var vwrap = el('div', 'variants');
      vwrap.appendChild(el('p', 'variants-head',
        say('Two figures are on record. Both are drawn. Neither is preferred.',
            'Dva broja su u zapisu. Oba se crtaju. Nijedan nije izabran.')));
      p.variants.forEach(function (v, i) {
        var row = el('div', 'variant v' + i);
        row.appendChild(el('b', null, (v.approx ? '≈ ' : '') + v.v + ' ' + v.u));
        row.appendChild(el('span', 'variant-by', tr(v.by)));
        row.appendChild(el('span', 'variant-src', v.src.join(' · ')));
        row.classList.toggle('off', !v.src.some(function (s) { return held.indexOf(s) >= 0; }));
        vwrap.appendChild(row);
      });
      box.appendChild(vwrap);
    }

    if (p.note) box.appendChild(el('p', 'read-note', tr(p.note)));
    p.flags.forEach(function (f) {
      box.appendChild(el('p', 'read-flag', '⚑ ' + tr(f)));
    });

    var srcLine = el('p', 'read-src');
    srcLine.appendChild(el('span', 'k', say('Carried by', 'Nosi ga')));
    if (!p.src.length) {
      srcLine.appendChild(el('span', null, say('no source — this is the finding',
                                               'nijedan izvor — to je nalaz')));
    } else {
      p.src.forEach(function (id) {
        var s = scene.sources.filter(function (x) { return x.id === id; })[0];
        var a = el('a', 'read-srcid', id);
        a.href = s && /^https?:/.test(s.url || '') ? s.url : '#';
        a.rel = 'noreferrer';
        a.title = s ? s.pub : id;
        a.classList.toggle('off', held.indexOf(id) < 0);
        srcLine.appendChild(a);
      });
    }
    box.appendChild(srcLine);

    if (p.next) {
      var nx = el('p', 'read-next');
      nx.appendChild(el('span', 'k', say('Next step', 'Sledeći korak')));
      nx.appendChild(document.createTextNode(tr(p.next)));
      box.appendChild(nx);
    }
    if (p.checked) {
      box.appendChild(el('p', 'read-checked',
        say('Checked ', 'Provereno ') + p.checked + ' · ' + say('claim', 'tvrdnja') + ' ' + p.claim +
        (p.mk ? ' / ' + p.mk : '')));
    }
  }

  function renderCoverage() {
    var c = M.coverage(scene, held);
    var bar = $('#cov-bar');
    bar.textContent = '';
    scene.parts.forEach(function (p) {
      var cell = el('span', 'cell st-' + p.state);
      cell.classList.toggle('on', M.litWith(p, held));
      cell.title = tr(p.label) + ' — ' + tr(STATE_LABEL[p.state]);
      bar.appendChild(cell);
    });
    $('#cov-text').textContent =
      say(c.lit + ' of ' + c.total + ' parts of the object are carried by the ' + c.held +
            ' source' + (c.held === 1 ? '' : 's') + ' in hand. ' + c.unknown +
            ' can never be lit: no source answers them, and that is the finding.',
          c.lit + ' od ' + c.total + ' delova objekta nosi ' + c.held +
            (c.held === 1 ? ' izvor' : (c.held < 5 ? ' izvora' : ' izvora')) + ' u ruci. ' + c.unknown +
            ' nikada ne može da zasvetli: nijedan izvor na njih ne odgovara, i to je nalaz.');
  }

  function renderAll() {
    renderSources(); renderList(); renderRead(); renderCoverage();
    /* The empty scene has to say why it is empty, or it just reads broken. */
    var hint = $('#dark-hint');
    if (hint) hint.hidden = held.length > 0 || view !== 'object';
    refreshTargets(); schedule();
    if (scene) writeAddress();
  }

  /* ------------------------------------------------------------- actions */
  function announce(t) { var a = $('#announce'); if (a) a.textContent = t; }

  function toggleSource(id) {
    var i = held.indexOf(id);
    if (i >= 0) held.splice(i, 1); else held.push(id);
    var c = M.coverage(scene, held);
    announce(say('Source ' + id + (i >= 0 ? ' put down. ' : ' taken up. ') + c.lit + ' of ' + c.total + ' parts lit.',
                 'Izvor ' + id + (i >= 0 ? ' je spušten. ' : ' je uzet. ') + c.lit + ' od ' + c.total + ' delova svetli.'));
    renderAll();
  }
  function select(k) {
    selected = selected === k ? null : k;
    var p = selected && M.part(scene, selected);
    if (p && view === 'object') {
      camTarget.dist = M.clampDist(p.role === 'void' ? 260 : 380);
      cam.tx = p.at[0] * 0.55; cam.ty = Math.max(6, p.at[1] * 0.7 + 8); cam.tz = 0;
    }
    renderList(); renderRead(); refreshTargets(); schedule();
    if (p) {
      announce(tr(p.label) + ' — ' + tr(STATE_LABEL[p.state]));
      /* The parts list sits below the reading panel, so a selection made from
         it would otherwise land off screen. The stage is sticky on a wide
         screen, so the object stays in view while the record comes up. */
      var box = $('#read'), r = box.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) {
        box.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
      }
    }
  }
  function setView(v) {
    /* A selection only survives inside the scene that can show it. */
    if (v !== view) selected = null;
    view = v; dirty = true;
    camTarget.dist = v === 'route' ? 700 : v === "time" ? 400 : 500;
    cam.tx = cam.tz = 0; cam.ty = v === "object" ? 14 : 0;
    document.querySelectorAll('#views button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.view === v ? 'true' : 'false');
    });
    $('#view-note').textContent = v === 'object'
      ? say('The object, drawn only where evidence carries it.', 'Objekat, nacrtan samo tamo gde ga dokaz nosi.')
      : v === 'route'
        ? tr(scene.placeNote)
        : say('Ten dated events. A bar lights when a source in hand records it.',
              'Deset datiranih događaja. Traka svetli kad je zabeleži izvor u ruci.');
    renderRead(); refreshTargets(); schedule();
  }

  var revealTimer = 0;
  function reveal() {
    if (revealTimer) { clearInterval(revealTimer); revealTimer = 0; }
    held = []; selected = null; renderAll();
    var queue = scene.sources.map(function (s) { return s.id; });
    if (reduced) { held = queue.slice(); renderAll(); announce(say('All sources taken up.', 'Svi izvori su uzeti.')); return; }
    var n = 0;
    revealTimer = setInterval(function () {
      if (n >= queue.length) { clearInterval(revealTimer); revealTimer = 0; return; }
      held.push(queue[n++]); renderAll();
    }, 1100);
  }

  /* --------------------------------------------------------------- input */
  function bindInput() {
    var drag = null, pinch = null;
    function pt(e) { return { x: e.clientX, y: e.clientY }; }

    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' && e.isPrimary === false) return;
      drag = pt(e); stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var p = pt(e);
      camTarget.yaw -= (p.x - drag.x) * 0.006;
      camTarget.pitch = M.clampPitch(camTarget.pitch + (p.y - drag.y) * 0.005);
      cam.yaw = camTarget.yaw; cam.pitch = camTarget.pitch;     /* drag is direct */
      drag = p; schedule();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
      stage.addEventListener(t, function () { drag = null; });
    });
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      camTarget.dist = M.clampDist(camTarget.dist * (1 + Math.sign(e.deltaY) * 0.12));
      schedule();
    }, { passive: false });

    stage.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                           e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true });
    stage.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && pinch) {
        e.preventDefault();
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                           e.touches[0].clientY - e.touches[1].clientY);
        camTarget.dist = M.clampDist(camTarget.dist * (pinch / Math.max(1, d)));
        cam.dist = camTarget.dist; pinch = d; schedule();
      }
    }, { passive: false });
    stage.addEventListener('touchend', function () { pinch = null; });

    /* The stage is focusable and driven entirely from the keyboard. */
    stage.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 0.28 : 0.1, used = true;
      switch (e.key) {
        case 'ArrowLeft':  camTarget.yaw -= step; break;
        case 'ArrowRight': camTarget.yaw += step; break;
        case 'ArrowUp':    camTarget.pitch = M.clampPitch(camTarget.pitch + step * 0.7); break;
        case 'ArrowDown':  camTarget.pitch = M.clampPitch(camTarget.pitch - step * 0.7); break;
        case '+': case '=': camTarget.dist = M.clampDist(camTarget.dist * 0.84); break;
        case '-': case '_': camTarget.dist = M.clampDist(camTarget.dist * 1.19); break;
        case 'Home': camTarget.yaw = 0.62; camTarget.pitch = 0.17;
                     camTarget.dist = 500; cam.tx = 0; cam.ty = 14; cam.tz = 0; break;
        default: used = false;
      }
      if (used) { e.preventDefault(); schedule(); }
    });
    window.addEventListener('resize', function () { schedule(); });
  }

  /* ---------------------------------------------------------------- boot */
  function fail(message) {
    root.classList.add('no-gl');
    var n = $('#gl-note');
    if (n) n.textContent = message;
  }

  /* ------------------------------------------------------- shared state */
  /* The address bar carries the state of the scene, so a teacher can hand out
     one link that opens on exactly the evidence being discussed. Unknown ids
     are dropped in silence rather than invented. */
  function readAddress() {
    var q = new URLSearchParams(location.search);
    var known = scene.sources.map(function (s) { return s.id; });
    (q.get('src') || '').split(',').forEach(function (id) {
      id = id.trim();
      if (id && known.indexOf(id) >= 0 && held.indexOf(id) < 0) held.push(id);
    });
    var p = q.get('part');
    if (p && M.part(scene, p)) selected = p;
    var v = q.get('view');
    if (['object', 'route', 'time'].indexOf(v) >= 0) view = v;
  }
  function writeAddress() {
    if (!history.replaceState) return;
    var q = [];
    if (held.length) q.push('src=' + held.join(','));
    if (selected) q.push('part=' + selected);
    if (view !== 'object') q.push('view=' + view);
    history.replaceState(null, '', location.pathname + (q.length ? '?' + q.join('&') : ''));
  }

  function start(passport) {
    scene = M.build(passport);
    stage = $('#stage'); canvas = $('#gl'); overlay = $('#overlay');

    $('#obj-name').textContent = tr(scene.name);
    $('#obj-life').textContent = scene.life;
    $('#obj-scope').textContent = tr(scene.scope);
    $('#obj-updated').textContent = scene.updated;

    var pl = $('#proportions');
    scene.proportions.forEach(function (p) { pl.appendChild(el('li', null, tr(p))); });
    $('#line-note').textContent = tr(scene.lineNote);
    $('#coord-note').textContent = tr(scene.coordNote);

    document.querySelectorAll('#views button').forEach(function (b) {
      b.addEventListener('click', function () { setView(b.dataset.view); });
    });
    $('#reveal').addEventListener('click', reveal);
    $('#clear').addEventListener('click', function () {
      held = []; selected = null; renderAll();
      announce(say('All sources put down. The object is dark.',
                   'Svi izvori su spušteni. Objekat je u mraku.'));
    });
    $('#all').addEventListener('click', function () {
      held = scene.sources.map(function (s) { return s.id; });
      renderAll();
      announce(say('All sources in hand.', 'Svi izvori su u ruci.'));
    });

    var ok = false;
    try { ok = initGL(); } catch (e) { ok = false; }
    if (!ok) {
      fail(say('This browser gives no WebGL, so the object is not drawn. Every claim, source, figure and next step on this page is still here and still readable.',
               'Ovaj browser ne daje WebGL, pa objekat nije nacrtan. Sve tvrdnje, izvori, brojevi i sledeći koraci na ovoj strani i dalje stoje i čitaju se.'));
    } else {
      bindInput(); dirty = true;
    }
    readAddress();
    setView(view);
    renderAll();
    document.body.classList.add('ready');
    document.documentElement.classList.add('prostor-ready');
  }

  /* Language is owned by app.js; this page follows the lang attribute. */
  new MutationObserver(function () {
    var next = root.lang.indexOf('sr') === 0 ? 'sr' : 'en';
    if (next === lang) return;
    lang = next;
    if (scene) { setView(view); renderAll(); }
  }).observe(root, { attributes: true, attributeFilter: ['lang'] });

  fetch('../data/pasos/objekat-001-savski-most.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(start)
    .catch(function (e) {
      fail(say('The passport record did not load (' + e.message + '). Nothing below is drawn from memory.',
               'Zapis pasoša nije učitan (' + e.message + '). Ništa ispod nije nacrtano po sećanju.'));
    });
})();
