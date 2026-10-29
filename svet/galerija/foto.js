// foto.js — zajednička osnova svetova: atlas tekstura → instanced ploče sa per-instance uv pravougaonikom,
// pet slojeva obrade slike u kodu (original · ivice · relijef · raster · sve), dva rasporeda (svet · prostor osa).
// Nije javno. Originali ostaju privatni; ovde ulaze samo sličice 160/256 px iz atlasa.
import * as THREE from './vendor/three.module.js';

export async function ucitaj(korpus) {
  const [json, tex] = await Promise.all([
    fetch(`./data/${korpus}.json`).then(r => r.json()),
    new Promise((res, rej) => new THREE.TextureLoader().load(`./data/${korpus}.atlas.jpg`, res, undefined, rej)),
  ]);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mip = !/mip=0/.test(location.search);
  tex.anisotropy = mip ? 4 : 1; tex.generateMipmaps = mip; tex.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  return { json, tex };
}

export const SLOJEVI = ['original', 'ivice', 'relijef', 'raster', 'sve'];

/**
 * Ploče: jedna InstancedMesh, 1 draw call. Svaka instanca nosi uvRect (x,y,w,h), tint i "podizanje" (0..1).
 * Geometrija je mreža 1×1 sa `segs` segmenata po strani; odnos stranica ide kroz matricu instance.
 * Sloj obrade (U.uSloj) živi u shaderu: ivice = Sobel nad sličicom, relijef = svetlina pomera mrežu duž normale,
 * raster = polutonski krugovi u pikselima izvorne sličice. Isti kod radi nad bilo kojom novom slikom u atlasu.
 */
