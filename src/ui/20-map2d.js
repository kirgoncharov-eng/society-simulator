/* ---------- world drawing ---------- */
const tc = k => TC[k][C.dark ? 1 : 0];
function paintTerrain(res, W0 = S, out = terr) {
  out.width = out.height = res;
  const t = out.getContext('2d'), q = res / 1000;
  t.setTransform(q, 0, 0, q, 0, 0);
  let sd = 7;
  const rr = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  for (let c = 0; c < 2500; c++) {
    const k = W0.ter[c], x = (c % 50) * 20, y = Math.floor(c / 50) * 20;
    t.fillStyle = tc(k === 'w' ? 'r' : k); t.fillRect(x - .5, y - .5, 21, 21);
  }
  const tree = C.dark ? ['#244332', '#2d523c'] : ['#93b583', '#a7c495'];
  for (let c = 0; c < 2500; c++) {
    const k = W0.ter[c], x = (c % 50) * 20, y = Math.floor(c / 50) * 20;
    if (k === 'f') {
      const n = Math.round(1 + 3 * Math.min(1, W0.wood[c] / 60));
      for (let i = 0; i < n; i++) { const px = x + 3 + rr() * 14, py = y + 3 + rr() * 14, r = 3 + rr() * 3.5; t.fillStyle = tree[i % 2]; t.beginPath(); t.arc(px, py, r, 0, 7); t.fill(); }
    } else if (k === 'h') {
      t.strokeStyle = C.dark ? '#3c3c31' : '#c9bfa8'; t.lineWidth = 1.2;
      t.beginPath(); const px = x + 4 + rr() * 8, py = y + 12 + rr() * 4; t.moveTo(px, py); t.quadraticCurveTo(px + 5, py - 8, px + 10, py); t.stroke();
    } else if (k === 's' && rr() < .35) {
      t.strokeStyle = C.dark ? 'rgba(120,170,200,.25)' : 'rgba(255,255,255,.55)'; t.lineWidth = 1; t.beginPath(); const px = x + rr() * 12, py = y + 6 + rr() * 8; t.moveTo(px, py); t.quadraticCurveTo(px + 3, py - 3, px + 6, py); t.quadraticCurveTo(px + 9, py + 3, px + 12, py); t.stroke();
    } else if (k === 'r' && rr() < .25) {
      t.fillStyle = C.dark ? '#24382a' : '#bcd49c'; t.fillRect(x + rr() * 16, y + rr() * 16, 3, 1.5);
    }
  }
  const rv = W0.river || [];
  t.lineCap = 'round'; t.lineJoin = 'round';
  for (const [w, col] of [[34, tc('w')], [12, C.dark ? '#26516a' : '#c3dcea']]) {
    t.strokeStyle = col; t.lineWidth = w; t.beginPath();
    let on = false; rv.forEach(p => { if (p[0] < -1000) { on = false; return; } if (on) t.lineTo(p[0], p[1]); else { t.moveTo(p[0], p[1]); on = true; } }); t.stroke();
  }
}
function paintOwn(W0, out, res) {
  out.width = out.height = res;
  const t = out.getContext('2d'), q = res / 1000; t.setTransform(q, 0, 0, q, 0, 0);
  const own = W0.own; if (!own) return;
  const hue = new Map(W0.groups.map(g => [g.id, g.hue]));
  const sid = new Map(W0.groups.map(g => [g.id, g.state || null])), shue = new Map((W0.states || []).map(s2 => [s2.id, s2.hue]));
  for (const g of W0.groups) if (g.state && shue.has(g.state)) hue.set(g.id, shue.get(g.state));
  for (let c = 0; c < own.length; c++) { const o = own[c]; if (!o || !hue.has(o)) continue; t.fillStyle = hueC(hue.get(o), (C.dark ? .16 : .14) * (sid.get(o) ? 1.5 : 1)); t.fillRect((c % 50) * 20, Math.floor(c / 50) * 20, 20, 20); }
  const sb = new Map(), inner = new Path2D();
  const addS = (st, x1, y1, x2, y2) => { if (!sb.has(st)) sb.set(st, new Path2D()); const p = sb.get(st); p.moveTo(x1, y1); p.lineTo(x2, y2); };
  for (let c = 0; c < own.length; c++) {
    const o = own[c], i = c % 50, j = Math.floor(c / 50), x = i * 20, y = j * 20;
    for (const [q, x1, y1, x2, y2] of [[i < 49 ? c + 1 : -1, x + 20, y, x + 20, y + 20], [j < 49 ? c + 50 : -1, x, y + 20, x + 20, y + 20]]) {
      if (q < 0) continue; const p = own[q], so = o ? sid.get(o) : null, sp = p ? sid.get(p) : null;
      if (so === sp && so && o !== p) { inner.moveTo(x1, y1); inner.lineTo(x2, y2); }
      else if (so !== sp) { if (so) addS(so, x1, y1, x2, y2); if (sp) addS(sp, x1, y1, x2, y2); }
    }
  }
  const segs = new Map(), hot = new Path2D();
  const add = (o, x1, y1, x2, y2) => { if (!segs.has(o)) segs.set(o, new Path2D()); const p = segs.get(o); p.moveTo(x1, y1); p.lineTo(x2, y2); };
  for (let c = 0; c < own.length; c++) {
    const o = own[c], i = c % 50, j = Math.floor(c / 50), x = i * 20, y = j * 20;
    const r = i < 49 ? own[c + 1] : 0, b = j < 49 ? own[c + 50] : 0;
    const ss = (p1, p2) => p1 && p2 && sid.get(p1) && sid.get(p1) === sid.get(p2);
    if (i < 49 && o !== r && !ss(o, r)) { if (o && r && hue.has(o) && hue.has(r)) { hot.moveTo(x + 20, y); hot.lineTo(x + 20, y + 20); } else if (o || r) add(o || r, x + 20, y, x + 20, y + 20); }
    if (j < 49 && o !== b && !ss(o, b)) { if (o && b && hue.has(o) && hue.has(b)) { hot.moveTo(x, y + 20); hot.lineTo(x + 20, y + 20); } else if (o || b) add(o || b, x, y + 20, x + 20, y + 20); }
    if (o && (i === 0 || i === 49 || j === 0 || j === 49)) { if (i === 0) add(o, x, y, x, y + 20); if (j === 0) add(o, x, y, x + 20, y); }
  }
  t.lineWidth = 1.6; t.lineCap = 'round';
  for (const [o, p] of segs) { if (!hue.has(o)) continue; t.strokeStyle = hueC(hue.get(o), .85); t.stroke(p); }
  t.strokeStyle = rgba(C.red, .85); t.lineWidth = 2.4; t.setLineDash([5, 3]); t.stroke(hot); t.setLineDash([]);
  t.strokeStyle = rgba(C.bg, .55); t.lineWidth = 1; t.setLineDash([2, 3]); t.stroke(inner); t.setLineDash([]);
  for (const [st, p] of sb) { if (!shue.has(st)) continue; t.strokeStyle = hueC(shue.get(st), 1, C.dark ? 6 : -18); t.lineWidth = 4; t.stroke(p); }
}
function stateCenters(W0) {
  const own = W0.own, res = []; if (!own || !W0.states) return res;
  for (const st of W0.states) {
    const set = new Set(st.members); let sx = 0, sy = 0, n = 0;
    for (let c = 0; c < own.length; c++) if (set.has(own[c])) { sx += (c % 50) * 20 + 10; sy += Math.floor(c / 50) * 20 + 10; n++; }
    if (n) res.push({ st, x: sx / n, y: sy / n });
  }
  return res;
}
let ownCv = document.createElement('canvas'), ownKey = '';
const LANDING_LABEL = 'Первая высадка';
function firstLanding(W0) {
  const boat = W0.boats?.[0];
  return W0.tick < 360 && boat?.t === 0 && !boat.out ? boat : null;
}
function wreckTimbers(boat) {
  const angle = Math.atan2(boat.y1 - boat.y0, boat.x1 - boat.x0);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return [[-23, -14, 0.3], [-11, 17, -0.55], [12, 21, 0.75]].map(([along, across, turn]) => ({
    x: boat.x1 + along * cos - across * sin,
    y: boat.y1 + along * sin + across * cos,
    angle: angle + turn
  }));
}
function boatPos(b, tick) {
  const age = tick - b.t;
  if (b.out && age > 70) return null;
  if (!b.out && age > 360 * 4) return null;
  const k = b.t === 0 && !b.out ? 1 : Math.min(1, age / 50);
  const e = k * k * (3 - 2 * k);
  return { x: b.x0 + (b.x1 - b.x0) * e, y: b.y0 + (b.y1 - b.y0) * e, a: Math.atan2(b.y1 - b.y0, b.x1 - b.x0), moving: k < 1, beached: !b.out && k >= 1, fade: b.out ? 1 - Math.max(0, (age - 50) / 20) : 1 };
}
function fishBoats(W0, now) {
  const out = []; if (!W0.isle) return out;
  for (const g of W0.groups) {
    if (!g.landing || !g.fboats) continue;
    const at = g.members.filter(id => { const m = W0._a.get(id); return m && m.job === 'fish' && Math.hypot(m.x - g.landing.x, m.y - g.landing.y) < 30; }).length;
    const nb = Math.min(g.fboats, Math.ceil(at / 2)); if (!nb) continue;
    const d = Math.hypot(g.landing.x - W0.isle.x, g.landing.y - W0.isle.y) || 1, ux = (g.landing.x - W0.isle.x) / d, uy = (g.landing.y - W0.isle.y) / d;
    for (let i = 0; i < nb; i++) { const r = 45 + i * 22 + Math.sin(now / 1700 + i + g.id) * 6, sx = -uy * (i - (nb - 1) / 2) * 26; out.push({ x: g.landing.x + ux * r + sx, y: g.landing.y + uy * r - ux * (i - (nb - 1) / 2) * 26, a: Math.atan2(uy, ux) + 1.57 + Math.sin(now / 900 + i) * 0.15 }); }
  }
  return out;
}
function drawLife(c, W0, now) {
  // gardens behind houses
  c.fillStyle = C.dark ? 'rgba(90,140,70,.55)' : 'rgba(120,170,90,.6)';
  for (const g of W0.groups) { if (!g.home) continue; const P = g.plan; for (const h of g.houses) { if (h.ruined) continue; let ox = 0, oy = 7; if (P) { const side = Math.sign((h.x - g.home.x) * -P.uy + (h.y - g.home.y) * P.ux) || 1; ox = -P.uy * side * 9; oy = P.ux * side * 9; } c.fillRect(h.x + ox - 4, h.y + oy - 3, 8, 6); } }
  // goats
  for (const g of W0.groups) { if (!g.goats || !g.pasture) continue; const k = Math.min(g.goats, 24); for (let i = 0; i < k; i++) { const a = i * 2.4 + g.id, r = 6 + (i * 7) % 22, gx = g.pasture.x + Math.cos(a + now / 9000) * r, gy = g.pasture.y + Math.sin(a + now / 9000) * r * 0.7; c.fillStyle = C.dark ? '#e8e4da' : '#f7f5ef'; c.beginPath(); c.ellipse(gx, gy, 3.2, 2.2, a, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.6; c.stroke(); } }
  // fishing boats at sea
  for (const b of fishBoats(W0, now)) { c.save(); c.translate(b.x, b.y); c.rotate(b.a); c.fillStyle = C.dark ? '#a07a50' : '#7a5530'; c.beginPath(); c.moveTo(-9, -3); c.lineTo(7, -3); c.lineTo(11, 0); c.lineTo(7, 3); c.lineTo(-9, 3); c.closePath(); c.fill(); c.restore(); }
}
function drawBoats(c, W0) {
  const landing = firstLanding(W0);
  if (landing) {
    c.fillStyle = C.dark ? '#b78b60' : '#805537';
    for (const plank of wreckTimbers(landing)) {
      c.save();
      c.translate(plank.x, plank.y);
      c.rotate(plank.angle);
      c.fillRect(-7, -1.5, 14, 3);
      c.restore();
    }
  }
  for (const b of W0.boats || []) {
    const p = boatPos(b, W0.tick); if (!p) continue;
    c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.globalAlpha *= p.fade;
    c.fillStyle = C.dark ? '#a07a50' : '#7a5530'; c.beginPath(); c.moveTo(-14, -5); c.lineTo(10, -5); c.lineTo(16, 0); c.lineTo(10, 5); c.lineTo(-14, 5); c.closePath(); c.fill();
    if (!p.beached) { c.fillStyle = C.dark ? '#e8e0d0' : '#fbf7ee'; c.beginPath(); c.moveTo(-2, -2); c.lineTo(-2, -20); c.lineTo(9, -3); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.8; c.stroke(); }
    else if (b.t === 0) {
      c.fillStyle = C.dark ? '#d5af7e' : '#d9b488';
      for (const seat of [-7, 2, 8]) c.fillRect(seat, -3, 2, 6);
    }
    c.restore();
  }
}
function drawWater(c, W0) {
  if (!W0.ter) return;
  if (W0.frozen) { c.fillStyle = C.dark ? 'rgba(200,215,230,.38)' : 'rgba(240,247,252,.82)'; for (let cc = 0; cc < 2500; cc++) if (W0.ter[cc] === 'w') c.fillRect((cc % 50) * 20 - 1, ((cc / 50) | 0) * 20 - 1, 22, 22); }
  for (const sp of W0.springs || []) { c.beginPath(); c.arc(sp.x, sp.y, sp.big ? 9 : 7, 0, 7); c.fillStyle = sp.dry ? (C.dark ? 'rgba(120,100,70,.6)' : 'rgba(170,140,100,.55)') : (C.dark ? 'rgba(90,160,210,.85)' : 'rgba(80,150,205,.85)'); c.fill(); c.lineWidth = 1.2; c.strokeStyle = C.dark ? 'rgba(200,230,255,.6)' : 'rgba(255,255,255,.9)'; c.stroke(); }
  for (const g of W0.groups) if (g.well) { c.beginPath(); c.arc(g.well.x, g.well.y, 5, 0, 7); c.fillStyle = g.well.dry ? '#a08060' : (C.dark ? '#5aa0d0' : '#4a90c8'); c.fill(); c.lineWidth = 2.2; c.strokeStyle = C.dark ? '#9a9a90' : '#7d7a70'; c.stroke(); }
  c.fillStyle = C.dark ? 'rgba(170,170,160,.7)' : 'rgba(120,115,105,.65)';
  for (const k in W0.ford || {}) { const cc = +k, x = (cc % 50) * 20, y = ((cc / 50) | 0) * 20; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x + 3 + i * 5, y + 10 + (i % 2 ? 3 : -3), 2.1, 0, 7); c.fill(); } }
}
function drawNet(c, W0, k = 1) {
  const R0 = W0.road; if (!R0) return;
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const lvl of [1, 2]) {
    c.strokeStyle = lvl === 2 ? (C.dark ? 'rgba(175,148,105,.9)' : 'rgba(150,112,64,.9)') : (C.dark ? 'rgba(145,122,88,.75)' : 'rgba(165,132,85,.75)');
    c.lineWidth = (lvl === 2 ? 5.5 : 3.2) * k; c.beginPath();
    for (let cc = 0; cc < 2500; cc++) {
      if (R0[cc] < lvl) continue; const cx = cc % 50, cy = (cc / 50) | 0, x = cx * 20 + 10, y = cy * 20 + 10;
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || nx >= 50 || ny >= 50) continue; const q = ny * 50 + nx; if (R0[q] < lvl) continue;
        if (dx && dy && (R0[cy * 50 + nx] >= lvl || R0[ny * 50 + cx] >= lvl)) continue;
        c.moveTo(x, y); c.lineTo(nx * 20 + 10, ny * 20 + 10);
      }
    }
    c.stroke();
  }
  for (const g of W0.groups) {
    const street = g.plan?.street;
    if (!g.home || !street || !g.houses.length) continue;
    let lo = -8, hi = 8;
    for (const h of [...g.houses, ...(g.fortifications || []).flatMap(w => w.gates)]) {
      const x = h.x - g.home.x, y = h.y - g.home.y;
      if (Math.abs(y * g.plan.ux - x * g.plan.uy) > 22) continue;
      const t = x * g.plan.ux + y * g.plan.uy;
      lo = Math.min(lo, t - 8); hi = Math.max(hi, t + 8);
    }
    lo = Math.max(lo, -Math.hypot(street.a.x - g.home.x, street.a.y - g.home.y));
    hi = Math.min(hi, Math.hypot(street.b.x - g.home.x, street.b.y - g.home.y));
    c.strokeStyle = C.dark ? 'rgba(150,125,90,.75)' : 'rgba(168,134,88,.75)';
    c.lineWidth = street.width * 0.55 * k; c.beginPath();
    c.moveTo(g.home.x + lo * g.plan.ux, g.home.y + lo * g.plan.uy);
    c.lineTo(g.home.x + hi * g.plan.ux, g.home.y + hi * g.plan.uy); c.stroke();
  }
  for (const { a, b } of bridgeSpans(W0)) {
    c.fillStyle = C.dark ? '#8a6a44' : '#9b7445';
    c.fillRect(a.x, a.y - 5, b.x - a.x, 10);
    c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 0.9;
    c.strokeRect(a.x, a.y - 5, b.x - a.x, 10);
    c.beginPath();
    for (let x = a.x + 4; x < b.x; x += 4) { c.moveTo(x, a.y - 5); c.lineTo(x, a.y + 5); }
    c.stroke();
  }
  c.lineCap = 'butt';
}
function bridgeSpans(W0) {
  const spans = (W0.bridgePlans || []).map(p => ({ a: p.approaches[0], b: p.approaches[1] }));
  const saved = new Set((W0.bridgePlans || []).flatMap(p => p.cells));
  const rows = new Map();
  for (const key in W0.bridge || {}) {
    const cell = +key;
    if (saved.has(cell)) continue;
    const row = Math.floor(cell / 50), x = (cell % 50) * 20 + 10;
    const span = rows.get(row) || { a: { x: x - 20, y: row * 20 + 10 }, b: { x: x + 20, y: row * 20 + 10 } };
    span.a.x = Math.min(span.a.x, x - 20); span.b.x = Math.max(span.b.x, x + 20);
    rows.set(row, span);
  }
  return spans.concat([...rows.values()]);
}
function drawWall(g, px) {
  const site = g.site?.kind === 'palisade' ? g.site : null;
  for (const [walls, pending] of [[g.fortifications || [], false], [site ? [site.layout] : [], true]]) {
    if (!walls.length) continue;
    ctx.strokeStyle = pending ? C.muted : C.dark ? '#7a5a36' : '#8a6234';
    ctx.lineWidth = px(pending ? 2 : 3);
    ctx.setLineDash(pending ? [px(3), px(3)] : []);
    ctx.beginPath();
    for (const wall of walls) for (const { a, b } of wall.segments) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    ctx.stroke();
  }
  ctx.setLineDash([]);
}
function drawBuildingSite(st, px) {
  if (!st || st.kind === 'palisade' || st.kind === 'field') return;
  ctx.strokeStyle = C.muted;
  ctx.lineWidth = px(1.6);
  ctx.setLineDash(st.phase === 'ground' || st.phase === 'dig' ? [px(3), px(2)] : []);
  if (st.kind === 'bridge' && st.approaches) {
    const [a, b] = st.approaches;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  } else {
    const { width, depth } = st.footprint || { width: 10, depth: 10 };
    ctx.save(); ctx.translate(st.x, st.y); ctx.rotate(st.angle || 0);
    ctx.strokeRect(-width / 2, -depth / 2, width, depth);
    ctx.restore();
  }
  ctx.setLineDash([]);
}
function houseGlyph(x, y, sz, fill, roof, dashed, px) {
  ctx.beginPath(); ctx.rect(x - sz / 2, y - sz * .2, sz, sz * .7);
  ctx.moveTo(x - sz * .65, y - sz * .15); ctx.lineTo(x, y - sz * .8); ctx.lineTo(x + sz * .65, y - sz * .15); ctx.closePath();
  if (dashed) { ctx.setLineDash([px(2), px(2)]); ctx.strokeStyle = roof; ctx.lineWidth = px(1); ctx.stroke(); ctx.setLineDash([]); return; }
  ctx.fillStyle = fill; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - sz * .65, y - sz * .15); ctx.lineTo(x, y - sz * .8); ctx.lineTo(x + sz * .65, y - sz * .15); ctx.closePath(); ctx.fillStyle = roof; ctx.fill();
}
function workshopGlyph(x0, y0, fill, roof, dashed, smoke, px, now) {
  ctx.save(); ctx.translate(x0, y0); ctx.scale(1.3, 1.3); const x = 0, y = 0;
  const done = () => ctx.restore();
  ctx.beginPath(); ctx.rect(x - 9, y - 4, 18, 10); ctx.rect(x + 4, y - 12, 3.5, 7);
  if (dashed) { ctx.setLineDash([px(2), px(2)]); ctx.strokeStyle = roof; ctx.lineWidth = px(1); ctx.stroke(); ctx.setLineDash([]); done(); return; }
  ctx.fillStyle = roof; ctx.fill();
  ctx.fillStyle = fill; ctx.fillRect(x - 7, y - 2, 14, 7);
  ctx.fillStyle = roof; ctx.fillRect(x - 2, y + 1, 4, 5);
  if (smoke) { const t = reduce ? 0 : now / 900; for (let i = 0; i < 3; i++) { const p = (t + i / 3) % 1; ctx.fillStyle = rgba(C.muted, .45 * (1 - p)); ctx.beginPath(); ctx.arc(x + 5.7 + Math.sin(p * 6 + i) * 2, y - 13 - p * 12, 2 + p * 3, 0, 7); ctx.fill(); } }
  done();
}
function granaryGlyph(x0, y0, fill, roof, dashed, px) {
  ctx.save(); ctx.translate(x0, y0); ctx.scale(1.3, 1.3); const x = 0, y = 0;
  ctx.beginPath(); ctx.rect(x - 5, y - 4, 10, 10); ctx.moveTo(x - 6.5, y - 4); ctx.lineTo(x, y - 11); ctx.lineTo(x + 6.5, y - 4); ctx.closePath();
  if (dashed) { ctx.setLineDash([px(2), px(2)]); ctx.strokeStyle = roof; ctx.lineWidth = px(1); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); return; }
  ctx.fillStyle = fill; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 6.5, y - 4); ctx.lineTo(x, y - 11); ctx.lineTo(x + 6.5, y - 4); ctx.closePath(); ctx.fillStyle = roof; ctx.fill();
  ctx.strokeStyle = roof; ctx.lineWidth = px(1); ctx.beginPath(); ctx.moveTo(x - 5, y + 1); ctx.lineTo(x + 5, y + 1); ctx.stroke();
  ctx.restore();
}
function quarryGlyph(x, y, px) {
  const c1 = C.dark ? '#6b6a60' : '#a39d8f', c2 = C.dark ? '#8a887c' : '#c4beb0';
  for (const [dx, dy, r, c] of [[-5, 3, 4.5, c1], [3, 4, 3.8, c2], [0, -2, 4, c2], [6, -3, 3, c1]]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, 7); ctx.fill(); }
  ctx.strokeStyle = rgba(C.ink, .4); ctx.lineWidth = px(1); ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.stroke();
}
function fieldGlyph(f, col, edge, winter, px) {
  ctx.fillStyle = col; ctx.fillRect(f.x - 9, f.y - 7, 18, 14);
  ctx.strokeStyle = winter ? rgba(C.muted, .35) : 'rgba(0,0,0,.12)'; ctx.lineWidth = px(1);
  ctx.beginPath(); for (let i = -6; i <= 6; i += 3) { ctx.moveTo(f.x - 8, f.y + i); ctx.lineTo(f.x + 8, f.y + i); } ctx.stroke();
  if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = px(1.2); ctx.strokeRect(f.x - 9, f.y - 7, 18, 14); }
}

