/* Computing Studio · Grad Dokaza / Beograd — Živi Atlas
 * Advanced procedural 3D WebGL engine for architectural evidence exploration.
 * Zero external dependencies. High performance desktop and mobile.
 */
(function () {
  'use strict';

  var canvas = document.getElementById('world');
  var gl = canvas.getContext('webgl', { antialias: true, alpha: false, depth: true, powerPreference: 'high-performance' }) ||
           canvas.getContext('experimental-webgl', { antialias: true, depth: true });

  if (!gl) {
    document.querySelector('.stage').innerHTML = '<div style="padding:40px;text-align:center;color:#455a4c">WebGL nije podržan na ovom uređaju. Koristi <a href="../timovi.html">registar timova</a>.</div>';
    return;
  }

  // State
  var state = {
    viewMode: 'grad', // 'grad' | 'atlas' | 'mreza'
    night: false,
    selectedId: 'T12', // default Generalštab
    teams: [],
    confluence: null,
    // Camera
    cam: {
      yaw: -0.65,
      pitch: 0.52,
      dist: 120,
      target: [30, 2, 50],
      currentPos: [0, 0, 0],
      targetPos: [0, 0, 0],
      animating: false
    },
    drag: null,
    pointers: new Map(),
    pinchDist: 0,
    searchQuery: '',
    time: 0
  };

  // DOM Elements
  var modeBtn = document.getElementById('mode');
  var resetBtn = document.getElementById('reset');
  var plusBtn = document.getElementById('plus');
  var minusBtn = document.getElementById('minus');
  var searchInput = document.getElementById('team');
  var listEl = document.getElementById('list');
  var countEl = document.getElementById('count');
  var passportLink = document.getElementById('passport-link');
  var viewGradBtn = document.getElementById('view-grad');
  var viewAtlasBtn = document.getElementById('view-atlas');
  var viewMrezaBtn = document.getElementById('view-mreza');

  // Dossier elements
  var dossierEl = document.getElementById('dossier-card');
  var dBadge = document.getElementById('d-badge');
  var dTitle = document.getElementById('d-title');
  var dIndices = document.getElementById('d-indices');
  var dPlace = document.getElementById('d-place');
  var dTopic = document.getElementById('d-topic');
  var dStats = document.getElementById('d-stats');
  var dClaim = document.getElementById('d-claim');
  var dSource = document.getElementById('d-source');
  var dLink = document.getElementById('d-link');
  var dClose = document.getElementById('d-close');

  // Matrix math helpers (column-major)
  var M4 = {
    create: function () {
      return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    },
    perspective: function (out, fov, aspect, near, far) {
      var f = 1.0 / Math.tan(fov / 2);
      var nf = 1 / (near - far);
      out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
      out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
      out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
      out[12] = 0; out[13] = 0; out[14] = (2 * far * near) * nf; out[15] = 0;
      return out;
    },
    ortho: function (out, left, right, bottom, top, near, far) {
      var lr = 1 / (left - right), bt = 1 / (bottom - top), nf = 1 / (near - far);
      out[0] = -2 * lr; out[1] = 0; out[2] = 0; out[3] = 0;
      out[4] = 0; out[5] = -2 * bt; out[6] = 0; out[7] = 0;
      out[8] = 0; out[9] = 0; out[10] = 2 * nf; out[11] = 0;
      out[12] = (left + right) * lr; out[13] = (top + bottom) * bt; out[14] = (far + near) * nf; out[15] = 1;
      return out;
    },
    lookAt: function (out, eye, center, up) {
      var x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
      var eyex = eye[0], eyey = eye[1], eyez = eye[2];
      var upx = up[0], upy = up[1], upz = up[2];
      var centerx = center[0], centery = center[1], centerz = center[2];

      z0 = eyex - centerx; z1 = eyey - centery; z2 = eyez - centerz;
      len = 1 / Math.hypot(z0, z1, z2);
      z0 *= len; z1 *= len; z2 *= len;

      x0 = upy * z2 - upz * z1;
      x1 = upz * z0 - upx * z2;
      x2 = upx * z1 - upy * z0;
      len = 1 / Math.hypot(x0, x1, x2);
      x0 *= len; x1 *= len; x2 *= len;

      y0 = z1 * x2 - z2 * x1;
      y1 = z2 * x0 - z0 * x2;
      y2 = z0 * x1 - z1 * x0;
      len = 1 / Math.hypot(y0, y1, y2);
      y0 *= len; y1 *= len; y2 *= len;

      out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
      out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
      out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
      out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
      out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
      out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
      out[15] = 1;
      return out;
    },
    multiply: function (out, a, b) {
      var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
      var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

      var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
      out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
      out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
      out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
      out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

      b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
      out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
      out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
      out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
      out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

      b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
      out[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
      out[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
      out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
      out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

      b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
      out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
      out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
      out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
      out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
      return out;
    }
  };

  // Shaders
  var vsSource = [
    'attribute vec3 aPos;',
    'attribute vec3 aNormal;',
    'attribute vec3 aColor;',
    'attribute float aEmissive;',
    'uniform mat4 uMVP;',
    'uniform mat4 uModel;',
    'uniform vec3 uSunDir;',
    'varying vec3 vColor;',
    'varying float vLight;',
    'varying float vEmissive;',
    'varying float vDist;',
    'void main() {',
    '  vec4 worldPos = uModel * vec4(aPos, 1.0);',
    '  gl_Position = uMVP * vec4(aPos, 1.0);',
    '  vec3 norm = normalize((uModel * vec4(aNormal, 0.0)).xyz);',
    '  float diff = max(dot(norm, normalize(uSunDir)), 0.0);',
    '  float sky = max(norm.y * 0.35 + 0.65, 0.0);',
    '  vLight = diff * 0.75 + sky * 0.4;',
    '  vColor = aColor;',
    '  vEmissive = aEmissive;',
    '  vDist = length(worldPos.xz);',
    '}'
  ].join('\n');

  var fsSource = [
    'precision mediump float;',
    'varying vec3 vColor;',
    'varying float vLight;',
    'varying float vEmissive;',
    'varying float vDist;',
    'uniform vec3 uSkyColor;',
    'uniform float uNight;',
    'void main() {',
    '  vec3 lit = vColor * (uNight > 0.5 ? (vLight * 0.35 + 0.15) : vLight);',
    '  if (vEmissive > 0.1) {',
    '    lit = mix(lit, vColor * (1.6 + sin(vDist * 0.1) * 0.3), vEmissive);',
    '  }',
    '  // Soft atmospheric haze',
    '  float fog = clamp((vDist - 60.0) / 220.0, 0.0, 0.65);',
    '  vec3 finalColor = mix(lit, uSkyColor, fog);',
    '  gl_FragColor = vec4(finalColor, 1.0);',
    '}'
  ].join('\n');

  function createShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  var prog = gl.createProgram();
  gl.attachShader(prog, createShader(gl, gl.VERTEX_SHADER, vsSource));
  gl.attachShader(prog, createShader(gl, gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(prog);

  var uMVP = gl.getUniformLocation(prog, 'uMVP');
  var uModel = gl.getUniformLocation(prog, 'uModel');
  var uSunDir = gl.getUniformLocation(prog, 'uSunDir');
  var uSkyColor = gl.getUniformLocation(prog, 'uSkyColor');
  var uNight = gl.getUniformLocation(prog, 'uNight');

  var aPos = gl.getAttribLocation(prog, 'aPos');
  var aNormal = gl.getAttribLocation(prog, 'aNormal');
  var aColor = gl.getAttribLocation(prog, 'aColor');
  var aEmissive = gl.getAttribLocation(prog, 'aEmissive');

  // Vertex data builder
  var vertices = [];
  var normals = [];
  var colors = [];
  var emissives = [];

  function addTri(p1, p2, p3, norm, col, emis) {
    vertices.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2]);
    normals.push(norm[0], norm[1], norm[2], norm[0], norm[1], norm[2], norm[0], norm[1], norm[2]);
    colors.push(col[0], col[1], col[2], col[0], col[1], col[2], col[0], col[1], col[2]);
    emissives.push(emis, emis, emis);
  }

  function addQuad(p1, p2, p3, p4, norm, col, emis) {
    addTri(p1, p2, p3, norm, col, emis);
    addTri(p1, p3, p4, norm, col, emis);
  }

  function addBox(x, y, z, w, h, d, col, emis) {
    emis = emis || 0.0;
    var x0 = x - w/2, x1 = x + w/2;
    var y0 = y, y1 = y + h;
    var z0 = z - d/2, z1 = z + d/2;

    // Top
    addQuad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0], col, emis);
    // North
    addQuad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [col[0]*0.9, col[1]*0.9, col[2]*0.9], emis);
    // South
    addQuad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [col[0]*0.95, col[1]*0.95, col[2]*0.95], emis);
    // West
    addQuad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [col[0]*0.85, col[1]*0.85, col[2]*0.85], emis);
    // East
    addQuad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [col[0]*0.88, col[1]*0.88, col[2]*0.88], emis);
  }

  function addCylinder(x, y, z, radius, h, segments, col, emis) {
    emis = emis || 0.0;
    var prevX = x + radius, prevZ = z;
    for (var i = 1; i <= segments; i++) {
      var angle = (i / segments) * Math.PI * 2;
      var currX = x + Math.cos(angle) * radius;
      var currZ = z + Math.sin(angle) * radius;

      // Side
      var norm = [Math.cos(angle - Math.PI / segments), 0, Math.sin(angle - Math.PI / segments)];
      addQuad([prevX, y, prevZ], [currX, y, currZ], [currX, y + h, currZ], [prevX, y + h, prevZ], norm, col, emis);
      // Top cap
      addTri([x, y + h, z], [prevX, y + h, prevZ], [currX, y + h, currZ], [0, 1, 0], [col[0]*1.05, col[1]*1.05, col[2]*1.05], emis);
      prevX = currX;
      prevZ = currZ;
    }
  }

  function addDome(x, y, z, radius, segments, col, emis) {
    emis = emis || 0.0;
    var rings = 4;
    for (var r = 0; r < rings; r++) {
      var phi0 = (r / rings) * (Math.PI / 2);
      var phi1 = ((r + 1) / rings) * (Math.PI / 2);
      var y0 = y + Math.sin(phi0) * radius;
      var y1 = y + Math.sin(phi1) * radius;
      var r0 = Math.cos(phi0) * radius;
      var r1 = Math.cos(phi1) * radius;

      for (var s = 0; s < segments; s++) {
        var t0 = (s / segments) * Math.PI * 2;
        var t1 = ((s + 1) / segments) * Math.PI * 2;

        var p1 = [x + Math.cos(t0) * r0, y0, z + Math.sin(t0) * r0];
        var p2 = [x + Math.cos(t1) * r0, y0, z + Math.sin(t1) * r0];
        var p3 = [x + Math.cos(t1) * r1, y1, z + Math.sin(t1) * r1];
        var p4 = [x + Math.cos(t0) * r1, y1, z + Math.sin(t0) * r1];

        var norm = [Math.cos((t0+t1)/2), Math.sin((phi0+phi1)/2), Math.sin((t0+t1)/2)];
        addQuad(p1, p2, p3, p4, norm, col, emis);
      }
    }
  }

  // Build the complete 3D scene geometry
  function buildSceneGeometry() {
    vertices = []; normals = []; colors = []; emissives = [];

    var stoneLight = [0.88, 0.90, 0.86];
    var stoneWarm = [0.82, 0.81, 0.77];
    var stoneDark = [0.42, 0.48, 0.44];
    var brickRed = [0.76, 0.41, 0.35];
    var goldAccent = [0.95, 0.78, 0.35];
    var steelGreen = [0.38, 0.62, 0.52];
    var glassCyan = [0.55, 0.78, 0.82];
    var waterCol = [0.28, 0.44, 0.52];
    var groundPlain = [0.83, 0.85, 0.81];
    var groundRidge = [0.77, 0.79, 0.74];

    // 1. Terrain: Alluvial plain for Novi Beograd and elevated Ridge for Kalemegdan & Vračar
    addQuad([-160, 0, -120], [-160, 0, 160], [180, 0, 160], [180, 0, -120], [0, 1, 0], groundPlain, 0);

    // Kalemegdan & Old Belgrade elevated plateau (terrace)
    addBox(35, 0, 50, 120, 1.8, 140, groundRidge, 0);
    // Kalemegdan Citadel rock promontory overlooking Ušće
    addBox(12, 1.8, -10, 32, 2.4, 30, [0.72, 0.74, 0.68], 0);

    // Great War Island (Veliko Ratno Ostrvo) nature reserve
    addCylinder(-40, 0.1, -30, 22, 0.6, 12, [0.45, 0.62, 0.44], 0);

    // 2. Waterways: Sava and Danube rivers
    if (state.confluence) {
      // Sava riverbed ribbon
      var sPath = state.confluence.savaPath;
      for (var s = 0; s < sPath.length - 1; s++) {
        var a = sPath[s], b = sPath[s+1];
        var angle = Math.atan2(b[2] - a[2], b[0] - a[0]) + Math.PI / 2;
        var w = 11.0;
        var dx = Math.cos(angle) * w, dz = Math.sin(angle) * w;
        addQuad([a[0]-dx, 0.08, a[2]-dz], [b[0]-dx, 0.08, b[2]-dz], [b[0]+dx, 0.08, b[2]+dz], [a[0]+dx, 0.08, a[2]+dz], [0, 1, 0], waterCol, 0.12);
      }
      // Danube riverbed ribbon
      var dPath = state.confluence.danubePath;
      for (var d = 0; d < dPath.length - 1; d++) {
        var da = dPath[d], db = dPath[d+1];
        var dAngle = Math.atan2(db[2] - da[2], db[0] - da[0]) + Math.PI / 2;
        var dw = 16.0;
        var ddx = Math.cos(dAngle) * dw, ddz = Math.sin(dAngle) * dw;
        addQuad([da[0]-ddx, 0.07, da[2]-ddz], [db[0]-ddx, 0.07, db[2]-ddz], [db[0]+ddx, 0.07, db[2]+ddz], [da[0]+ddx, 0.07, da[2]+ddz], [0, 1, 0], waterCol, 0.15);
      }
    }

    // 3. Procedural Context Urban Blocks (creating the genuine Belgrade skyline fabric)
    var contextBlocks = [
      // Dorćol blocks
      [28, 1.8, -20, 14, 4.5, 12], [46, 1.8, -22, 16, 5.0, 14], [25, 1.8, 0, 12, 4.8, 16],
      // Knez Mihailova & Terazije ridge
      [18, 2.0, 25, 10, 6.2, 18], [28, 2.0, 35, 12, 7.5, 16], [32, 2.0, 48, 14, 8.0, 18],
      // Savamala & Waterfront
      [5, 0.2, 30, 12, 4.2, 14], [2, 0.2, 50, 15, 5.8, 18], [-4, 0.2, 75, 14, 6.5, 20],
      // Vračar slopes
      [48, 2.5, 75, 18, 5.5, 16], [62, 3.0, 85, 20, 6.0, 18], [42, 2.8, 95, 16, 5.2, 16],
      // Novi Beograd Modernist Mega-blocks
      [-35, 0.2, 25, 22, 4.0, 22], [-45, 0.2, 55, 24, 4.5, 24], [-75, 0.2, 35, 26, 4.2, 26],
      [-50, 0.2, -15, 20, 4.0, 20], [-80, 0.2, -20, 22, 4.5, 22]
    ];
    contextBlocks.forEach(function (b) {
      addBox(b[0], b[1], b[2], b[3], b[4], b[5], stoneWarm, 0);
    });

    // 4. Procedural Landmark Buildings & All 67 Teams
    state.teams.forEach(function (t) {
      var isSelected = (state.selectedId === t.id);
      var hasPass = t.hasPassport;
      var stage = t.progressStage || 0;
      var hScale = Math.max(1.0, stage * 1.1 + (t.claimsCount / 8));
      var markerCol = hasPass ? (isSelected ? [0.95, 0.42, 0.24] : [0.38, 0.72, 0.58]) :
                                (isSelected ? [0.95, 0.65, 0.25] : [0.65, 0.68, 0.64]);
      var emis = isSelected ? 0.85 : (hasPass ? 0.35 : 0.05);

      // Interactive Ground Plinth
      addBox(t.x, t.y, t.z, 5.0, 0.4, 5.0, markerCol, emis);

      // Building Geometry by Type
      if (t.type === 'hram') {
        // Hram Svetog Save: Tiered cross-in-square base, grand dome, 4 semi-domes, corner towers
        addBox(t.x, t.y + 0.4, t.z, 9.0, 3.2, 9.0, stoneLight, 0);
        addBox(t.x, t.y + 3.6, t.z, 7.5, 2.6, 7.5, stoneLight, 0);
        // Central Dome
        addDome(t.x, t.y + 6.2, t.z, 4.2, 10, stoneLight, emis * 0.5);
        // Golden Cross finial
        addBox(t.x, t.y + 10.4, t.z, 0.3, 1.8, 0.3, goldAccent, 0.8);
        addBox(t.x, t.y + 11.2, t.z, 1.2, 0.3, 0.3, goldAccent, 0.8);
        // 4 corner turrets
        var off = 3.6;
        addCylinder(t.x - off, t.y + 3.6, t.z - off, 0.9, 3.5, 6, stoneLight, 0);
        addCylinder(t.x + off, t.y + 3.6, t.z - off, 0.9, 3.5, 6, stoneLight, 0);
        addCylinder(t.x + off, t.y + 3.6, t.z + off, 0.9, 3.5, 6, stoneLight, 0);
        addCylinder(t.x - off, t.y + 3.6, t.z + off, 0.9, 3.5, 6, stoneLight, 0);
      }
      else if (t.type === 'generalstab') {
        // Nikola Dobrović's Stepped Modernist Canyon: Twin cascading blocks with street void
        // Block A
        addBox(t.x - 3.2, t.y + 0.4, t.z, 4.5, 2.2, 8.0, brickRed, 0);
        addBox(t.x - 3.2, t.y + 2.6, t.z, 3.6, 2.0, 7.0, stoneLight, 0);
        addBox(t.x - 3.2, t.y + 4.6, t.z, 2.5, 1.8, 5.5, brickRed, 0);
        // Block B
        addBox(t.x + 3.2, t.y + 0.4, t.z, 4.5, 2.2, 8.0, brickRed, 0);
        addBox(t.x + 3.2, t.y + 2.6, t.z, 3.6, 2.0, 7.0, stoneLight, 0);
        addBox(t.x + 3.2, t.y + 4.6, t.z, 2.5, 1.8, 5.5, brickRed, 0);
        // Tension beam linking the dispute
        addBox(t.x, t.y + 3.8, t.z, 6.4, 0.3, 0.3, goldAccent, emis * 0.9);
      }
      else if (t.type === 'beogradjanka') {
        // Palata Beograd: Commercial podium, slender dark tower shaft, mechanical crown & antenna
        addBox(t.x, t.y + 0.4, t.z, 7.0, 1.8, 7.0, stoneDark, 0);
        addBox(t.x, t.y + 2.2, t.z, 4.2, 11.5 * (hScale * 0.7), 4.2, stoneDark, emis * 0.3);
        // Vertical mullions
        addBox(t.x - 2.15, t.y + 2.2, t.z, 0.2, 11.5 * (hScale * 0.7), 4.2, goldAccent, 0.4);
        addBox(t.x + 2.15, t.y + 2.2, t.z, 0.2, 11.5 * (hScale * 0.7), 4.2, goldAccent, 0.4);
        // Penthouse and antenna mast
        var topY = t.y + 2.2 + 11.5 * (hScale * 0.7);
        addBox(t.x, topY, t.z, 3.0, 1.2, 3.0, stoneDark, 0);
        addBox(t.x, topY + 1.2, t.z, 0.2, 3.5, 0.2, [0.95, 0.3, 0.2], 0.9);
      }
      else if (t.type === 'most') {
        // Stari savski most: Tied-arch green steel truss across Sava
        addBox(t.x, t.y + 0.8, t.z, 2.8, 0.4, 18.0, steelGreen, 0);
        // Steel tied arches
        for (var ma = -6; ma <= 6; ma += 2) {
          var archH = 3.5 * Math.cos((ma / 7) * (Math.PI / 2));
          addBox(t.x - 1.2, t.y + 1.0 + archH/2, t.z + ma, 0.2, archH, 0.2, steelGreen, 0.3);
          addBox(t.x + 1.2, t.y + 1.0 + archH/2, t.z + ma, 0.2, archH, 0.2, steelGreen, 0.3);
        }
      }
      else if (t.type === 'silosi') {
        // Silosi Beograd: Cluster of monumental grain cylinders by Danube
        var sRad = 1.2, sH = 6.8;
        addCylinder(t.x - 1.4, t.y + 0.4, t.z - 1.4, sRad, sH, 8, stoneLight, 0);
        addCylinder(t.x + 1.4, t.y + 0.4, t.z - 1.4, sRad, sH, 8, stoneLight, 0);
        addCylinder(t.x - 1.4, t.y + 0.4, t.z + 1.4, sRad, sH, 8, stoneLight, 0);
        addCylinder(t.x + 1.4, t.y + 0.4, t.z + 1.4, sRad, sH, 8, stoneLight, 0);
        // Overhead gallery
        addBox(t.x, t.y + 0.4 + sH, t.z, 4.6, 1.2, 4.6, stoneDark, 0);
      }
      else if (t.type === 'bigz') {
        // BIGZ: Brašovan's stepped industrial monument with cylindrical drum staircase
        addBox(t.x, t.y + 0.4, t.z, 7.5, 3.8, 6.0, stoneWarm, 0);
        addBox(t.x + 1.2, t.y + 4.2, t.z, 5.0, 2.5, 5.0, stoneWarm, 0);
        addCylinder(t.x - 2.8, t.y + 0.4, t.z + 1.8, 1.8, 7.2, 8, stoneLight, emis * 0.4);
      }
      else if (t.type === 'kdistrict') {
        // K-District: Stepped perimeter blocks curving around historic Kalemegdan artillery bastions
        addBox(t.x - 2.0, t.y + 0.4, t.z - 1.8, 3.2, 4.8, 7.0, stoneLight, 0);
        addBox(t.x + 2.0, t.y + 0.4, t.z + 1.8, 3.2, 4.2, 6.5, stoneDark, 0);
        addBox(t.x, t.y + 0.4, t.z + 4.2, 6.0, 3.5, 2.5, brickRed, 0);
      }
      else if (t.type === 'savacentar') {
        // Sava Centar: Slanted faceted prism pavilion and glass crystal volumes
        addBox(t.x, t.y + 0.4, t.z, 9.0, 2.8, 7.0, glassCyan, 0.4);
        addBox(t.x + 2.5, t.y + 3.2, t.z - 1.5, 5.0, 2.0, 4.0, glassCyan, 0.5);
      }
      else if (t.type === 'palatasrbije') {
        // SIV / Palata Srbije: Symmetrical H-wing modernist palace
        addBox(t.x, t.y + 0.4, t.z, 14.0, 2.4, 4.0, stoneLight, 0);
        addBox(t.x - 5.5, t.y + 0.4, t.z + 2.5, 3.0, 2.2, 7.0, stoneLight, 0);
        addBox(t.x + 5.5, t.y + 0.4, t.z + 2.5, 3.0, 2.2, 7.0, stoneLight, 0);
      }
      else if (t.type === 'maj25') {
        // 25. Maj: Triangular cantilever mushroom canopy on Danube bank
        addBox(t.x, t.y + 0.4, t.z, 2.0, 2.8, 2.0, stoneDark, 0);
        addBox(t.x, t.y + 3.2, t.z, 7.0, 0.6, 7.0, stoneLight, 0.3);
      }
      else if (t.type === 'geneks') {
        // Western City Gate (Geneks): Brutalist twin towers, skybridge & rotating restaurant
        addBox(t.x - 2.0, t.y + 0.4, t.z, 2.8, 11.0, 3.5, stoneWarm, 0);
        addBox(t.x + 2.0, t.y + 0.4, t.z, 2.8, 9.5, 3.5, stoneWarm, 0);
        // Skybridge connecting towers
        addBox(t.x, t.y + 8.8, t.z, 3.8, 1.2, 2.2, stoneDark, 0);
        // Revolving restaurant drum on taller tower
        addCylinder(t.x - 2.0, t.y + 11.4, t.z, 2.2, 1.4, 8, goldAccent, 0.7);
      }
      else if (t.type === 'kulabeograd') {
        // Kula Beograd: Twisting tapered modern glass skyscraper
        addBox(t.x, t.y + 0.4, t.z, 4.8, 12.8, 4.8, glassCyan, 0.5);
        addBox(t.x, t.y + 13.2, t.z, 3.2, 2.2, 3.2, glassCyan, 0.8);
      }
      else {
        // Standard architectural block
        var bH = Math.max(1.8, stage * 1.3);
        addBox(t.x, t.y + 0.4, t.z, 3.8, bH, 3.8, stoneLight, emis * 0.4);
      }

      // Vertical Data Pillar in Night / Knowledge Mode
      if (hasPass || isSelected) {
        var beaconH = (isSelected ? 28.0 : (t.claimsCount * 0.8));
        addBox(t.x, t.y + 0.4, t.z, 0.18, beaconH, 0.18, isSelected ? [1.0, 0.5, 0.2] : [0.35, 0.85, 0.95], 1.0);
      }
    });

    // 5. Knowledge Network Splines in 'mreza' mode
    if (state.viewMode === 'mreza') {
      var netTeams = state.teams.filter(function (t) { return t.hasPassport; });
      for (var ni = 0; ni < netTeams.length; ni++) {
        var na = netTeams[ni];
        var nb = netTeams[(ni + 1) % netTeams.length];
        // Connect related teams with glowing bridge line
        var midX = (na.x + nb.x) / 2, midZ = (na.z + nb.z) / 2;
        var arcY = Math.max(na.y, nb.y) + 6.0;
        addBox(midX, arcY, midZ, 0.25, 0.25, Math.hypot(nb.x - na.x, nb.z - na.z) * 0.5, [0.3, 0.9, 0.8], 1.0);
      }
    }

    // Upload geometry to WebGL buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, bufPos);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufNorm);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufCol);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufEmis);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(emissives), gl.STATIC_DRAW);
  }

  // Create buffers
  var bufPos = gl.createBuffer();
  var bufNorm = gl.createBuffer();
  var bufCol = gl.createBuffer();
  var bufEmis = gl.createBuffer();

  // Matrices
  var pMat = M4.create();
  var vMat = M4.create();
  var mMat = M4.create();
  var mvpMat = M4.create();

  // Render loop
  function render() {
    state.time += 0.016;

    // Smooth camera interpolation
    if (state.cam.animating) {
      state.cam.yaw += (state.cam.targetYaw - state.cam.yaw) * 0.08;
      state.cam.pitch += (state.cam.targetPitch - state.cam.pitch) * 0.08;
      state.cam.dist += (state.cam.targetDist - state.cam.dist) * 0.08;
      state.cam.target[0] += (state.cam.targetLook[0] - state.cam.target[0]) * 0.08;
      state.cam.target[1] += (state.cam.targetLook[1] - state.cam.target[1]) * 0.08;
      state.cam.target[2] += (state.cam.targetLook[2] - state.cam.target[2]) * 0.08;

      if (Math.abs(state.cam.targetYaw - state.cam.yaw) < 0.002 &&
          Math.abs(state.cam.targetDist - state.cam.dist) < 0.1) {
        state.cam.animating = false;
      }
    }

    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = Math.round(rect.width * dpr);
    var height = Math.round(rect.height * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    var night = state.night;
    var skyColor = night ? [0.05, 0.09, 0.14] : [0.89, 0.91, 0.88];
    gl.clearColor(skyColor[0], skyColor[1], skyColor[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(prog);

    // Compute Camera Eye Position
    var aspect = width / height;
    var cy = state.cam.pitch;
    var cx = state.cam.yaw;
    var d = state.cam.dist;

    var eyeX = state.cam.target[0] + d * Math.cos(cy) * Math.sin(cx);
    var eyeY = state.cam.target[1] + d * Math.sin(cy);
    var eyeZ = state.cam.target[2] + d * Math.cos(cy) * Math.cos(cx);

    if (state.viewMode === 'atlas') {
      // Orthographic projection for Atlas view
      var oSize = d * 0.55;
      M4.ortho(pMat, -oSize * aspect, oSize * aspect, -oSize, oSize, 1.0, 500.0);
    } else {
      // Perspective projection for Grad and Mreža
      M4.perspective(pMat, Math.PI / 4, aspect, 1.0, 600.0);
    }

    M4.lookAt(vMat, [eyeX, eyeY, eyeZ], state.cam.target, [0, 1, 0]);
    M4.multiply(mvpMat, pMat, vMat);

    // Set Uniforms
    gl.uniformMatrix4fv(uMVP, false, mvpMat);
    gl.uniformMatrix4fv(uModel, false, mMat);
    gl.uniform3f(uSunDir, night ? -0.2 : 0.65, night ? 0.3 : 0.82, night ? 0.2 : -0.5);
    gl.uniform3fv(uSkyColor, skyColor);
    gl.uniform1f(uNight, night ? 1.0 : 0.0);

    // Bind Attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, bufPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPos);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufNorm);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aNormal);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufCol);
    gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aColor);

    gl.bindBuffer(gl.ARRAY_BUFFER, bufEmis);
    gl.vertexAttribPointer(aEmissive, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aEmissive);

    // Draw full scene
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 3);

    requestAnimationFrame(render);
  }

  // Camera fly-to animation
  function flyTo(targetPos, dist, yaw, pitch) {
    state.cam.targetLook = [targetPos[0], targetPos[1], targetPos[2]];
    state.cam.targetDist = dist || 55;
    state.cam.targetYaw = (yaw !== undefined) ? yaw : state.cam.yaw;
    state.cam.targetPitch = (pitch !== undefined) ? pitch : state.cam.pitch;
    state.cam.animating = true;
  }

  // Select team & open dossier
  function selectTeam(id) {
    state.selectedId = id;
    var t = state.teams.find(function (item) { return item.id === id; });
    if (!t) return;

    // Focus camera smoothly
    flyTo([t.x, t.y, t.z], t.hasPassport ? 45 : 60);

    // Update Dossier Card
    if (dossierEl) {
      dossierEl.hidden = false;
      dBadge.textContent = t.id + ' · ' + (t.hasPassport ? 'VERIFIKOVAN PASOŠ' : 'EVIDENCIJA U TOKU');
      dBadge.className = 'badge ' + (t.hasPassport ? 'verified' : 'pending');
      dTitle.textContent = t.object;
      dIndices.textContent = 'Studenti: ' + (t.indices.length ? t.indices.join(', ') : 'Zaveden tim');
      dPlace.textContent = t.place || 'Beograd';
      dTopic.textContent = t.topic || 'Arhitektonsko i inženjersko istraživanje';
      dStats.textContent = t.claimsCount + ' tvrdnji · ' + t.sectionsCount + ' oblasti · Nivo ' + t.progressStage;
      dClaim.textContent = '„' + t.previewClaim + '”';
      dSource.textContent = 'Izvor: ' + t.previewSource;
      dLink.href = 'pasosi.html#' + t.id;
      dLink.textContent = t.hasPassport ? 'Otvori kurirani pasoš (' + t.claimsCount + ' tvrdnji) →' : 'Prikaži tim u registru →';
    }

    if (passportLink) {
      passportLink.href = 'pasosi.html#' + id;
    }

    // Update active state in sidebar list
    var buttons = listEl.querySelectorAll('.item');
    for (var b = 0; b < buttons.length; b++) {
      buttons[b].setAttribute('aria-current', String(buttons[b].dataset.id === id));
    }

    // Rebuild geometry to update emissive highlight
    buildSceneGeometry();
  }

  // Search & Filter List
  function updateList() {
    var q = state.searchQuery.trim().toLowerCase();
    listEl.innerHTML = '';
    var matchCount = 0;

    state.teams.forEach(function (t) {
      if (q && !((t.id + ' ' + t.object + ' ' + t.place + ' ' + t.indices.join(' ')).toLowerCase().includes(q))) {
        return;
      }
      matchCount++;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'item';
      btn.dataset.id = t.id;
      btn.setAttribute('aria-current', String(state.selectedId === t.id));

      var bId = document.createElement('b');
      bId.textContent = t.id;
      var spanName = document.createElement('span');
      spanName.textContent = t.object;
      var smallMeta = document.createElement('small');
      smallMeta.textContent = (t.hasPassport ? (t.claimsCount + ' tvrdnji · ') : '') + t.place;

      btn.appendChild(bId);
      btn.appendChild(spanName);
      btn.appendChild(smallMeta);

      btn.addEventListener('click', function () {
        selectTeam(t.id);
      });
      listEl.appendChild(btn);
    });

    if (matchCount === 0) {
      var p = document.createElement('p');
      p.className = 'aside-note';
      p.textContent = 'Nema timova pod tim nazivom. Proveri registar svih timova.';
      listEl.appendChild(p);
    }
  }

  // Set View Mode
  function setViewMode(mode) {
    state.viewMode = mode;
    viewGradBtn.setAttribute('aria-pressed', String(mode === 'grad'));
    viewAtlasBtn.setAttribute('aria-pressed', String(mode === 'atlas'));
    viewMrezaBtn.setAttribute('aria-pressed', String(mode === 'mreza'));

    if (mode === 'atlas') {
      flyTo([25, 2, 45], 110, 0, 1.48);
    } else if (mode === 'mreza') {
      flyTo([30, 2, 50], 95, -0.78, 0.72);
      buildSceneGeometry();
    } else {
      flyTo([30, 2, 50], 120, -0.65, 0.52);
      buildSceneGeometry();
    }
  }

  // Load Data
  fetch('data/belgrade-map.json')
    .then(function (r) {
      if (!r.ok) throw new Error('Data load error');
      return r.json();
    })
    .then(function (data) {
      state.teams = data.teams || [];
      state.confluence = data.confluence || null;

      var curatedCount = state.teams.filter(function (t) { return t.hasPassport; }).length;
      if (countEl) countEl.textContent = String(curatedCount);

      buildSceneGeometry();
      updateList();
      selectTeam('T12'); // default to Generalštab
      render();
    })
    .catch(function (err) {
      console.warn('Fallback to local map:', err);
      render();
    });

  // Event Listeners
  if (modeBtn) {
    modeBtn.addEventListener('click', function () {
      state.night = !state.night;
      document.body.classList.toggle('night', state.night);
      modeBtn.setAttribute('aria-pressed', String(state.night));
      modeBtn.textContent = state.night ? 'Svetla maketa ◑' : 'Noćni grad ◐';
    });
  }

  if (viewGradBtn) viewGradBtn.addEventListener('click', function () { setViewMode('grad'); });
  if (viewAtlasBtn) viewAtlasBtn.addEventListener('click', function () { setViewMode('atlas'); });
  if (viewMrezaBtn) viewMrezaBtn.addEventListener('click', function () { setViewMode('mreza'); });

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      setViewMode('grad');
      selectTeam('T12');
    });
  }

  if (plusBtn) {
    plusBtn.addEventListener('click', function () {
      state.cam.dist = Math.max(25, state.cam.dist * 0.82);
    });
  }

  if (minusBtn) {
    minusBtn.addEventListener('click', function () {
      state.cam.dist = Math.min(240, state.cam.dist * 1.22);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      state.searchQuery = searchInput.value;
      updateList();
      var first = state.teams.find(function (t) {
        return (t.id + ' ' + t.object).toLowerCase().includes(state.searchQuery.toLowerCase());
      });
      if (first && state.searchQuery.length >= 2) {
        selectTeam(first.id);
      }
    });
  }

  if (dClose) {
    dClose.addEventListener('click', function () {
      if (dossierEl) dossierEl.hidden = true;
    });
  }

  // Pointer & Touch Controls
  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId);
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    state.drag = { x: e.clientX, y: e.clientY, moved: false };

    if (state.pointers.size === 2) {
      var pts = Array.from(state.pointers.values());
      state.pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!state.pointers.has(e.pointerId)) return;
    var prev = state.pointers.get(e.pointerId);
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two finger pinch to zoom
    if (state.pointers.size === 2) {
      var pts = Array.from(state.pointers.values());
      var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (state.pinchDist > 0) {
        state.cam.dist = Math.max(25, Math.min(240, state.cam.dist * (state.pinchDist / d)));
      }
      state.pinchDist = d;
      return;
    }

    var dx = e.clientX - prev.x;
    var dy = e.clientY - prev.y;

    if (Math.abs(e.clientX - state.drag.x) + Math.abs(e.clientY - state.drag.y) > 6) {
      state.drag.moved = true;
    }

    if (e.buttons === 2 || e.shiftKey) {
      // Pan
      var panScale = state.cam.dist * 0.0012;
      var cYaw = state.cam.yaw;
      state.cam.target[0] -= (dx * Math.cos(cYaw) - dy * Math.sin(cYaw)) * panScale;
      state.cam.target[2] -= (dx * Math.sin(cYaw) + dy * Math.cos(cYaw)) * panScale;
    } else {
      // Orbit
      state.cam.yaw += dx * 0.007;
      state.cam.pitch = Math.max(0.12, Math.min(1.52, state.cam.pitch + dy * 0.006));
    }
  });

  canvas.addEventListener('pointerup', function (e) {
    if (state.drag && !state.drag.moved && state.pointers.size === 1) {
      // Tap/click ray-test to pick nearest building
      var rect = canvas.getBoundingClientRect();
      var clickX = e.clientX - rect.left;
      var clickY = e.clientY - rect.top;

      // Unproject screen click to ground space
      var aspect = canvas.width / canvas.height;
      var ndcX = (clickX / rect.width) * 2 - 1;
      var ndcY = 1 - (clickY / rect.height) * 2;

      var bestTeam = null, bestDist = 48; // screen pixel radius threshold
      state.teams.forEach(function (t) {
        // Project 3D team position to screen
        var p4 = [t.x, t.y + 2, t.z, 1.0];
        var out = [
          p4[0]*mvpMat[0] + p4[1]*mvpMat[4] + p4[2]*mvpMat[8] + p4[3]*mvpMat[12],
          p4[0]*mvpMat[1] + p4[1]*mvpMat[5] + p4[2]*mvpMat[9] + p4[3]*mvpMat[13],
          p4[0]*mvpMat[2] + p4[1]*mvpMat[6] + p4[2]*mvpMat[10] + p4[3]*mvpMat[14],
          p4[0]*mvpMat[3] + p4[1]*mvpMat[7] + p4[2]*mvpMat[11] + p4[3]*mvpMat[15]
        ];
        if (out[3] > 0.1) {
          var sx = (out[0] / out[3] * 0.5 + 0.5) * rect.width;
          var sy = (0.5 - out[1] / out[3] * 0.5) * rect.height;
          var dist = Math.hypot(sx - clickX, sy - clickY);
          if (dist < bestDist) {
            bestDist = dist;
            bestTeam = t;
          }
        }
      });

      if (bestTeam) {
        selectTeam(bestTeam.id);
      }
    }

    state.pointers.delete(e.pointerId);
    state.drag = null;
    state.pinchDist = 0;
  });

  canvas.addEventListener('pointercancel', function (e) {
    state.pointers.delete(e.pointerId);
    state.drag = null;
  });

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var zoomFactor = (e.deltaY < 0) ? 0.92 : 1.08;
    state.cam.dist = Math.max(22, Math.min(240, state.cam.dist * zoomFactor));
  }, { passive: false });

  // Quick landmark shortcuts
  var shortcuts = [
    { id: 'btn-hram', targetId: 'T11' },
    { id: 'btn-gen', targetId: 'T12' },
    { id: 'btn-bgd', targetId: 'T18' },
    { id: 'btn-silosi', targetId: 'T02' },
    { id: 'btn-bigz', targetId: 'T41' },
    { id: 'btn-kdist', targetId: 'T22' },
    { id: 'btn-most', targetId: 'T51' },
    { id: 'btn-sava', targetId: 'T03' }
  ];
  shortcuts.forEach(function (sc) {
    var el = document.getElementById(sc.id);
    if (el) {
      el.addEventListener('click', function () {
        selectTeam(sc.targetId);
      });
    }
  });

  window.addEventListener('resize', function () {
    // Canvas adapts in render loop
  });

})();