export function ploce(items, tex, { material = {}, podloga = 0xffffff, curl = 0, segs = 20, relief = 0.3, akcenat = 0xd8a25a, poledjina = false, svetlo = false } = {}) {
  const n = items.length;
  const geo = new THREE.PlaneGeometry(1, 1, segs, segs);
  const uvRect = new Float32Array(n * 4), lift = new Float32Array(n), tintArr = new Float32Array(n * 3);
  const col = new THREE.Color();
  items.forEach((it, i) => {
    uvRect.set(it.uv, i * 4);
    col.set(podloga); tintArr.set([col.r, col.g, col.b], i * 3);
  });
  geo.setAttribute('uvRect', new THREE.InstancedBufferAttribute(uvRect, 4));
  geo.setAttribute('lift', new THREE.InstancedBufferAttribute(lift, 1));
  geo.setAttribute('tint', new THREE.InstancedBufferAttribute(tintArr, 3));
  const jac = new Float32Array(n).fill(1);   // jačina sloja po instanci (0..1): svet je puni podatkom (pročitano, broj radnika, svežina)
  geo.setAttribute('jacina', new THREE.InstancedBufferAttribute(jac, 1));
  const U = {
    uTime: { value: 0 }, uCurl: { value: curl }, uSloj: { value: 0 }, uRelief: { value: 0 },
    uAtlas: { value: tex }, uTexel: { value: new THREE.Vector2(1 / tex.image.width, 1 / tex.image.height) },
    uAkc: { value: new THREE.Color(akcenat) }, uSvetlo: { value: svetlo ? 1 : 0 },
  };
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0, side: THREE.DoubleSide, flatShading: true, ...material });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    mat.userData.shader = sh;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 uvRect; attribute float lift; attribute vec3 tint; attribute float jacina;
        varying vec3 vTint; varying float vLift; varying vec4 vRect; varying float vJac;
        uniform float uTime; uniform float uCurl; uniform float uRelief; uniform sampler2D uAtlas; uniform vec2 uTexel;
        float lumaV(vec2 uv){ return dot(texture2D(uAtlas, uv).rgb, vec3(.2126,.7152,.0722)); }`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        vMapUv = uvRect.xy + uv * uvRect.zw; vTint = tint; vLift = lift; vRect = uvRect; vJac = jacina;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // blagi uvoj papira po ivici (uCurl) + podizanje ka kameri po instanci
        float e = pow(abs(uv.x - 0.5) * 2.0, 3.0);
        transformed.z += uCurl * e * (0.02 + 0.01 * sin(uTime * 0.4 + float(gl_InstanceID))) + lift * 0.9;
        // relijef: svetlina sličice (5 očitavanja, unutar pravougaonika) pomera mrežu; ivica se utiša da se ne cepa
        if (uRelief > 0.001) {
          vec2 lo = uvRect.xy + uTexel, hi = uvRect.xy + uvRect.zw - uTexel;
          vec2 o = uTexel * 1.5;
          float L = lumaV(clamp(vMapUv, lo, hi)) * 0.4 + 0.15 * (lumaV(clamp(vMapUv + vec2(o.x, 0.), lo, hi)) + lumaV(clamp(vMapUv - vec2(o.x, 0.), lo, hi)) + lumaV(clamp(vMapUv + vec2(0., o.y), lo, hi)) + lumaV(clamp(vMapUv - vec2(0., o.y), lo, hi)));
          float rub = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
          transformed.z += (L - 0.5) * uRelief * (0.35 + 0.65 * jacina) * smoothstep(0.0, 0.05, rub);
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vTint; varying float vLift; varying vec4 vRect; varying float vJac;
        uniform float uSloj; uniform float uSvetlo; uniform vec2 uTexel; uniform vec3 uAkc; uniform sampler2D uAtlas;
        const vec3 LUM = vec3(.2126,.7152,.0722);
        float lumaF(vec2 uv){ vec2 lo = vRect.xy + uTexel * .5, hi = vRect.xy + vRect.zw - uTexel * .5; return dot(texture2D(uAtlas, clamp(uv, lo, hi)).rgb, LUM); }`)
      .replace('#include <map_fragment>', `
        vec3 col = texture2D( map, vMapUv ).rgb;
        if (uSloj > 0.5) {
          float gx = lumaF(vMapUv + vec2(uTexel.x, 0.)) - lumaF(vMapUv - vec2(uTexel.x, 0.));
          float gy = lumaF(vMapUv + vec2(0., uTexel.y)) - lumaF(vMapUv - vec2(0., uTexel.y));
          float ed = smoothstep(0.05, 0.26, length(vec2(gx, gy))) * (0.15 + 0.85 * vJac);   // jačina ivice nosi podatak instance
          if (uSloj < 1.5) { if (uSvetlo > 0.5) col = mix(col * 0.55 + 0.38, uAkc * 0.55, ed); else { col *= 0.3; totalEmissiveRadiance += uAkc * ed * 1.1; } }   // ivice: Sobel — svetli nad tamnim (noć) ili tinta nad bledim (dan)
          else if (uSloj < 2.5) { col *= 1.0; }                                                // relijef: original, geometrija nosi podatak
          else if (uSloj < 3.5) {                                                              // raster: polutonski krug po ćeliji od 5 px sličice
            vec2 px = (vMapUv - vRect.xy) / uTexel; float cell = 5.0;
            vec2 g = floor(px / cell) * cell + cell * 0.5; vec2 fr = fract(px / cell) - 0.5;
            vec3 cc = texture2D(map, vRect.xy + g * uTexel).rgb;
            float r = sqrt(dot(cc, LUM)) * 0.66;
            col = mix(vec3(0.012), cc * 1.2, smoothstep(r, r - 0.14, length(fr)));
          } else { if (uSvetlo > 0.5) col = mix(col * 0.9, uAkc * 0.5, ed); else { col *= 0.58; totalEmissiveRadiance += uAkc * ed * 0.95; } }                   // sve: relijef + ivice + original
        }
        ${poledjina ? 'if (!gl_FrontFacing) col = vec3(0.035, 0.04, 0.05);' : ''}
        diffuseColor *= vec4(col, 1.0) * vec4(vTint, 1.0);`);
  };
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false;
  /** Postavi sloj; relijef se uvlači glatko (poziva se svaki kadar iz sveta preko `U.glatko`). */
  let cilj = 0;
  U.sloj = (idx) => { U.uSloj.value = idx; cilj = (idx === 2 || idx === 4) ? relief : 0; };
  U.glatko = (dt) => { const r = U.uRelief.value; if (Math.abs(r - cilj) > 1e-3) { U.uRelief.value = r + (cilj - r) * Math.min(1, dt * 6); return true; } U.uRelief.value = cilj; return false; };
  return { mesh, uvRect, lift, tintArr, U, jac, jacina: geo.getAttribute('jacina') };
}

export function postaviInstancu(mesh, i, pos, w, h, rotY = 0, rotX = 0) {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, 0));
  m.compose(pos, q, new THREE.Vector3(w, h, 1));
  mesh.setMatrixAt(i, m);
}

