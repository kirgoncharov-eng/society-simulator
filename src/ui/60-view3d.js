/* ---------- 3D view ---------- */
const V3 = { on: false, ready: false, loading: false, texAt: 0, texKey: '', objAt: 0, treeKey: '', wallsKey: '', heights: null, seed: null };
const URL3 = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'];
function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
function set3D(on) {
  $('v2d').classList.toggle('on', !on); $('v3d').classList.toggle('on', on);
  $('v2d').setAttribute('aria-pressed', String(!on)); $('v3d').setAttribute('aria-pressed', String(on));
  document.body.classList.toggle('flat', !on);
  V3.wanted = on;
  if (!on) { V3.on = false; $('camZoom').value = Math.round(100 * Math.log(vt.z) / Math.log(5)); cv.style.visibility = ''; if (V3.ren) V3.ren.domElement.style.display = 'none'; $('v3lab').hidden = true; $('v3msg').hidden = true; return; }
  if (V3.ready) { V3.on = true; cv.style.visibility = 'hidden'; V3.ren.domElement.style.display = ''; $('v3lab').hidden = false; size3D(); syncCameraZoom(); return; }
  if (V3.loading) return;
  V3.loading = true; $('v3msg').hidden = false; $('v3msg').textContent = 'Загружаю 3D…';
  (async () => {
    try { if (!window.THREE) await loadScript(URL3[0]); if (!THREE.OrbitControls) await loadScript(URL3[1]); init3D(); V3.ready = true; $('v3msg').hidden = true; set3D(V3.wanted); }
    catch (e) { $('v3msg').textContent = 'Не удалось загрузить 3D-библиотеку. Проверьте интернет и нажмите «3D» ещё раз.'; V3.loading = false; }
  })();
}
function cellH(t) { return t === 's' ? -16 : t === 'b' ? 0.2 : t === 'h' ? 26 : t === 'f' ? 3 : t === 'w' ? -9 : t === 'r' ? 0.5 : 1.5; }
function buildHeights(W0) {
  const n = 101, H = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i * 10, z = j * 10;
    let s = 0, w = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ci = Math.min(49, Math.max(0, Math.floor(x / 20) + di)), cj = Math.min(49, Math.max(0, Math.floor(z / 20) + dj));
      const cx = ci * 20 + 10, cz = cj * 20 + 10, ww = 1 / (1 + Math.hypot(cx - x, cz - z) / 10);
      s += cellH(W0.ter[cj * 50 + ci]) * ww; w += ww;
    }
    let h = s / w;
    const r = W0.river; if (r) { const k = Math.min(r.length - 1, Math.max(0, Math.round((z + 20) / 20))), d = Math.abs(x - r[k][0]); if (d < 22) h = Math.min(h, -9 * (1 - d / 22) + h * (d / 22)); }
    h += Math.sin(x * 0.031 + z * 0.017) * 0.8 + Math.cos(z * 0.027 - x * 0.013) * 0.8;
    H[j * n + i] = h;
  }
  return H;
}
function gh(x, z) {
  const H = V3.heights; if (!H) return 0;
  const fx = Math.min(99.999, Math.max(0, x / 10)), fz = Math.min(99.999, Math.max(0, z / 10)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, n = 101;
  return H[j * n + i] * (1 - u) * (1 - v) + H[j * n + i + 1] * u * (1 - v) + H[(j + 1) * n + i] * (1 - u) * v + H[(j + 1) * n + i + 1] * u * v;
}
function init3D() {
  const T = THREE;
  V3.scene = new T.Scene();
  V3.cam = new T.PerspectiveCamera(42, 1, 2, 6000);
  V3.cam.position.set(500, 640, 1180);
  V3.ren = new T.WebGLRenderer({ antialias: true });
  V3.ren.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  V3.ren.domElement.className = 'v3c'; V3.ren.domElement.style.touchAction = 'none';
  plate.insertBefore(V3.ren.domElement, $('v3lab'));
  V3.ctl = new T.OrbitControls(V3.cam, V3.ren.domElement);
  V3.ctl.target.set(500, 0, 520); V3.ctl.enableDamping = true; V3.ctl.dampingFactor = 0.08;
  V3.ctl.maxPolarAngle = 1.32; V3.ctl.minDistance = 110; V3.ctl.maxDistance = 3200; V3.ctl.update();
  V3.ctl.addEventListener('start', () => { follow = false; V3.fly = null; });
  V3.ctl.addEventListener('end', syncCameraZoom);
  V3.hemi = new T.HemisphereLight(0xffffff, 0x556644, 0.55); V3.scene.add(V3.hemi);
  V3.sun = new T.DirectionalLight(0xfff2dd, 0.6); V3.sun.position.set(-400, 900, 300); V3.scene.add(V3.sun);
  V3.texCv = document.createElement('canvas'); V3.texCv.width = V3.texCv.height = 2048;
  V3.terrCv = document.createElement('canvas'); V3.ownCv = document.createElement('canvas');
  V3.tex = new T.CanvasTexture(V3.texCv); V3.tex.anisotropy = 4;
  V3.groundGeo = new T.PlaneGeometry(1000, 1000, 100, 100); V3.groundGeo.rotateX(-Math.PI / 2); V3.groundGeo.translate(500, 0, 500);
  V3.ground = new T.Mesh(V3.groundGeo, new T.MeshLambertMaterial({ map: V3.tex })); V3.scene.add(V3.ground);
  V3.water = new T.Mesh(new T.PlaneGeometry(3400, 3400).rotateX(-Math.PI / 2).translate(500, -3, 500), new T.MeshLambertMaterial({ color: 0x6fa8c8, transparent: true, opacity: 0.93 }));
  V3.scene.add(V3.water);
  const lam = c => new T.MeshLambertMaterial({ color: c });
  V3.trees = new T.InstancedMesh(new T.ConeGeometry(5.5, 16, 6), lam(0xffffff), 2600); V3.trees.count = 0; V3.scene.add(V3.trees);
  V3.trunks = new T.InstancedMesh(new T.CylinderGeometry(1, 1.3, 4, 5), lam(0x6b4a2b), 2600); V3.trunks.count = 0; V3.scene.add(V3.trunks);
  V3.hills = new T.InstancedMesh(new T.DodecahedronGeometry(4, 0), lam(0xa59d8c), 400); V3.hills.count = 0; V3.scene.add(V3.hills);
  V3.houses = new T.InstancedMesh(new T.BoxGeometry(10, 8, 10), lam(0xffffff), 900); V3.houses.count = 0; V3.scene.add(V3.houses);
  const roof = new T.ConeGeometry(8.6, 7, 4); roof.rotateY(Math.PI / 4);
  V3.roofs = new T.InstancedMesh(roof, lam(0xffffff), 900); V3.roofs.count = 0; V3.scene.add(V3.roofs);
  V3.big = new T.InstancedMesh(new T.BoxGeometry(18, 10, 13), lam(0xffffff), 80); V3.big.count = 0; V3.scene.add(V3.big);
  V3.chim = new T.InstancedMesh(new T.CylinderGeometry(1.6, 1.6, 9, 6), lam(0x5a5048), 80); V3.chim.count = 0; V3.scene.add(V3.chim);
  V3.silos = new T.InstancedMesh(new T.CylinderGeometry(5, 5, 11, 10), lam(0xffffff), 80); V3.silos.count = 0; V3.scene.add(V3.silos);
  V3.spires = new T.InstancedMesh(new T.ConeGeometry(5, 22, 4), lam(0xffffff), 80); V3.spires.count = 0; V3.scene.add(V3.spires);
  V3.bodies = new T.InstancedMesh(new T.CylinderGeometry(1.5, 2.2, 7, 7), lam(0xffffff), 700); V3.bodies.count = 0; V3.scene.add(V3.bodies);
  V3.heads = new T.InstancedMesh(new T.SphereGeometry(2.1, 8, 6), lam(0xffffff), 700); V3.heads.count = 0; V3.scene.add(V3.heads);
  V3.carts = new T.InstancedMesh(new T.BoxGeometry(7, 4, 10), lam(0x8a5a2b), 80); V3.carts.count = 0; V3.scene.add(V3.carts);
  V3.flags = new T.InstancedMesh(new T.ConeGeometry(4, 10, 3), lam(0xffffff), 20); V3.flags.count = 0; V3.scene.add(V3.flags);
  V3.poles = new T.InstancedMesh(new T.CylinderGeometry(0.6, 0.6, 30, 4), lam(0x2a2a2a), 20); V3.poles.count = 0; V3.scene.add(V3.poles);
  V3.wallG = new T.Group(); V3.scene.add(V3.wallG);
  const logG = new T.CylinderGeometry(1, 1, 8, 6); logG.rotateZ(Math.PI / 2);
  const mk = (geo, mat, n) => { const m = new T.InstancedMesh(geo, mat, n); m.count = 0; V3.scene.add(m); return m; };
  V3.cargoW = mk(logG, lam(0x8a5a2b), 600); V3.cargoS = mk(new T.BoxGeometry(3.6, 3, 3.6), lam(0x9a968c), 600); V3.cargoF = mk(new T.SphereGeometry(2.5, 8, 6), lam(0xd9c38e), 600);
  V3.bridges = mk(new T.BoxGeometry(24, 2.2, 11), lam(0x8f6a40), 80); V3.rails = mk(new T.BoxGeometry(24, 2.5, 0.8), lam(0x6b4a2b), 160);
  V3.sites = mk(new T.BoxGeometry(1, 1, 1), lam(0xd8b98a), 600);
  V3.crops = mk(new T.BoxGeometry(3.2, 1, 3.2), lam(0xffffff), 900);
  V3.stumps = mk(new T.CylinderGeometry(1.3, 1.6, 2.2, 6), lam(0x7a5636), 2600);
  V3.smoke = mk(new T.SphereGeometry(2.3, 7, 5), new T.MeshLambertMaterial({ color: 0xd8d8d8, transparent: true, opacity: 0.5, depthWrite: false }), 360);
  V3.bucket = mk(new T.CylinderGeometry(1.6, 1.3, 2.6, 8), lam(0x3d86c6), 200); V3.springM = mk(new T.CylinderGeometry(7, 7, 0.8, 16), lam(0x5aa8dc), 20); V3.wellM = mk(new T.CylinderGeometry(4.5, 4.5, 4, 12), lam(0x8a867c), 80); V3.wellW = mk(new T.CylinderGeometry(3.4, 3.4, 4.2, 12), lam(0x4a90c8), 80);
  V3.hull = mk(new T.BoxGeometry(26, 5, 10), lam(0x7a5530), 80); V3.sail = mk(new T.BoxGeometry(1, 18, 12), lam(0xf4efe4), 80); V3.goat = mk(new T.BoxGeometry(3.4, 2.6, 2), lam(0xf2efe6), 400); V3.garden = mk(new T.BoxGeometry(8, 0.8, 6), lam(0x7fae5a), 900);
  V3.wreckWood = mk(new T.BoxGeometry(14, 2.4, 3.6), lam(0x946641), 3);
  V3.deer = mk(new T.BoxGeometry(2.8, 3, 6.5), lam(0x9a6a3e), 80); V3.deerH = mk(new T.BoxGeometry(1.8, 2.4, 2.2), lam(0x8a5a32), 80);
  V3.dummy = new T.Object3D(); V3.col = new T.Color();
  const white = new T.Color(1, 1, 1);
  for (const m of [V3.houses, V3.roofs, V3.big, V3.silos, V3.spires, V3.bodies, V3.heads, V3.flags, V3.crops]) { m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(m.instanceMatrix.count * 3).fill(1), 3); }
  V3.fogKey = '';
  V3.ray = new T.Raycaster(); V3.ptr = new T.Vector2();
  let down = null;
  V3.ren.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  V3.ren.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = V3.ren.domElement.getBoundingClientRect();
    V3.ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    V3.ray.setFromCamera(V3.ptr, V3.cam);
    const hit = V3.ray.intersectObjects([V3.bodies, V3.heads])[0];
    if (hit && V3.ids && V3.ids[hit.instanceId] !== undefined) { sel = V3.ids[hit.instanceId]; card(); }
  });
  new ResizeObserver(size3D).observe(plate);
  size3D();
  const landing = introOpen && firstLanding(S);
  if (landing) fly3D(landing.x1, landing.y1, true);
  else islandCamera(true);
}
function overviewDistance() {
  const vertical = V3.cam.fov * Math.PI / 360;
  return Math.max(1350, 510 / Math.sin(Math.min(vertical, Math.atan(Math.tan(vertical) * V3.cam.aspect))));
}
function syncCameraZoom() {
  if (!V3.on || !V3.ctl) return;
  const max = overviewDistance(), range = $('camZoom');
  const distance = V3.cam.position.distanceTo(V3.ctl.target);
  range.value = Math.round(Math.max(0, Math.min(100, 100 * Math.log(max / distance) / Math.log(max / 110))));
}
function fly3D(x, z, now, distance = 420, overview = false) {
  if (!V3.ctl) return;
  V3.fly = { x, z, distance, overview };
  if (now || reduce) {
    V3.ctl.target.set(x, 0, z);
    V3.cam.position.set(x + distance * 0.07, distance * 0.73, z + distance * 0.68);
    V3.ctl.update(); V3.fly = null; syncCameraZoom();
  }
}
function islandCamera(now) {
  follow = false;
  vt = { x: 500, y: 500, z: 1 };
  if (now || reduce) view = { ...vt };
  $('camZoom').value = 0;
  if (V3.ctl) fly3D(S.isle?.x ?? 500, S.isle?.y ?? 500, now, overviewDistance(), true);
}
function size3D() {
  if (!V3.ren) return;
  const w = plate.clientWidth, h = plate.clientHeight;
  V3.ren.setSize(w, h, false); V3.ren.domElement.style.width = w + 'px'; V3.ren.domElement.style.height = h + 'px';
  V3.cam.aspect = Math.max(1, w) / Math.max(1, h); V3.cam.updateProjectionMatrix();
  V3.ctl.maxDistance = Math.max(3200, overviewDistance());
}
function hexOf(css) { V3.col.setStyle(css); return V3.col; }
function hsl3(h, dl = 0) { return new THREE.Color().setHSL(((h % 360) + 360) % 360 / 360, 0.62, ((C.dark ? 62 : 42) + dl) / 100); }
function paint3DTexture(W0) {
  const res = 2048, t = V3.texCv.getContext('2d'), winter = Math.floor((W0.tick % 360) / 90) === 0;
  paintTerrain(1400, W0, V3.terrCv); paintOwn(W0, V3.ownCv, 1400);
  t.setTransform(1, 0, 0, 1, 0, 0); t.drawImage(V3.terrCv, 0, 0, res, res); t.drawImage(V3.ownCv, 0, 0, res, res);
  const q = res / 1000; t.setTransform(q, 0, 0, q, 0, 0);
  t.lineCap = 'round';
  drawWater(t, W0); drawNet(t, W0, 1.3);
  const wheat = winter ? (C.dark ? '#4a3d2c' : '#c9b392') : (C.dark ? '#8a7434' : '#ddbb5c');
  for (const g of W0.groups) for (const f of g.fields || []) { t.fillStyle = wheat; t.fillRect(f.x - 9, f.y - 7, 18, 14); t.strokeStyle = 'rgba(0,0,0,.14)'; t.lineWidth = 0.8; t.beginPath(); for (let i = -6; i <= 6; i += 3) { t.moveTo(f.x - 8, f.y + i); t.lineTo(f.x + 8, f.y + i); } t.stroke(); }
  for (const n of W0.nodes) { t.fillStyle = C.dark ? '#2f5a3c' : '#6f9a5c'; for (let i = 0; i < 7; i++) { const a = i * 0.8976 + n.id, r = i ? 14 : 0; t.beginPath(); t.arc(n.x + Math.cos(a) * r, n.y + Math.sin(a) * r, 6, 0, 7); t.fill(); } }
  if (winter) { t.fillStyle = C.dark ? 'rgba(200,220,240,.1)' : 'rgba(255,255,255,.22)'; t.fillRect(0, 0, 1000, 1000); }
  V3.tex.needsUpdate = true;
}
function setInst(mesh, i, x, y, z, s = 1, ry = 0, sy) { const d = V3.dummy; d.position.set(x, y, z); d.rotation.set(0, ry, 0); d.scale.set(s, sy || s, s); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); }
function rebuildStatic(W0, now) {
  if (V3.seed !== W0.seed) {
    V3.seed = W0.seed; V3.heights = buildHeights(W0);
    const pos = V3.groundGeo.attributes.position;
    for (let k = 0; k < pos.count; k++) pos.setY(k, gh(pos.getX(k), pos.getZ(k)));
    pos.needsUpdate = true; V3.groundGeo.computeVertexNormals();
    let hi = 0;
    for (let c = 0; c < 2500 && hi < 400; c++) if (W0.ter[c] === 'h' && ((c * 2654435761) >>> 0) % 7 === 0) { const hh = (c * 2246822519) >>> 0, x = (c % 50) * 20 + 2 + (hh % 16), z = Math.floor(c / 50) * 20 + 2 + ((hh >>> 8) % 16); setInst(V3.hills, hi++, x, gh(x, z) + 1, z, 0.9 + ((hh >>> 16) % 5) * 0.25, c); }
    V3.hills.count = hi; V3.hills.instanceMatrix.needsUpdate = true;
    V3.texKey = ''; V3.treeKey = '';
  }
  const winter = Math.floor((W0.tick % 360) / 90) === 0;
  const tk = `${Math.floor(W0.tick / 360)}|${winter}|${C.dark}`;
  if (tk !== V3.treeKey) {
    V3.treeKey = tk; let n = 0, st0 = 0;
    V3.trees.material.color.set(winter ? (C.dark ? 0x9fb2b8 : 0xdfe9ee) : (C.dark ? 0x2d5a3b : 0x5f9a5a));
    for (let c = 0; c < 2500 && n < 2590; c++) {
      if (W0.ter[c] !== 'f') continue;
      const cnt = Math.round(3 * Math.min(1, W0.wood[c] / 60));
      for (let i = 0; i < 3; i++) {
        const x = (c % 50) * 20 + 4 + ((c * 31 + i * 47) % 12), z = Math.floor(c / 50) * 20 + 4 + ((c * 17 + i * 29) % 12), s = 0.8 + ((c + i) % 4) * 0.15;
        if (i < cnt) { setInst(V3.trees, n, x, gh(x, z) + 9 * s, z, s); setInst(V3.trunks, n, x, gh(x, z) + 1.5, z, s); n++; }
        else if (st0 < 2590) setInst(V3.stumps, st0++, x, gh(x, z) + 1, z, s);
      }
    }
    V3.stumps.count = st0; V3.stumps.instanceMatrix.needsUpdate = true;
    V3.trees.count = V3.trunks.count = n; V3.trees.instanceMatrix.needsUpdate = V3.trunks.instanceMatrix.needsUpdate = true;
  }
  const xk = `${Math.floor(W0.tick / 30)}|${C.dark}|${W0.groups.length}|${(W0.states || []).length}|${W0.frozen}|${W0.roadV}|${Object.keys(W0.bridge || {}).length}`;
  if (xk !== V3.texKey || now - V3.texAt > 8000) { V3.texKey = xk; V3.texAt = now; paint3DTexture(W0); }
  if (now - V3.objAt < 500) return;
  V3.objAt = now;
  let h = 0, b = 0, s = 0, sp = 0;
  for (const g of W0.groups) {
    if (!g.home) continue;
    const fill = hsl3(g.hue, C.dark ? -4 : 14), roofC = hsl3(g.hue, C.dark ? -20 : -14);
    for (const hh of g.houses) { if (h >= 900) break; const y = gh(hh.x, hh.y); if (hh.ruined) { setInst(V3.houses, h, hh.x, y + 2, hh.y, 1, -(hh.angle ?? Math.atan2(g.plan?.uy || 0, g.plan?.ux || 1)), 0.45); V3.houses.setColorAt(h, hexOf(rgba(C.muted, 1))); setInst(V3.roofs, h, hh.x, -50, hh.y, 0.01); h++; continue; } setInst(V3.houses, h, hh.x, y + 4, hh.y, 1, -(hh.angle ?? Math.atan2(g.plan?.uy || 0, g.plan?.ux || 1))); V3.houses.setColorAt(h, hh.earth ? hexOf("#a7926e") : fill); setInst(V3.roofs, h, hh.x, y + 11.4, hh.y, 1, -(hh.angle ?? Math.atan2(g.plan?.uy || 0, g.plan?.ux || 1))); V3.roofs.setColorAt(h, roofC); h++; }
    if (g.workshop && b < 80) { const w = g.workshop, y = gh(w.x, w.y); setInst(V3.big, b, w.x, y + 5, w.y, 1, -(w.angle || 0)); V3.big.setColorAt(b, roofC); setInst(V3.chim, b, w.x + 5 * Math.cos(w.angle || 0), y + 13, w.y + 5 * Math.sin(w.angle || 0)); b++; }
    if (g.granary && s < 80) { const w = g.granary, y = gh(w.x, w.y); setInst(V3.silos, s, w.x, y + 5.5, w.y, 1, -(w.angle || 0)); V3.silos.setColorAt(s, fill); s++; }
    if (g.shrine && sp < 80) { const w = g.shrine, y = gh(w.x, w.y), f = W0.faiths && W0.faiths[g.faith]; setInst(V3.spires, sp, w.x, y + 11, w.y); V3.spires.setColorAt(sp, hsl3(f ? f.hue : g.hue, -4)); sp++; }
  }
  for (const r of W0.ruins || []) for (const hh of r.houses) { if (h >= 900) break; const y = gh(hh.x, hh.y); setInst(V3.houses, h, hh.x, y + 2, hh.y, 1, hh.x, 0.45); V3.houses.setColorAt(h, hexOf(rgba(C.muted, 1)).clone()); setInst(V3.roofs, h, hh.x, y - 20, hh.y, 0.01); V3.roofs.setColorAt(h, hexOf(rgba(C.muted, 1)).clone()); h++; }
  let si = 0, cr = 0;
  const boxAt = (x, y, z, w, h, d, yaw = 0) => {
    if (si >= V3.sites.instanceMatrix.count) return;
    const o = V3.dummy; o.position.set(x, y, z); o.rotation.set(0, -yaw, 0); o.scale.set(w, h, d); o.updateMatrix();
    V3.sites.setMatrixAt(si++, o.matrix);
  };
  const season = Math.floor((W0.tick % 360) / 90), sh = [0, 0.35, 0.85, 1.1][season], ccol = season === 3 ? hexOf(C.dark ? '#b9963c' : '#d9b04a').clone() : hexOf(C.dark ? '#4f7a36' : '#7eae4e').clone();
  for (const g of W0.groups) {
    if (!g.home) continue;
    const st = g.site;
    if (st && st.kind !== 'field' && st.kind !== 'palisade') {
      const y = gh(st.x, st.y), angle = st.angle || 0;
      const { width, depth } = st.footprint || { width: 10, depth: 10 };
      if (st.kind === 'bridge' && st.approaches) {
        const [a, b] = st.approaches;
        for (const p of [a, b]) boxAt(p.x, gh(p.x, p.y) + 0.4, p.y, 6, 0.8, 10);
        if (st.phase === 'supports' || st.phase === 'deck') {
          const mid = (a.x + b.x) / 2, top = Math.max(gh(a.x, a.y), gh(b.x, b.y)) + 1;
          for (const x of [a.x + (mid - a.x) * .6, b.x + (mid - b.x) * .6]) {
            const base = gh(x, a.y);
            boxAt(x, (top + base) / 2, a.y, 2.5, top - base, 10);
          }
          if (st.phase === 'deck') boxAt(mid, top, a.y, Math.abs(b.x - a.x) * (0.3 + 0.7 * (st.prog / st.need - .68) / .32), 1.2, 9);
        }
      } else {
        boxAt(st.x, y + 0.16, st.y, width, .32, depth, angle);
        if (st.phase === 'frame' || st.phase === 'roof') for (const dx of [-width * .43, width * .43]) for (const dz of [-depth * .43, depth * .43]) {
          const x = st.x + dx * Math.cos(angle) - dz * Math.sin(angle), z = st.y + dx * Math.sin(angle) + dz * Math.cos(angle);
          boxAt(x, gh(x, z) + 3, z, .8, 6, .8, angle);
        }
        if (st.phase === 'roof') boxAt(st.x, y + 6, st.y, width, .8, depth, angle);
        if (st.phase === 'lining' || st.phase === 'finish') boxAt(st.x, y + .9, st.y, width, 1.8, depth, angle);
        if (st.delivered?.wood) boxAt(st.x + width * .8, y + .6, st.y, 2.5, 1.2, 5);
      }
    }
    if (sh > 0) for (const f of g.fields) for (let i = 0; i < 6 && cr < 900; i++) { const fx = f.x - 6 + (i % 3) * 6, fz = f.y - 3.5 + Math.floor(i / 3) * 7; setInst(V3.crops, cr, fx, gh(fx, fz) + sh * 2.2, fz, 1, 0, sh * 4.4); V3.crops.setColorAt(cr, ccol); cr++; }
  }
  let bi = 0, ri = 0;
  for (const { a, b } of bridgeSpans(W0)) {
    if (bi >= 80) break;
    const len = (b.x - a.x) / 24, x = (a.x + b.x) / 2, z = a.y;
    const y = Math.max(gh(a.x, z), gh(b.x, z), 0) + 1.5;
    V3.bridges.setMatrixAt(bi++, V3.dummy.matrix.compose(V3.dummy.position.set(x, y, z), V3.dummy.quaternion.identity(), V3.dummy.scale.set(len, 1, 1)));
    if (ri < 158) for (const dz of [-5, 5]) V3.rails.setMatrixAt(ri++, V3.dummy.matrix.compose(V3.dummy.position.set(x, y + 2.2, z + dz), V3.dummy.quaternion.identity(), V3.dummy.scale.set(len, 1, 1)));
  }
  V3.bridges.count = bi; V3.rails.count = ri; V3.bridges.instanceMatrix.needsUpdate = true; V3.rails.instanceMatrix.needsUpdate = true;
  V3.water.material.color.set(W0.frozen ? (C.dark ? 0xb8c8d4 : 0xe4eef4) : 0x6fa8c8); V3.water.material.opacity = W0.frozen ? 0.96 : 0.93;
  for (const [m, c] of [[V3.sites, si], [V3.crops, cr]]) { m.count = c; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  for (const [m, c] of [[V3.houses, h], [V3.roofs, h], [V3.big, b], [V3.chim, b], [V3.silos, s], [V3.spires, sp]]) { m.count = c; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  updatePalisades3D(W0);
}
function updatePalisades3D(W0) {
  const active = W0.groups.filter(g => g.site?.kind === 'palisade').map(g => g.site);
  const wk = JSON.stringify([W0.seed, W0.wallV, active.map(st => [st.id, st.phase, Math.floor(20 * st.prog / st.need)])]);
  if (wk === V3.wallsKey && W0 === V3.wallWorld) return;
  V3.wallsKey = wk; V3.wallWorld = W0;
  V3.wallG.clear();
  const T = THREE;
  V3.postG ||= new T.CylinderGeometry(.8, .94, 1, 7);
  V3.pointG ||= new T.ConeGeometry(.8, 1, 7);
  V3.wallMaterial ||= new T.MeshLambertMaterial({ color: 0x775232 });
  V3.trenchMaterial ||= new T.MeshLambertMaterial({ color: 0x786852 });
  V3.trenchG ||= new T.BoxGeometry(1, .35, 1);
  const add = (geo, mat, x, y, z, w, h, d, yaw = 0) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(w, h, d); m.rotation.y = -yaw; V3.wallG.add(m);
  };
  const built = [...W0.groups, ...(W0.ruins || [])].flatMap(g => g.fortifications || []);
  for (const [layout, site] of [...built.map(w => [w, null]), ...active.map(st => [st.layout, st])]) {
    let remaining = site ? Math.max(0, Math.min(1, (site.prog / site.need - .32) / .56)) * layout.posts : Infinity;
    for (const { a, b } of layout.segments) {
      const len = Math.hypot(b.x - a.x, b.y - a.y), yaw = Math.atan2(b.y - a.y, b.x - a.x);
      const count = Math.ceil(len / (layout.posts ? 1.55 : 1.8)), height = layout.height;
      for (let i = 0; i < count; i++) {
        const t = (i + .5) / count, x = a.x + (b.x - a.x) * t, z = a.y + (b.y - a.y) * t;
        const y = gh(x, z);
        if (site && remaining-- < 1) {
          const dug = Math.min(1, site.prog / site.need / .32);
          if (t > dug) continue;
          add(V3.trenchG, V3.trenchMaterial, x, y + .15, z, len / count, 1, 1.6, yaw);
        } else {
          add(V3.postG, V3.wallMaterial, x, y + height / 2, z, 1, height, 1);
          add(V3.pointG, V3.wallMaterial, x, y + height + .43, z, 1, .86, 1);
        }
      }
    }
    if (!site || site.phase === 'finish') for (const gate of layout.gates) {
      if (gate.angle === undefined) continue;
      const x0 = gate.x, z0 = gate.y, height = layout.height;
      for (const side of [-1, 1]) {
        const x = x0 + Math.cos(gate.angle) * side * gate.width / 2;
        const z = z0 + Math.sin(gate.angle) * side * gate.width / 2;
        add(V3.postG, V3.wallMaterial, x, gh(x, z) + height / 2, z, 1.4, height, 1.4);
      }
      add(V3.trenchG, V3.wallMaterial, x0, gh(x0, z0) + height, z0, gate.width + 1.1, 3, 1.6, gate.angle);
    }
  }
}
function render3D(now) {
  const W0 = S;
  rebuildStatic(W0, now);
  if (V3.fogKey !== C.plate) { V3.fogKey = C.plate; V3.scene.background = hexOf(C.plate).clone(); V3.scene.fog = new THREE.Fog(V3.scene.background.clone(), 1500, 3800); V3.hemi.intensity = C.dark ? 0.5 : 0.55; V3.sun.intensity = C.dark ? 0.5 : 0.6; }
  const n = Math.min(700, W0.agents.length); V3.ids = [];
  let c = 0, f = 0, cw = 0, cs = 0, cf = 0, bk = 0;
  for (let i = 0; i < n; i++) {
    const a = W0.agents[i], d = D.get(a.id), g = a.group && W0._g.get(a.group), y = gh(d.x, d.y), s = a.role === 'leader' ? 1.45 : 1;
    setInst(V3.bodies, i, d.x, y + 3.5 * s, d.y, s); setInst(V3.heads, i, d.x, y + 8.6 * s, d.y, s);
    const col = g ? hsl3(g.hue, a.war ? -10 : 0) : hexOf(rgba(C.muted, 1)).clone();
    if (a.id === sel) col.set(0xffffff);
    V3.bodies.setColorAt(i, col); V3.heads.setColorAt(i, a.war ? hexOf(C.red).clone() : col);
    V3.ids[i] = a.id;
    if (a.car && c < 80) { setInst(V3.carts, c++, d.x + 6, y + 3, d.y, 1, Math.atan2(a.x - d.x, a.y - d.y)); }
    if (a.job === 'water' && a.wc && bk < 200) setInst(V3.bucket, bk++, d.x + 2.5, y + 7 * s, d.y);
    const cargo = a.load > 0.3 ? a.lk : a.job === 'build' && a.siteTrip?.id === g?.site?.id ? a.siteTrip?.kind : null;
    if (cargo) { const m = cargo === 'wood' ? V3.cargoW : cargo === 'stone' ? V3.cargoS : V3.cargoF, k = m === V3.cargoW ? cw++ : m === V3.cargoS ? cs++ : cf++; if (k < 600) setInst(m, k, d.x, y + 12.5 * s, d.y, 1, a.id); }
  }
  let sm = 0;
  const winter = Math.floor((W0.tick % 360) / 90) === 0, tt = reduce ? 0 : now / 1600;
  for (const g of W0.groups) {
    if (!g.home) continue;
    const chimneys = [];
    if (winter) for (const hh of g.houses.slice(0, 6)) chimneys.push([hh.x, gh(hh.x, hh.y) + 15, hh.y, 0.8]);
    if (g.workshop && g.members.some(id => { const m = W0._a.get(id); return m && m.job === 'craft'; })) chimneys.push([g.workshop.x + 5 * Math.cos(g.workshop.angle || 0), gh(g.workshop.x, g.workshop.y) + 18, g.workshop.y + 5 * Math.sin(g.workshop.angle || 0), 1.2]);
    for (const [x, y, z, k] of chimneys) for (let i = 0; i < 3 && sm < 360; i++) { const p = (tt + i / 3 + x * 0.013) % 1; setInst(V3.smoke, sm++, x + p * 5, y + p * 20, z + p * 2, k * (0.5 + p * 1.3)); }
  }
  { let hb = 0, sl = 0;
    for (const b of W0.boats || []) {
      const p = boatPos(b, W0.tick); if (!p || hb >= 30) continue;
      const bob = p.beached || reduce ? 0 : Math.sin(now / 500 + b.t) * 0.6;
      const afloat = -2 + bob;
      const hullY = p.beached ? Math.max(-2, gh(p.x, p.y)) : afloat;
      setInst(V3.hull, hb++, p.x, hullY + 1.5, p.y, p.fade, -p.a);
      if (!p.beached) setInst(V3.sail, sl++, p.x, afloat + 12, p.y, p.fade, -p.a);
    }
    for (const b of fishBoats(W0, now)) { if (hb >= 80) break; setInst(V3.hull, hb++, b.x, -2 + (reduce ? 0 : Math.sin(now / 600 + b.x) * 0.5), b.y, 0.6, -b.a + 1.57); }
    { let gi = 0, gd = 0; for (const g of W0.groups) { if (g.goats && g.pasture) { const k = Math.min(g.goats, 24); for (let i = 0; i < k && gi < 400; i++) { const a = i * 2.4 + g.id, r = 6 + (i * 7) % 22, gx = g.pasture.x + Math.cos(a + now / 9000) * r, gz = g.pasture.y + Math.sin(a + now / 9000) * r * 0.7; setInst(V3.goat, gi++, gx, gh(gx, gz) + 2, gz, 1, a); } } if (g.home) { const P = g.plan; for (const h of g.houses) { if (h.ruined || gd >= 900) continue; let ox = 0, oz = 7; if (P) { const side = Math.sign((h.x - g.home.x) * -P.uy + (h.y - g.home.y) * P.ux) || 1; ox = -P.uy * side * 9; oz = P.ux * side * 9; } setInst(V3.garden, gd++, h.x + ox, gh(h.x + ox, h.y + oz) + 0.6, h.y + oz); } } } V3.goat.count = gi; V3.garden.count = gd; V3.goat.instanceMatrix.needsUpdate = true; V3.garden.instanceMatrix.needsUpdate = true; }
    V3.hull.count = hb; V3.sail.count = sl; V3.hull.instanceMatrix.needsUpdate = true; V3.sail.instanceMatrix.needsUpdate = true; }
  const landing = firstLanding(W0);
  let wreckCount = 0;
  if (landing) for (const plank of wreckTimbers(landing)) {
    setInst(V3.wreckWood, wreckCount++, plank.x, Math.max(-2, gh(plank.x, plank.y)) + 1, plank.y, 1, -plank.angle);
  }
  V3.wreckWood.count = wreckCount; V3.wreckWood.instanceMatrix.needsUpdate = true;
  let dr = 0;
  for (const nd of W0.nodes) {
    if (nd.kind === 'fish') continue;
    const nn = nd.amt / nd.cap > 0.6 ? 2 : nd.amt / nd.cap > 0.3 ? 1 : 0;
    for (let i = 0; i < nn && dr < 80; i++) { const ang = (reduce ? 0 : now / 5000) * (i ? -1 : 1) + nd.id + i * 3, x = nd.x + Math.cos(ang) * 24, z = nd.y + Math.sin(ang) * 24, y = gh(x, z), ry = -ang + (i ? 0 : Math.PI); setInst(V3.deer, dr, x, y + 3.5, z, 1, ry); const hx = x + Math.cos(ang + (i ? -1.57 : 1.57)) * 3.8, hz = z + Math.sin(ang + (i ? -1.57 : 1.57)) * 3.8; setInst(V3.deerH, dr, hx, y + 6, hz, 1, ry); dr++; }
  }
  { let si2 = 0, wi = 0; for (const sp of W0.springs || []) if (!sp.dry && si2 < 20) setInst(V3.springM, si2++, sp.x, gh(sp.x, sp.y) + 0.6, sp.y, sp.big ? 1.25 : 1); for (const g of W0.groups) if (g.well && wi < 80) { const y0 = gh(g.well.x, g.well.y); setInst(V3.wellM, wi, g.well.x, y0 + 2, g.well.y); setInst(V3.wellW, wi, g.well.x, g.well.dry ? -60 : y0 + 2.1, g.well.y); wi++; } V3.springM.count = si2; V3.wellM.count = wi; V3.wellW.count = wi; for (const m of [V3.springM, V3.wellM, V3.wellW]) m.instanceMatrix.needsUpdate = true; }
  for (const [m, k] of [[V3.bucket, bk], [V3.cargoW, cw], [V3.cargoS, cs], [V3.cargoF, cf], [V3.smoke, sm], [V3.deer, dr], [V3.deerH, dr]]) { m.count = Math.min(k, m.instanceMatrix.count); m.instanceMatrix.needsUpdate = true; }
  if (follow && sel && S._a.get(sel)) { const a = D.get(sel); V3.fly = { x: a.x, z: a.y }; }
  if (V3.fly) {
    const { x, z, distance, overview } = V3.fly, tg = V3.ctl.target, pos = V3.cam.position;
    const dx = x - tg.x, dz = z - tg.z, dy = -tg.y, f = reduce ? 1 : 0.10;
    const current = pos.distanceTo(tg), range = distance ?? current;
    tg.x += dx * f; tg.y += dy * f; tg.z += dz * f;
    if (overview) {
      pos.x += (x + range * 0.07 - pos.x) * f;
      pos.y += (range * 0.73 - pos.y) * f;
      pos.z += (z + range * 0.68 - pos.z) * f;
    } else {
      pos.x += dx * f; pos.y += dy * f; pos.z += dz * f;
      pos.sub(tg).multiplyScalar((current + (range - current) * f) / current).add(tg);
    }
    const error = overview ? Math.hypot(x + range * 0.07 - pos.x, range * 0.73 - pos.y, z + range * 0.68 - pos.z) : Math.abs(range - current);
    if (Math.hypot(dx, dy, dz) < 2 && error < 3) { V3.fly = null; syncCameraZoom(); }
  }
  for (const w of W0.wars || []) {
    if (f >= 20) break;
    const band = (w.fighters || []).map(id => D.get(id)).filter(Boolean), A = W0._g.get(w.att); if (!band.length || !A) continue;
    let fx = 0, fz = 0; for (const p of band) { fx += p.x; fz += p.y; } fx /= band.length; fz /= band.length;
    const y = gh(fx, fz); setInst(V3.poles, f, fx, y + 15, fz); setInst(V3.flags, f, fx + 3, y + 26, fz, 1, Math.PI / 2); V3.flags.setColorAt(f, hsl3(A.hue)); f++;
  }
  for (const [m, k] of [[V3.bodies, n], [V3.heads, n], [V3.carts, c], [V3.flags, f], [V3.poles, f]]) { m.count = k; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  V3.ctl.update();
  V3.ren.render(V3.scene, V3.cam);
  if (!V3.lf || now - V3.lf > 60) { labels3D(W0); V3.lf = now; }
}
function labels3D(W0) {
  const el = $('v3lab'), w = plate.clientWidth, h = plate.clientHeight, v = new THREE.Vector3(), out = [];
  const put = (x, y, z, html, cls) => { v.set(x, y, z).project(V3.cam); if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) return; out.push(`<span class="${cls}" style="left:${((v.x + 1) / 2 * w).toFixed(0)}px;top:${((1 - v.y) / 2 * h).toFixed(0)}px">${html}</span>`); };
  if (!V3.sc || performance.now() - V3.scAt > 2000) { V3.sc = stateCenters(W0); V3.scAt = performance.now(); }
  const landing = firstLanding(W0);
  if (landing) put(landing.x1, Math.max(0, gh(landing.x1, landing.y1)) + 22, landing.y1, LANDING_LABEL, 'l3landing');
  for (const c of V3.sc) put(c.x, gh(c.x, c.y) + 30, c.y, esc(c.st.name), 'l3s');
  for (const g of W0.groups.filter(g => g.home && (g.members.length >= 4 || g.sick > 0)).sort((a, b) => (b.sick > 0) - (a.sick > 0) || b.members.length - a.members.length).slice(0, 9)) {
    const r = RC.get(g.id); put(g.home.x, gh(g.home.x, g.home.y) + 26, g.home.y, `${esc(g.name)}${g.sick > 0 ? '<small class="sick">мор</small>' : r && g.members.length >= 5 ? `<small>${esc(SHORT[r.type] || '')}</small>` : ''}`, 'l3');
  }
  el.innerHTML = out.join('');
}
$('v2d').addEventListener('click', () => set3D(false));
$('v3d').addEventListener('click', () => set3D(true));