function draw(now) {
  const W = cv.width, H = cv.height, s = Math.min(W, H) / 1000, dpr = W / Math.max(1, plate.clientWidth);
  const detailed = effectiveMode !== 'centuries', people = detailed ? S.agents : [];
  const t = reduce ? 0 : now, L = reduce ? 1 : 0.12;
  const tracked = followedPlace();
  if (tracked && !directedCamera()) { vt.x = tracked.x; vt.y = tracked.y; vt.z = Math.max(vt.z, 2.2); }
  view.z += (vt.z - view.z) * L; view.x += (vt.x - view.x) * L; view.y += (vt.y - view.y) * L;
  const half = 500 / view.z; view.x = Math.max(half, Math.min(1000 - half, view.x)); view.y = Math.max(half, Math.min(1000 - half, view.y));
  const k = s * view.z, ox = W / 2 - view.x * k, oy = H / 2 - view.y * k; T = { k, ox, oy };
  const px = v => v * dpr / k;
  const who = focusEv && focusEv.who ? new Set(focusEv.who) : null;
  const fgs = focusEv && focusEv.gs ? new Set(focusEv.gs) : null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = C.plate; ctx.fillRect(0, 0, W, H);
  const res = Math.min(2400, Math.round(W * 1.6)), tk = `${res}|${C.dark}|${S.seed}`;
  if (S.ter && (tk !== terrKey || now - terrAt > 4000)) { paintTerrain(res); terrKey = tk; terrAt = now; }
  ctx.setTransform(k, 0, 0, k, ox, oy);
  if (S.ter) ctx.drawImage(terr, 0, 0, 1000, 1000);
  const season = Math.floor((S.tick % 360) / 90), winter = season === 0;
  if (winter) {
    const day = S.tick % 360 + S.minute / SIM.DAY_MINUTES;
    const cover = Math.max(0, Math.min(1, day / 8, (90 - day) / 8));
    ctx.fillStyle = C.dark ? `rgba(190,215,240,${0.07 * cover})` : `rgba(255,255,255,${0.38 * cover})`;
    ctx.fillRect(0, 0, 1000, 1000);
  }
  const ok2 = `${res}|${C.dark}|${Math.floor(S.tick / 30)}|${S.seed}|${S.groups.length}|${(S.states || []).map(s2 => s2.id + s2.members.length).join(',')}`;
  if (ok2 !== ownKey) { paintOwn(S, ownCv, res); ownKey = ok2; }
  if (S.own) ctx.drawImage(ownCv, 0, 0, 1000, 1000);
  const wheat = winter ? (C.dark ? '#4a3d2c' : '#c9b392') : season === 1 ? (C.dark ? '#3e5a2c' : '#b9d28b') : (C.dark ? '#8a7434' : '#ddbb5c');
  drawWater(ctx, S); drawNet(ctx, S); drawBoats(ctx, S); drawLife(ctx, S, now);
  for (const r of S.ruins || []) {
    const fade = Math.max(.15, 1 - (S.tick - r.t) / (360 * 40));
    ctx.globalAlpha = .55 * fade;
    for (const f of r.fields) fieldGlyph(f, rgba(C.muted, .35), null, true, px);
    for (const hh of r.houses) houseGlyph(hh.x, hh.y, 12, rgba(C.muted, .5), rgba(C.muted, .8), false, px);
    ctx.globalAlpha = 1;
  }
  for (const g of S.groups) {
    if (!g.home) continue;
    const dim = fgs && !fgs.has(g.id) ? .45 : 1;
    ctx.globalAlpha = dim;
    for (const f of g.fields) fieldGlyph(f, wheat, hueC(g.hue, .8), winter, px);
    if (g.site && g.site.kind === 'field') { ctx.setLineDash([px(3), px(2)]); ctx.strokeStyle = hueC(g.hue, .9); ctx.lineWidth = px(1.2); ctx.strokeRect(g.site.x - 9, g.site.y - 7, 18, 14); ctx.setLineDash([]); }
    ctx.globalAlpha = 1;
  }
  drawCampfires(px);
  const bush = C.dark ? '#2f5a3c' : '#6f9a5c', berry = C.dark ? '#e0607a' : '#c8264a';
  for (const n of S.nodes) {
    const full = n.amt / n.cap;
    if (n.kind === 'fish') {
      ctx.setLineDash([px(3), px(3)]); ctx.strokeStyle = rgba(C.ink, .3); ctx.lineWidth = px(1); ctx.beginPath(); ctx.arc(n.x, n.y, 26, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      const nf = 1 + Math.round(full * 4);
      for (let i = 0; i < nf; i++) { const a = i * 1.3 + n.id + now / 2600, fx = n.x + Math.cos(a) * 15, fy = n.y + Math.sin(a) * 11; ctx.fillStyle = C.dark ? '#9cc8e4' : '#4a7fa8'; ctx.beginPath(); ctx.ellipse(fx, fy, 5, 2.4, a + 1.57, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(fx + Math.cos(a + 1.57) * 5, fy + Math.sin(a + 1.57) * 5); ctx.lineTo(fx + Math.cos(a + 1.3) * 8, fy + Math.sin(a + 1.3) * 8); ctx.lineTo(fx + Math.cos(a + 1.84) * 8, fy + Math.sin(a + 1.84) * 8); ctx.fill(); }
      continue;
    }
    ctx.setLineDash([px(3), px(3)]); ctx.strokeStyle = rgba(C.ink, .35); ctx.lineWidth = px(1);
    ctx.beginPath(); ctx.arc(n.x, n.y, 26, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 7; i++) {
      const a = i * 0.8976 + n.id, r = i === 0 ? 0 : 14, bx = n.x + Math.cos(a) * r, by = n.y + Math.sin(a) * r;
      ctx.fillStyle = bush; ctx.beginPath(); ctx.arc(bx, by, 6, 0, 7); ctx.fill();
      const nb = Math.round(full * 4);
      ctx.fillStyle = berry;
      for (let b = 0; b < nb; b++) { const ba = b * 1.7 + i; ctx.beginPath(); ctx.arc(bx + Math.cos(ba) * 3, by + Math.sin(ba) * 3, 1.6, 0, 7); ctx.fill(); }
    }
  }
  const cen = new Map();
  for (const g of S.groups) {
    let sx = 0, sy = 0; const ps = g.members.map(id => D.get(id)).filter(Boolean);
    if (!ps.length) continue;
    for (const p of ps) { sx += p.x; sy += p.y; }
    let cx = sx / ps.length, cy = sy / ps.length;
    let md = 0;
    if (g.home) { cx = g.home.x; cy = g.home.y; for (const o of g.houses.concat(g.fields, [g.workshop, g.granary].filter(Boolean))) md = Math.max(md, Math.hypot(o.x - cx, o.y - cy) + 8); md = Math.max(md, 14); }
    else for (const p of ps) md = Math.max(md, Math.hypot(p.x - cx, p.y - cy));
    cen.set(g.id, { x: cx, y: cy });
    if (g.home && S.own) continue;
    const R = Math.min(md, 260) + 16, amp = .04 + .11 * Math.min(g.entropy, 2.5), dim = fgs && !fgs.has(g.id) ? .35 : 1;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const th = i / 40 * Math.PI * 2;
      const nz = Math.sin(th * 3 + t * .0011 + g.id) * .5 + Math.sin(th * 7 - t * .0019 + g.id * 2) * .33 + Math.sin(th * 13 + t * .0037 + g.id) * .17;
      const r = R * (1 + amp * nz), x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fillStyle = hueC(g.hue, (C.dark ? .1 : .09) * dim); ctx.fill();
    ctx.strokeStyle = hueC(g.hue, .55 * dim); ctx.lineWidth = px(fgs && fgs.has(g.id) ? 2 : 1); ctx.stroke();
  }
  for (const g of S.groups) {
    if (!g.home) continue;
    ctx.globalAlpha = fgs && !fgs.has(g.id) ? .45 : 1;
    const fill = hueC(g.hue, 1, C.dark ? -6 : 12), roof = hueC(g.hue, 1, C.dark ? -22 : -14);
    if (g.stoneCell !== null && g.stoneCell !== undefined && (g.workshop || g.stone > 0.5)) quarryGlyph((g.stoneCell % 50) * 20 + 10, Math.floor(g.stoneCell / 50) * 20 + 10, px);
    for (const hh of g.houses) if (hh.ruined) { const ga = ctx.globalAlpha; ctx.globalAlpha = .5 * ga; houseGlyph(hh.x, hh.y, 12, rgba(C.muted, .5), rgba(C.muted, .8), true, px); ctx.globalAlpha = ga; } else houseGlyph(hh.x, hh.y, 13, hh.earth ? '#a7926e' : fill, roof, false, px);
    if (g.granary) granaryGlyph(g.granary.x, g.granary.y, fill, roof, false, px);
    if (g.shrine) { const f = S.faiths && S.faiths[g.faith], fc = f ? hueC(f.hue, 1, -4) : roof, x0 = g.shrine.x, y0 = g.shrine.y; ctx.fillStyle = fc; ctx.beginPath(); ctx.moveTo(x0 - 7, y0 + 5); ctx.lineTo(x0 + 7, y0 + 5); ctx.lineTo(x0 + 4, y0 - 1); ctx.lineTo(x0 + 2, y0 - 1); ctx.lineTo(x0, y0 - 9); ctx.lineTo(x0 - 2, y0 - 1); ctx.lineTo(x0 - 4, y0 - 1); ctx.closePath(); ctx.fill(); }
    if (g.workshop) workshopGlyph(g.workshop.x, g.workshop.y, fill, roof, false, g.members.some(id => { const m = S._a.get(id); return m && m.job === 'craft'; }), px, now);
    ctx.globalAlpha = 1;
  }
  for (const g of S.groups) {
    if (!g.home) continue;
    drawWall(g, px);
    drawBuildingSite(g.site, px);
    const lord = g.lord && S._g.get(g.lord);
    if (lord && lord.home) {
      ctx.strokeStyle = hueC(lord.hue, .9); ctx.lineWidth = px(2); ctx.setLineDash([px(1), px(4)]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(g.home.x, g.home.y); ctx.lineTo(lord.home.x, lord.home.y); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt';
      ctx.strokeStyle = hueC(lord.hue, .8); ctx.lineWidth = px(2.5); ctx.beginPath(); ctx.arc(g.home.x, g.home.y, 12, 0, 7); ctx.stroke();
    }
  }
  for (const w of S.wars || []) {
    const A = S._g.get(w.att), B = S._g.get(w.def); if (!A || !B || !A.home || !B.home) continue;
    const from = w.phase === 'march' ? A.home : B.home, to = w.phase === 'march' ? B.home : A.home;
    const col = w.phase === 'march' ? rgba(C.red, .85) : rgba(C.muted, .7);
    ctx.strokeStyle = col; ctx.lineWidth = px(2.2); ctx.setLineDash([px(7), px(5)]);
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); ctx.setLineDash([]);
    const ang = Math.atan2(to.y - from.y, to.x - from.x), hx = to.x - Math.cos(ang) * 18, hy = to.y - Math.sin(ang) * 18;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(hx + Math.cos(ang) * 9, hy + Math.sin(ang) * 9); ctx.lineTo(hx + Math.cos(ang + 2.5) * 9, hy + Math.sin(ang + 2.5) * 9); ctx.lineTo(hx + Math.cos(ang - 2.5) * 9, hy + Math.sin(ang - 2.5) * 9); ctx.closePath(); ctx.fill();
  }
  for (const al of S.alliances) {
    const a = cen.get(al.a), b = cen.get(al.b); if (!a || !b) continue;
    ctx.setLineDash([px(5), px(4)]); ctx.strokeStyle = C.slate; ctx.lineWidth = px(1.5);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const key in S.hostility) {
    const h = S.hostility[key]; if (h < .45) continue;
    const [p, q] = key.split('|'), a = cen.get(+p), b = cen.get(+q); if (!a || !b) continue;
    ctx.strokeStyle = rgba(C.red, Math.min(.75, h * .45)); ctx.lineWidth = px(.8 + h);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.lineWidth = px(1);
  for (const g of S.groups) if (g.sick > 0 && g.home) { const pr = 0.5 + 0.5 * Math.sin(now / 400); ctx.beginPath(); ctx.arc(g.home.x, g.home.y, 50 + pr * 8, 0, 7); ctx.fillStyle = C.dark ? `rgba(150,175,120,${0.16 + pr * 0.08})` : `rgba(60,80,40,${0.14 + pr * 0.08})`; ctx.fill(); ctx.font = `600 ${px(12)}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = C.dark ? '#c8d8b0' : '#3c5028'; ctx.fillText('мор', g.home.x, g.home.y - 62); }
  for (const a of people) {
    if (!a.group || !a.boss) continue;
    const b = D.get(a.boss), d = D.get(a.id), g = S._g.get(a.group); if (!b || !d || !g) continue;
    ctx.strokeStyle = hueC(g.hue, fgs && !fgs.has(g.id) ? .1 : g.home ? .16 : .45); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(d.x, d.y); ctx.stroke();
  }
  const base = Math.max(2, Math.min(3.4, Math.min(plate.clientWidth, plate.clientHeight) / 220)) * Math.sqrt(view.z);
  // burial grounds: rows of small stones, one per grave (up to 24); a gathering ring where a rite is going on
  for (const g of S.groups) {
    const c = g.home && g.cemetery; if (!c || !c.graves) continue;
    const k = Math.min(24, c.graves), cols = 6;
    ctx.fillStyle = C.dark ? 'rgba(190,195,205,.75)' : 'rgba(110,115,125,.75)';
    for (let i = 0; i < k; i++) { const x = c.x - 9 + (i % cols) * 3.6, y = c.y - 5 + Math.floor(i / cols) * 3.6; ctx.fillRect(x - px(.9), y - px(1.3), px(1.8), px(2.6)); }
    ctx.strokeStyle = C.dark ? 'rgba(190,195,205,.35)' : 'rgba(110,115,125,.35)'; ctx.lineWidth = px(1); ctx.strokeRect(c.x - 12, c.y - 8, 24, 16);
  }
  // К1: monuments — a mound, a mass grave, a stone
  for (const p of S.places || []) {
    if (!p.mon) continue;
    ctx.fillStyle = C.dark ? 'rgba(200,190,160,.8)' : 'rgba(120,105,70,.8)'; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = px(1.2);
    if (p.mon === 'mound') { ctx.beginPath(); ctx.ellipse(p.x, p.y, 7, 4.5, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); }
    else if (p.mon === 'massgrave') { ctx.strokeRect(p.x - 6, p.y - 4, 12, 8); ctx.beginPath(); ctx.moveTo(p.x, p.y - 3); ctx.lineTo(p.x, p.y + 3); ctx.moveTo(p.x - 2.5, p.y - 1); ctx.lineTo(p.x + 2.5, p.y - 1); ctx.stroke(); }
    else { ctx.fillRect(p.x - px(1.6), p.y - px(3.4), px(3.2), px(6)); }
  }
  for (const r of S.rites || []) {
    if (S.tick >= r.until) continue;
    const col = r.kind === 'funeral' ? (C.dark ? 'rgba(200,205,215,.55)' : 'rgba(80,85,95,.5)') : (C.dark ? 'rgba(240,200,110,.6)' : 'rgba(200,140,40,.55)');
    ctx.strokeStyle = col; ctx.lineWidth = px(1.6); ctx.setLineDash([px(3), px(3)]); ctx.beginPath(); ctx.arc(r.x, r.y, r.kind === 'feast' ? 26 : 12, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
  // small children play by their parents' house
  for (const k of !detailed || dailyNight > 0.85 ? [] : S.kids || []) {
    const c = S._a.get(k.mo) || S._a.get(k.fa), g = c && c.group && S._g.get(c.group);
    const h = g && g.home && c.house && g.houses.find(x => x.id === c.house); if (!h) continue;
    const s = (k.t * 7 + (k.mo || 0)) % 17, ox = (s % 9) - 4, oy = 7 + (s % 4);
    ctx.globalAlpha = who ? .3 : .9; ctx.fillStyle = hueC(g.hue, 1, 12);
    ctx.beginPath(); ctx.arc(h.x + ox, h.y + oy, px(base * .55), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const selA = detailed && sel && S._a.get(sel);
  if (selA) {
    const d = D.get(selA.id), rel = Object.entries(selA.trust).filter(([id]) => D.has(+id)).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, 8);
    for (const [id, v] of rel) { const o = D.get(+id); ctx.strokeStyle = v > 0 ? rgba(C.slate, .35 + v * .5) : rgba(C.red, .35 - v * .5); ctx.lineWidth = px(1 + Math.abs(v) * 2); ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(o.x, o.y); ctx.stroke(); }
  }
  for (const a of people) {
    const d = D.get(a.id), g = a.group && S._g.get(a.group), r = px(base * (1 + 1.3 * a.status / (a.status + 10)));
    ctx.globalAlpha = who && !who.has(a.id) ? .3 : 1;
    ctx.fillStyle = g ? hueC(g.hue, 1, (a.energy - .5) * 16) : rgba(C.muted, .85);
    ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 7); ctx.fill();
    if (a.res > .6) { ctx.strokeStyle = C.red; ctx.lineWidth = px(1); ctx.stroke(); }
    if (a.job === 'water' && a.wc) { ctx.fillStyle = C.dark ? '#6ab0e0' : '#3d86c6'; ctx.fillRect(d.x - px(2.5), d.y - r - px(6), px(5), px(4)); }
    if (a.load > 0.3) { ctx.fillStyle = a.lk === 'wood' ? (C.dark ? '#b07a45' : '#8a5a2b') : a.lk === 'stone' ? (C.dark ? '#a8adb5' : '#7d8590') : (C.dark ? '#d6b04e' : '#c79a2e'); ctx.fillRect(d.x - px(2.5), d.y - r - px(6), px(5), px(4)); }
    if (a.bond) { const q = r + px(2.2); ctx.strokeStyle = C.ink; ctx.lineWidth = px(1.2); ctx.strokeRect(d.x - q, d.y - q, q * 2, q * 2); }
    if (a.role === 'leader') { ctx.strokeStyle = C.ink; ctx.lineWidth = px(1.3); ctx.beginPath(); ctx.arc(d.x, d.y, r + px(2.6), 0, 7); ctx.stroke(); }
    if (who && who.has(a.id)) { const p = reduce ? .5 : (Math.sin(now / 260) + 1) / 2; ctx.strokeStyle = typeColor(focusEv.type, .9); ctx.lineWidth = px(2); ctx.beginPath(); ctx.arc(d.x, d.y, r + px(5 + 4 * p), 0, 7); ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
  for (const a of people) {
    if (!a.war && a.job !== 'guard') continue;
    const d = D.get(a.id); if (!d) continue;
    ctx.strokeStyle = a.war ? C.red : C.ink; ctx.lineWidth = px(1.4);
    ctx.beginPath(); ctx.moveTo(d.x + 3, d.y + 4); ctx.lineTo(d.x + 7, d.y - 7); ctx.stroke();
  }
  for (const w of detailed ? S.wars || [] : []) {
    const band = (w.fighters || []).map(id => D.get(id)).filter(Boolean), A = S._g.get(w.att); if (!band.length || !A) continue;
    let fx = 0, fy = 0; for (const p of band) { fx += p.x; fy += p.y; } fx /= band.length; fy /= band.length;
    ctx.strokeStyle = C.ink; ctx.lineWidth = px(1.5); ctx.beginPath(); ctx.moveTo(fx, fy - 4); ctx.lineTo(fx, fy - 26); ctx.stroke();
    ctx.fillStyle = hueC(A.hue, 1); ctx.beginPath(); ctx.moveTo(fx, fy - 26); ctx.lineTo(fx + 13, fy - 21.5); ctx.lineTo(fx, fy - 17); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.red; ctx.lineWidth = px(1); ctx.stroke();
  }
  const GC = { food: C.dark ? '#d6b04e' : '#c79a2e', wood: C.dark ? '#b07a45' : '#8a5a2b', stone: C.dark ? '#a8adb5' : '#7d8590', tools: C.slate };
  for (const a of people) {
    if (!a.car) continue;
    const d = D.get(a.id), g = S._g.get(a.group); if (!d || !g) continue;
    const cx = d.x + 7, cy = d.y + 2;
    ctx.fillStyle = hueC(g.hue, 1, C.dark ? -10 : -6); ctx.fillRect(cx - 6, cy - 4, 12, 7);
    ctx.fillStyle = GC[a.car.phase === 'go' ? a.car.x : a.car.y]; ctx.fillRect(cx - 4.5, cy - 6.5, 9, 3.5);
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(cx - 3.5, cy + 3.5, 1.8, 0, 7); ctx.arc(cx + 3.5, cy + 3.5, 1.8, 0, 7); ctx.fill();
  }
  if (selA) { const d = D.get(selA.id); ctx.strokeStyle = C.ink; ctx.lineWidth = px(2); ctx.beginPath(); ctx.arc(d.x, d.y, px(base * 4), 0, 7); ctx.stroke(); }
  for (const f of F) {
    const p = (now - f.born) / 1400;
    ctx.strokeStyle = typeColor(f.type, 1 - p, f.hue); ctx.lineWidth = px(2);
    ctx.beginPath(); ctx.arc(f.x, f.y, 8 + 44 * p + px(4), 0, 7); ctx.stroke();
  }
  // labels in screen space
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  let top = S.groups.slice().sort((a, b) => b.members.length - a.members.length).slice(0, plate.clientWidth < 500 && view.z < 1.3 ? 4 : 7);
  if (fgs) top = S.groups.filter(g => fgs.has(g.id)).concat(top.filter(g => !fgs.has(g.id)));
  ctx.font = `500 ${12 * dpr}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  const placed = [];
  const landing = firstLanding(S);
  if (landing) {
    const x = landing.x1 * k + ox, y = landing.y1 * k + oy - 13 * dpr;
    ctx.font = `600 ${13 * dpr}px Inter, system-ui, sans-serif`;
    const w = ctx.measureText(LANDING_LABEL).width;
    if (x > w / 2 && x < W - w / 2 && y > 20 * dpr && y < H) {
      ctx.strokeStyle = C.plate; ctx.lineWidth = 4 * dpr; ctx.strokeText(LANDING_LABEL, x, y);
      ctx.fillStyle = C.ink; ctx.fillText(LANDING_LABEL, x, y);
      placed.push({ x, y, w });
    }
  }
  if (now - (draw.scAt || 0) > 2000 || draw.scTick !== S.tick) { draw.sc = stateCenters(S); draw.scAt = now; draw.scTick = S.tick; }
  ctx.textAlign = 'center';
  for (const c of draw.sc || []) {
    const sx = c.x * k + ox, sy = c.y * k + oy + 30 * dpr; if (sx < 0 || sx > W || sy < 0 || sy > H) continue;
    ctx.font = `600 ${16 * dpr}px "Source Serif 4", Georgia, serif`;
    const tw = ctx.measureText(c.st.name).width;
    placed.push({ x: sx, y: sy, w: tw });
    ctx.strokeStyle = C.plate; ctx.lineWidth = 5 * dpr; ctx.strokeText(c.st.name, sx, sy);
    ctx.fillStyle = hueC(c.st.hue, 1, C.dark ? 10 : -22); ctx.fillText(c.st.name, sx, sy);
  }
  ctx.font = `500 ${12 * dpr}px Inter, system-ui, sans-serif`;
  for (const g of top) {
    const Lp = g.home ? { x: g.home.x, y: g.home.y - 14 } : D.get(g.leader); if (!Lp) continue;
    const sx = Lp.x * k + ox, sy0 = Lp.y * k + oy;
    if (sx < 0 || sx > W || sy0 < 0 || sy0 > H) continue;
    const rt = g.home && g.members.length >= 5 && RC.get(g.id) ? SHORT[RC.get(g.id).type] || '' : '';
    const tw = ctx.measureText(g.name).width, th = (rt ? 26 : 14) * dpr;
    let y = Math.max(14 * dpr, sy0 - (rt ? 22 : 10) * dpr), ok = false;
    for (let i = 0; i < 4 && !ok; i++) { ok = !placed.some(p => Math.abs(p.x - sx) < (p.w + tw) / 2 + 4 * dpr && Math.abs(p.y - y) < th); if (!ok) y -= 14 * dpr; }
    if (!ok) continue;
    placed.push({ x: sx, y, w: tw }); if (rt) placed.push({ x: sx, y: y + 13 * dpr, w: tw });
    ctx.strokeStyle = C.plate; ctx.lineWidth = 4 * dpr; ctx.strokeText(g.name, sx, y);
    ctx.fillStyle = C.ink; ctx.fillText(g.name, sx, y);
    if (g.cult && g.home) { ctx.fillStyle = SIM.COLOR_HEX[g.cult.color] || '#999'; ctx.fillRect(sx + tw / 2 + (g.coin ? 15 : 4) * dpr, y - 9 * dpr, 7 * dpr, 7 * dpr); } // К3: the village's colour (after the coin, if any)
    if (g.dynasty) { const cx = sx - tw / 2 - 9 * dpr, cy = y - 4 * dpr, q = dpr; ctx.fillStyle = C.dark ? '#e3c25a' : '#b8860b'; ctx.beginPath(); ctx.moveTo(cx - 5 * q, cy + 4 * q); ctx.lineTo(cx - 5 * q, cy - 3 * q); ctx.lineTo(cx - 2.5 * q, cy); ctx.lineTo(cx, cy - 4 * q); ctx.lineTo(cx + 2.5 * q, cy); ctx.lineTo(cx + 5 * q, cy - 3 * q); ctx.lineTo(cx + 5 * q, cy + 4 * q); ctx.closePath(); ctx.fill(); }
    if (g.coin) { const cx = sx + tw / 2 + 8 * dpr, cy = y - 4 * dpr; ctx.fillStyle = C.dark ? '#e3c25a' : '#c9a227'; ctx.beginPath(); ctx.arc(cx, cy, 4.5 * dpr, 0, 7); ctx.fill(); ctx.strokeStyle = C.dark ? '#8a6d1c' : '#8a6a10'; ctx.lineWidth = 1 * dpr; ctx.beginPath(); ctx.arc(cx, cy, 2.4 * dpr, 0, 7); ctx.stroke(); }
    if (rt) { ctx.font = `400 ${11.5 * dpr}px Inter, system-ui, sans-serif`; ctx.strokeText(rt, sx, y + 13 * dpr); ctx.fillStyle = C.muted; ctx.fillText(rt, sx, y + 13 * dpr); ctx.font = `500 ${12 * dpr}px Inter, system-ui, sans-serif`; }
  }
  // К1: names of places, in italics, when the map is close enough to read them
  ctx.font = `italic 400 ${11.5 * dpr}px "Source Serif 4", Georgia, serif`;
  for (const p of view.z >= 1.4 ? S.places || [] : []) {
    const sx = p.x * k + ox, sy = p.y * k + oy + 14 * dpr; if (sx < 0 || sx > W || sy < 0 || sy > H) continue;
    const tw = ctx.measureText(p.name).width;
    if (placed.some(q => Math.abs(q.x - sx) < (q.w + tw) / 2 + 4 * dpr && Math.abs(q.y - sy) < 14 * dpr)) continue;
    placed.push({ x: sx, y: sy, w: tw });
    ctx.strokeStyle = C.plate; ctx.lineWidth = 3.5 * dpr; ctx.strokeText(p.name, sx, sy);
    ctx.fillStyle = p.forgot ? C.muted : C.ink; ctx.fillText(p.name, sx, sy);
  }
  ctx.font = `400 ${11.5 * dpr}px Inter, system-ui, sans-serif`;
  for (const n of S.nodes) {
    const sx = n.x * k + ox, sy = (n.y + 26) * k + oy + 13 * dpr;
    if (sx < 0 || sx > W || sy > H) continue;
    const label = `${n.kind === 'fish' ? 'рыба' : 'угодья'} · ${Math.round(n.amt / n.cap * 100)}%`, tw = ctx.measureText(label).width;
    if (placed.some(p => Math.abs(p.x - sx) < (p.w + tw) / 2 + 4 * dpr && Math.abs(p.y - sy) < 14 * dpr)) continue;
    placed.push({ x: sx, y: sy, w: tw });
    ctx.strokeStyle = C.plate; ctx.lineWidth = 3.5 * dpr; ctx.strokeText(label, sx, sy);
    ctx.fillStyle = C.muted; ctx.fillText(label, sx, sy);
  }
}