/**
 * N rasporeda istih instanci: rasporedi[0] = svet, rasporedi[1] = prostor osa, rasporedi[2] = galerija…
 * Svaki raspored[i] = {p, w, h, ry, rx}. Prelaz je 1,2 s, isti broj matrica, bez novog draw call-a.
 * U prostoru osa ploče gledaju ka kameri (težina po k prelaza); u galeriji stoje na zidu.
 */
export function raspored(mesh, rasporedi, cam) {
  const m = new THREE.Matrix4(), lm = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), eu = new THREE.Euler(), UP = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3(), last = new THREE.Vector3(1e9, 0, 0);
  let t = 0, od = 0, ka = 0;
  function primeni() {
    const A = rasporedi[od], B = rasporedi[ka];
    const k = t * t * (3 - 2 * t);
    for (let i = 0; i < A.length; i++) {
      const a = A[i], b = B[i];
      p.lerpVectors(a.p, b.p, k); s.set(a.w + (b.w - a.w) * k, a.h + (b.h - a.h) * k, 1);
      q.setFromEuler(eu.set(a.rx + (b.rx - a.rx) * k, a.ry + (b.ry - a.ry) * k, 0));
      if (k > 0) { q2.setFromRotationMatrix(lm.lookAt(cam.position, p, UP)); q.slerp(q2, k); }   // u prostoru osa ploča gleda pravo u kameru
      m.compose(p, q, s); mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.boundingSphere = null; mesh.boundingBox = null; last.copy(cam.position);
  }
  return {
    postavi(c) { if (c === ka) return; if (t >= 0.5) od = ka; t = 0; ka = c; },
    get cilj() { return ka; }, get t() { return t; },
    tick(dt) {
      if (t < 1) { t = Math.min(1, t + dt / 1.2); primeni(); return true; }
      if (last.distanceToSquared(cam.position) > 1e-4) { primeni(); return true; }
      return false;
    },
    prvi() { primeni(); },
    skoci() { t = 1; primeni(); },
  };
}

/** B raspored: rang po hue/svetlini/zasićenju (isti rang = ravnomerno, ne vrednost); centar c, veličine sz = [x,y,z]. */
export function osaRaspored(items, A, c, sz, ploca = 1.0) {
  const n = items.length;
  const rang = (get) => { const idx = [...Array(n).keys()].sort((a, b) => get(items[a]) - get(items[b]) || a - b); const r = new Float32Array(n); idx.forEach((i, k) => { r[i] = n > 1 ? k / (n - 1) : 0.5; }); return r; };
  const rx = rang(it => it.ose.hue), ry = rang(it => it.ose.svetlina), rz = rang(it => it.ose.zasicenje);
  return items.map((it, i) => {
    const od = Math.min(1.6, Math.max(0.55, it.ose.odnos)), h = ploca;
    return { p: new THREE.Vector3(c.x + (rx[i] - 0.5) * sz[0], c.y + (ry[i] - 0.5) * sz[1], c.z + (rz[i] - 0.5) * sz[2]), w: h * od, h, ry: 0, rx: 0 };
  });
}

/**
 * Galerija: hodnik čiji su zidovi same slike. `redovi` = [[ključ, [i…]], …] po redu obilaska; ploče se smenjuju
 * levo/desno po zidu, centar na visini oka, vrata (širi razmak) između grupa. Zid je slika i za sudar: vraća
 * C raspored, kutije (AABB po ploči + čep na kraju), ulaz i dužinu hodnika. Slike bez grupe ostaju van hodnika.
 */
export function galerija(items, { redovi, c, sirina = 7, visina = 1.15, oko = 1.55, razmak = 1.3, vrata = 2.4, visinaIt = null }) {
  const pola = sirina / 2, B = items.map(() => ({ p: new THREE.Vector3(0, -50, 0), w: 0.001, h: 0.001, ry: 0, rx: 0 }));
  const kutije = []; let L = null, R = null;
  for (const [, idx] of redovi) {
    idx.forEach((i, j) => {
      const it = items[i], odn = Math.min(1.7, Math.max(0.55, it.ose.odnos));
      const h = visina, w = h * odn, desno = j % 2 === 1;
      const run = desno ? R : L;
      const px = run === null ? 0 : run + Math.max(razmak, w + 0.4);
      if (desno) R = px; else L = px;
      const z = c.z + (desno ? pola : -pola), y = visinaIt ? visinaIt(it, oko) : oko;
      B[i] = { p: new THREE.Vector3(c.x + px, y, z), w, h, ry: desno ? Math.PI : 0, rx: 0 };
      kutije.push({ minX: c.x + px - w / 2 - 0.1, maxX: c.x + px + w / 2 + 0.1, minZ: z - 0.14, maxZ: z + 0.14 });
    });
    const kraj = Math.max(L ?? 0, R ?? 0) + vrata; L = R = kraj;
  }
  const duzina = Math.max(L ?? 0, R ?? 0);
  kutije.push({ minX: c.x + duzina + 0.4, maxX: c.x + duzina + 2.5, minZ: c.z - pola - 2, maxZ: c.z + pola + 2 });   // čep na kraju hodnika
  return { B, kutije, duzina, ulaz: new THREE.Vector3(c.x - 6, oko, c.z), kraj: new THREE.Vector3(c.x + duzina - 4, oko, c.z) };
}

