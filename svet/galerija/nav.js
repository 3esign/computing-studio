// nav.js — standardna 3D navigacija za svetove: Tura (autopilot) · Orbit (prevlačenje, desni klik pomera, točkić zumira)
// · Hod (WASD + prevlačenje pogleda, Q/E dole/gore, Shift brže). Dvoklik na ploču fokusira. Dodir: jedan prst gleda/orbitira,
// dva prsta zumiraju (u Hodu: napred/nazad) i pomeraju (u Orbitu). Bez zavisnosti; pozicija kamere prelazi iz režima u režim bez skoka.
import * as THREE from './vendor/three.module.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const KLJ = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyQ: 'q', KeyE: 'e', ArrowUp: 'w', ArrowDown: 's', ArrowLeft: 'l', ArrowRight: 'r', ShiftLeft: 'sh', ShiftRight: 'sh' };

export function navigacija(cam, el, { meta, tura, brzina = 6, minY = 0.3, minR = 1.2, maxR = 300, probudi = () => {}, naPromenu = () => {}, izTure = 'orbit', orbitR = 0, sudar = null }) {
  const S = { mode: 'tura', yaw: 0, pitch: 0, target: meta.clone(), sph: new THREE.Spherical(40, 1.1, 0), fly: null, dist: cam.position.distanceTo(meta) || 20, sudar };
  const keys = new Set(), ptr = new Map(); let pinch = 0, mid = null;
  const v = new THREE.Vector3(), f = new THREE.Vector3(), d = new THREE.Vector3(), e = new THREE.Euler(0, 0, 0, 'YXZ');

  // sudar u hodu: kamera se vraća na stranu kutije sa koje je došla (i na velikom koraku, pri niskom FPS-u);
  // ako je već bila unutra (teleport), izbacuje je duž ose najmanjeg proboja. visinaOka drži pogled čoveka koji šeta.
  function sudari(p, s, x0, z0) {
    const r = s.r ?? 0.32;
    for (const k of s.kutije) {
      if (p.x <= k.minX - r || p.x >= k.maxX + r || p.z <= k.minZ - r || p.z >= k.maxZ + r) continue;
      const biloX = x0 <= k.minX - r ? -1 : (x0 >= k.maxX + r ? 1 : 0);
      const biloZ = z0 <= k.minZ - r ? -1 : (z0 >= k.maxZ + r ? 1 : 0);
      let inkx, inkz;
      if (biloX) inkx = biloX < 0 ? k.minX - r - p.x : k.maxX + r - p.x;
      if (biloZ) inkz = biloZ < 0 ? k.minZ - r - p.z : k.maxZ + r - p.z;
      if (inkx === undefined && inkz === undefined) {
        const dxl = p.x - (k.minX - r), dxr = (k.maxX + r) - p.x, dzl = p.z - (k.minZ - r), dzr = (k.maxZ + r) - p.z;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) p.x = k.minX - r; else if (m === dxr) p.x = k.maxX + r; else if (m === dzl) p.z = k.minZ - r; else p.z = k.maxZ + r;
      } else if (inkz === undefined || (inkx !== undefined && Math.abs(inkx) <= Math.abs(inkz))) p.x += inkx;
      else p.z += inkz;
    }
    if (s.visinaOka) p.y = clamp(p.y, s.visinaOka - 0.25, s.visinaOka + 0.35);
  }

  function izKamere() {
    S.sph.setFromVector3(v.subVectors(cam.position, S.target)); S.sph.radius = clamp(S.sph.radius, minR, maxR); S.sph.makeSafe();
    e.setFromQuaternion(cam.quaternion, 'YXZ'); S.yaw = e.y; S.pitch = e.x;
  }
  function mode(m) {
    if (m === S.mode) return;
    const staro = S.mode;
    if (staro === 'hod' && m === 'orbit') { cam.getWorldDirection(f); S.target.copy(cam.position).addScaledVector(f, S.dist); }
    if (staro === 'orbit') S.dist = S.sph.radius;
    S.mode = m; S.fly = null;
    if (m === 'tura') S.target.copy(meta);
    izKamere();
    if (m === 'orbit' && orbitR && S.sph.radius < orbitR * 0.5) { S.target.copy(meta); S.sph.set(orbitR, 1.0, S.yaw); }
    naPromenu(m); probudi();
  }
  function primeniOrbit() { cam.position.copy(S.target).add(v.setFromSpherical(S.sph)); cam.lookAt(S.target); }
  function primeniHod() { cam.rotation.set(S.pitch, S.yaw, 0, 'YXZ'); }

  function fokus(tacka, razmak = 6) {
    if (S.mode !== 'orbit') { if (S.mode === 'hod') { cam.getWorldDirection(f); S.target.copy(cam.position).addScaledVector(f, S.dist); } mode('orbit'); }
    izKamere();
    S.fly = { t: 0, from: S.target.clone(), to: tacka.clone(), r0: S.sph.radius, r1: clamp(razmak, minR, maxR) };
    probudi();
  }

  function update(dt, t) {
    if (S.mode === 'tura') { tura(t); return; }
    if (S.mode === 'orbit') {
      if (S.fly) {
        S.fly.t = Math.min(1, S.fly.t + dt / 0.9); const k = S.fly.t * S.fly.t * (3 - 2 * S.fly.t);
        S.target.lerpVectors(S.fly.from, S.fly.to, k); S.sph.radius = S.fly.r0 + (S.fly.r1 - S.fly.r0) * k;
        if (S.fly.t >= 1) S.fly = null;
      }
      if (keys.has('l')) S.sph.theta += dt * 1.2; if (keys.has('r')) S.sph.theta -= dt * 1.2;
      primeniOrbit(); return;
    }
    // hod: kretanje kroz svet (u galeriji sa kolizijom — zid je slika i ne prolazi se kroz nju)
    const x0 = cam.position.x, z0 = cam.position.z;
    const sp = brzina * (keys.has('sh') ? 3 : 1) * dt;
    if (keys.has('l')) S.yaw += dt * 1.4; if (keys.has('r')) S.yaw -= dt * 1.4;
    primeniHod();
    cam.getWorldDirection(f); d.crossVectors(f, cam.up).normalize();
    if (keys.has('w')) cam.position.addScaledVector(f, sp); if (keys.has('s')) cam.position.addScaledVector(f, -sp);
    if (keys.has('d')) cam.position.addScaledVector(d, sp); if (keys.has('a')) cam.position.addScaledVector(d, -sp);
    if (keys.has('e')) cam.position.y += sp; if (keys.has('q')) cam.position.y -= sp;
    if (cam.position.y < minY) cam.position.y = minY;
    if (S.sudar) sudari(cam.position, S.sudar, x0, z0);
  }
  const aktivan = () => S.mode !== 'tura' && (S.fly || keys.size > 0);

  // ——— ulaz
  const budi = () => { if (S.mode === 'tura') mode(izTure); probudi(); };
  el.addEventListener('contextmenu', ev => ev.preventDefault());
  el.addEventListener('pointerdown', ev => {
    el.setPointerCapture(ev.pointerId); ptr.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, b: ev.button, sh: ev.shiftKey });
    if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); mid = [(a.x + b.x) / 2, (a.y + b.y) / 2]; }
    budi();
  });
  el.addEventListener('pointermove', ev => {
    const p = ptr.get(ev.pointerId); if (!p) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y; p.x = ev.clientX; p.y = ev.clientY;
    if (S.mode === 'tura') return;
    if (ptr.size === 1) {
      if (S.mode === 'orbit') {
        if (p.b === 2 || p.sh) pan(dx, dy);
        else { S.fly = null; S.sph.theta -= dx * 0.0055; S.sph.phi = clamp(S.sph.phi - dy * 0.0055, 0.06, Math.PI - 0.06); }
      } else { S.yaw -= dx * 0.0042; S.pitch = clamp(S.pitch - dy * 0.0042, -1.5, 1.5); }
    } else if (ptr.size === 2) {
      const [a, b] = [...ptr.values()], nd = Math.hypot(a.x - b.x, a.y - b.y), nm = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      if (pinch > 0) zum(pinch / nd, (nd - pinch));
      if (S.mode === 'orbit' && mid) pan(nm[0] - mid[0], nm[1] - mid[1]);
      pinch = nd; mid = nm;
    }
    probudi();
  });
  const kraj = ev => { ptr.delete(ev.pointerId); pinch = 0; mid = null; };
  el.addEventListener('pointerup', kraj); el.addEventListener('pointercancel', kraj);
  function pan(dx, dy) {
    const k = S.sph.radius * 0.0016; cam.updateMatrix();
    d.setFromMatrixColumn(cam.matrix, 0); S.target.addScaledVector(d, -dx * k);
    d.setFromMatrixColumn(cam.matrix, 1); S.target.addScaledVector(d, dy * k);
    S.fly = null;
  }
  function zum(razmera, razlika) {
    if (S.mode === 'orbit') { S.sph.radius = clamp(S.sph.radius * razmera, minR, maxR); S.fly = null; }
    else { cam.getWorldDirection(f); cam.position.addScaledVector(f, -razlika * 0.04 * brzina); }
  }
  el.addEventListener('wheel', ev => { ev.preventDefault(); budi(); zum(Math.exp(ev.deltaY * 0.0012), ev.deltaY * -0.5); probudi(); }, { passive: false });
  addEventListener('keydown', ev => {
    if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
    if (ev.code === 'Digit1') return mode('tura'); if (ev.code === 'Digit2') return mode('orbit'); if (ev.code === 'Digit3') return mode('hod');
    const k = KLJ[ev.code]; if (!k) return;
    if (S.mode === 'tura') mode(/^[wasdqe]$/.test(k) ? 'hod' : izTure);
    keys.add(k); probudi(); ev.preventDefault();
  });
  addEventListener('keyup', ev => { const k = KLJ[ev.code]; if (k) keys.delete(k); });
  addEventListener('blur', () => keys.clear());

  izKamere();
  return { update, mode, fokus, aktivan, postaviSudar(s) { S.sudar = s; }, skoci() { if (S.fly) S.fly.t = 1 - 1e-6; }, get mod() { return S.mode; }, get sudar() { return S.sudar; } };
}