/** Žičana kocka osa + DOM oznake; `oznake.azuriraj(cam, vidljivo)`. Tekst nikad u WebGL-u. */
export function kocka(scene, c, sz, boja, nazivi, klasa = '') {
  const g = new THREE.Group();
  const box = new THREE.BoxGeometry(sz[0], sz[1], sz[2]);
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: boja, transparent: true, opacity: 0.4 })));
  g.position.copy(c); g.visible = false; scene.add(g);
  const mk = (txt, pos) => { const el = document.createElement('div'); el.className = 'hud oznaka osa ' + klasa; el.textContent = txt; el.style.display = 'none'; document.body.appendChild(el); return [el, pos.clone()]; };
  const h = (v) => new THREE.Vector3().copy(c).add(v);
  const lista = [
    mk(nazivi[0] + ' → (rang)', h(new THREE.Vector3(sz[0] / 2, -sz[1] / 2, sz[2] / 2))), mk(nazivi[0] + ' 0%', h(new THREE.Vector3(-sz[0] / 2, -sz[1] / 2, sz[2] / 2))),
    mk('↑ ' + nazivi[1] + ' (rang)', h(new THREE.Vector3(-sz[0] / 2, sz[1] / 2, sz[2] / 2))), mk('50%', h(new THREE.Vector3(0, -sz[1] / 2, sz[2] / 2))), mk('100%', h(new THREE.Vector3(sz[0] / 2, sz[1] / 2, sz[2] / 2))),
    mk(nazivi[2] + ' → (rang)', h(new THREE.Vector3(-sz[0] / 2, -sz[1] / 2, -sz[2] / 2))),
  ];
  return { grupa: g, azuriraj(cam, vid) {
    g.visible = vid;
    lista.forEach(([el, p]) => { const v = p.clone().project(cam); const ok = vid && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05; el.style.display = ok ? '' : 'none'; if (ok) { el.style.left = (v.x + 1) / 2 * innerWidth + 'px'; el.style.top = (1 - v.y) / 2 * innerHeight + 'px'; } });
  } };
}

export function hud(el, html) { el.innerHTML = html; el.style.opacity = html ? 1 : 0; }

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches || /\bmirno=1\b/.test(location.search);

export function renderer(canvas) {
  const telefon = matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) <= 720;
  const lite = /lite=1/.test(location.search) || telefon;   // telefon: bez MSAA i sa manjim pixel ratio-om, da kretanje ne kasni
  const r = new THREE.WebGLRenderer({ canvas, antialias: !lite, alpha: false, powerPreference: telefon ? 'high-performance' : 'default', failIfMajorPerformanceCaveat: false });
  r.setPixelRatio(Math.min(devicePixelRatio, telefon ? 1.25 : 1.5));
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}

export function pmrem(r, scene, gradient) {
  if (/pmrem=0/.test(location.search)) return null;
  // IBL iz malog proceduralnog neba (bez eksternog HDR-a): gore/horizont/dole boje.
  const env = new THREE.Scene();
  const g = new THREE.SphereGeometry(10, 16, 8);
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { a: { value: new THREE.Color(gradient[0]) }, b: { value: new THREE.Color(gradient[1]) }, c: { value: new THREE.Color(gradient[2]) } },
    vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec3 p; uniform vec3 a,b,c; void main(){ float t = p.y; vec3 col = t>0. ? mix(b,a,pow(t,0.6)) : mix(b,c,pow(-t,0.8)); gl_FragColor = vec4(col,1.); }' });
  env.add(new THREE.Mesh(g, m));
  const gen = new THREE.PMREMGenerator(r);
  const rt = gen.fromScene(env, 0.04);
  scene.environment = rt.texture; gen.dispose();
  return rt.texture;
}
