/* ---------- navigation: relief, river, fords, bridges, roads ---------- */
function navInit(S) {
  S.ford = {}; S.bridge = {}; S.wear = new Array(N * N).fill(0); S.road = new Array(N * N).fill(0); S.navV = 1; S.roadV = 0; S.frozen = false;
  for (const [lo, hi] of [[0.12, 0.3], [0.42, 0.58], [0.7, 0.88]]) {
    let best = -1, bw = 99;
    for (let t = 0; t < 12; t++) { const j = Math.floor((lo + (hi - lo) * rnd(S)) * N); let w = 0; for (let i = 0; i < N; i++) if (S.ter[j * N + i] === 'w') w++; if (w > 0 && w < bw) { bw = w; best = j; } }
    if (best >= 0) for (let i = 0; i < N; i++) if (S.ter[best * N + i] === 'w') S.ford[best * N + i] = 1;
  }
}
function passCost(S, c) {
  const t = S.ter[c];
  if (t === 's') return 0;
  if (t === 'w') { if (S.bridge[c]) return 0.9; if (S.frozen) return 2.4; if (S.ford[c]) return 3.6; return 0; }
  let k = t === 'h' ? 3 : t === 'f' ? 1.8 : t === 'b' ? 1.2 : 1;
  const r = S.road[c]; if (r === 2) k *= 0.5; else if (r === 1) k *= 0.72;
  return k;
}
function navigationCosts(S) {
  if (S._costs && S._costsVersion === S.navV) return S._costs;
  const costs = S._costs || (S._costs = new Float64Array(N * N));
  const drag = S._moveDrag || (S._moveDrag = new Float64Array(costs.length));
  for (let c = 0; c < costs.length; c++) {
    const cost = passCost(S, c);
    costs[c] = cost;
    drag[c] = Math.pow(Math.max(0.5, cost || 3), 0.4);
  }
  S._costsVersion = S.navV;
  return costs;
}
function aStar(S, c0, c1) {
  if (c0 === c1) return [c0];
  const costs = navigationCosts(S);
  if (!costs[c1] || !costs[c0] && S.ter[c0] === 'w' && !S.frozen && !S.ford[c0] && !S.bridge[c0]) { if (!costs[c1]) return null; }
  const NN = N * N, gS = S._gS || (S._gS = new Float64Array(NN)), from = S._from || (S._from = new Int32Array(NN)), seen = S._seen || (S._seen = new Int32Array(NN));
  S._stamp = (S._stamp || 0) + 1; const stamp = S._stamp;
  const tx = c1 % N, ty = (c1 / N) | 0, h = c => { const dx = Math.abs(c % N - tx), dy = Math.abs(((c / N) | 0) - ty); return (Math.max(dx, dy) + 0.414 * Math.min(dx, dy)) * 0.5; };
  const heap = [], hf = [];
  const push = (cell, priority) => {
    let i = heap.length;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (hf[parent] <= priority) break;
      heap[i] = heap[parent];
      hf[i] = hf[parent];
      i = parent;
    }
    heap[i] = cell;
    hf[i] = priority;
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop(), priority = hf.pop();
    const size = heap.length;
    if (!size) return top;
    let i = 0;
    for (let child = 2 * i + 1; child < size; child = 2 * i + 1) {
      const right = child + 1;
      if (right < size && hf[right] < hf[child]) child = right;
      if (hf[child] >= priority) break;
      heap[i] = heap[child];
      hf[i] = hf[child];
      i = child;
    }
    heap[i] = last;
    hf[i] = priority;
    return top;
  };
  seen[c0] = stamp; gS[c0] = 0; from[c0] = -1; push(c0, h(c0));
  const closed = S._closed || (S._closed = new Int32Array(NN));
  let it = 0;
  while (heap.length && it++ < 6000) {
    const c = pop(); if (closed[c] === stamp) continue; closed[c] = stamp;
    if (c === c1) { const out = []; for (let q = c; q !== -1; q = from[q]) out.push(q); return out.reverse(); }
    const cx = c % N, cy = (c / N) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const nc = ny * N + nx, k = costs[nc]; if (!k) continue;
      if (dx && dy && (!costs[cy * N + nx] || !costs[ny * N + cx])) continue;
      const ng = gS[c] + k * (dx && dy ? 1.414 : 1);
      if (seen[nc] !== stamp || ng < gS[nc]) { seen[nc] = stamp; gS[nc] = ng; from[nc] = c; push(nc, ng + h(nc)); }
    }
  }
  return null;
}
function getPath(S, c0, c1) {
  if (!S._pc || S._pcv !== S.navV) { S._pc = new Map(); S._pcv = S.navV; }
  const k = c0 * 2500 + c1;
  if (S._pc.has(k)) return S._pc.get(k);
  const C = comps(S); if (!C[c1] || (C[c0] && C[c0] !== C[c1])) { S._pc.set(k, null); return null; }
  const p = aStar(S, c0, c1);
  if (S._pc.size > 6000) S._pc.clear();
  S._pc.set(k, p);
  return p;
}
function comps(S) {
  const key = S.navV + '|' + (S.frozen ? 1 : 0);
  if (S._comp && S._compK === key) return S._comp;
  const C = S._comp || (S._comp = new Int32Array(N * N)); C.fill(0); let id = 0; const st = [];
  for (let c0 = 0; c0 < N * N; c0++) {
    if (C[c0] || !passCost(S, c0)) continue; id++; C[c0] = id; st.push(c0);
    while (st.length) { const c = st.pop(), cx = c % N, cy = (c / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; const q = ny * N + nx; if (!C[q] && passCost(S, q)) { C[q] = id; st.push(q); } } }
  }
  S._compK = key; return C;
}
function reach(S, x0, y0, x1, y1) { const C = comps(S), a = C[cellAt(x0, y0)], b = C[cellAt(x1, y1)]; return !!a && a === b; }
function blocked(S, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 9);
  for (let i = 1; i <= n; i++) { const c = cellAt(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n), t = S.ter[c]; if (t === 'h' || t === 's' || (t === 'w' && !S.bridge[c])) return true; }
  return false;
}
function drown(S, a) {
  if (!S._a.has(a.id)) return;
  const g = a.group && S._g.get(a.group), ice = S.frozen, spring = seasonOf(S.tick) === 1;
  if (g) g.drowned = (g.drowned || 0) + 1;
  S.stats.drowned = (S.stats.drowned || 0) + 1;
  const first = !S.firstDrown, yr = Math.floor(S.tick / 360);
  if (first || (S.drownLog || 0) < yr - 3) {
    S.firstDrown = true; S.drownLog = yr;
    log(S, 'drown', `${a.name}${g ? ` из «${g.name}»` : ''} тонет, переходя реку ${ice ? 'по тонкому льду' : 'вброд'}`, a.x, a.y, g ? g.hue : 200, { first, why: sent([ice ? 'зимой река замерзает, но у берегов лёд тонок' : spring ? 'весной река разливается, и брод становится опасным' : 'моста здесь нет, поэтому реку переходят вброд', `всего утонуло: ${S.stats.drowned}`, g && !g.bridgeAt ? 'деревня задумается о мосте, если люди будут часто ходить на тот берег' : '']), who: [a.id], gs: g ? [g.id] : [] });
  }
  removeAgent(S, a, 'drown');
}
function toLand(S, a) {
  const c0 = cellAt(a.x, a.y); if (passCost(S, c0) && S.ter[c0] !== 'w') return;
  const ci = c0 % N, cj = (c0 / N) | 0;
  for (let r = 1; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = ci + dx, y = cj + dy; if (x < 0 || y < 0 || x >= N || y >= N) continue;
    const q = y * N + x, t = S.ter[q]; if (t === 's' || t === 'w' || t === 'h') continue;
    a.x = x * CS + 10 + gauss(S) * 3; a.y = y * CS + 10 + gauss(S) * 3; a.path = null; return;
  }
}
function navStep(S, a, ca, ct) {
  if (a.pc !== ct || a.pv !== S.navV || !a.path) { a.path = getPath(S, ca, ct); a.pc = ct; a.pv = S.navV; a.pi = 0; }
  const P = a.path; if (!P) return null;
  for (let k = a.pi; k < Math.min(P.length, a.pi + 6); k++) if (P[k] === ca) { a.pi = k; break; }
  if (P[a.pi] !== ca && !P.includes(ca)) { a.path = getPath(S, ca, ct); a.pi = 0; if (!a.path) return null; }
  const nx = a.path[Math.min(a.pi + 1, a.path.length - 1)], j = ((a.id * 13) % 7) - 3;
  return { x: (nx % N) * CS + 10 + j, y: ((nx / N) | 0) * CS + 10 + j };
}
function roadsYear(S) {
  let ch = 0;
  for (let c = 0; c < N * N; c++) {
    const w = S.wear[c], r0 = S.road[c];
    let r = w > 520 || (r0 === 2 && w > 300) ? 2 : w > 150 || (r0 >= 1 && w > 80) ? 1 : 0;
    if (S.ter[c] === 'w' && !S.bridge[c]) r = 0;
    if (r !== r0) { S.road[c] = r; ch++; }
    S.wear[c] = w * 0.35;
  }
  if (ch) { S.roadV++; S.navV++; }
}
function bridgeSpot(S, g) {
  let best = null, bv = -1e9;
  for (let j = 0; j < N; j++) {
    const ws = []; for (let i = 0; i < N; i++) if (S.ter[j * N + i] === 'w') ws.push(j * N + i);
    if (!ws.length || ws.some(c => S.bridge[c])) continue;
    if (S.groups.some(o => o !== g && o.site?.kind === 'bridge' && o.site.cells.some(c => ws.includes(c)))) continue;
    const y = j * CS + 10, x = (ws[0] % N) * CS + 10, d = Math.hypot(x - g.home.x, y - g.home.y);
    if (d > 320) continue;
    let near = false; for (const c in S.bridge) if (Math.abs(((+c / N) | 0) - j) < 6) near = true;
    if (near) continue;
    const lo = ws[0] - 1, hi = ws[ws.length - 1] + 1;
    if (Math.floor(lo / N) !== j || Math.floor(hi / N) !== j || hi - lo !== ws.length + 1) continue;
    const bank = c => ({ x: (c % N) * CS + CS / 2, y });
    const approaches = [bank(lo), bank(hi)];
    if (approaches.some(p => !siteLand(S, p.x, p.y))) continue;
    if (![lo, hi].every(c => [c - N, c + N, c === lo ? c - 1 : c + 1].some(q =>
      q >= 0 && q < N * N && siteLand(S, (q % N) * CS + CS / 2, Math.floor(q / N) * CS + CS / 2)
    ))) continue;
    const here = g.home.x < x ? approaches[0] : approaches[1];
    if (!reach(S, g.home.x, g.home.y, here.x, here.y)) continue;
    const traffic = Math.min(S.wear[lo], S.wear[hi], 450) / 12;
    const ford = ws.some(c => S.ford[c]) ? 42 : 0;
    const v = -ws.length * 60 - d / 4 + (S.road[lo] + S.road[hi]) * 20 + ford + traffic;
    if (v > bv) { bv = v; best = { kind: 'bridge', cells: ws, approaches, ...here, prog: 0, need: 120 + ws.length * 40, wood: 8 + ws.length * 4 }; }
  }
  return best;
}
function planOf(S, g) {
  if (g.plan) { if (!g.plan.street) g.plan.street = streetFor(S, g); return g.plan; }
  let ang;
  if (riverDist(S, g.home.x, g.home.y) < 220) ang = Math.PI / 2 + gauss(S) * 0.25;
  else { const fc = nearestForest(S, g.home, g); ang = fc !== null ? Math.atan2(Math.floor(fc / N) * CS + 10 - g.home.y, (fc % N) * CS + 10 - g.home.x) : rnd(S) * Math.PI; }
  const approach = streetApproach(S, g);
  if (approach) ang = Math.atan2(approach.y - g.home.y, approach.x - g.home.x);
  g.plan = { ux: Math.cos(ang), uy: Math.sin(ang), k: 0, toward: approach?.toward };
  g.plan.street = streetFor(S, g);
  return g.plan;
}
function plotPos(g, k) {
  const street = g.plan.street;
  const side = k % 2 ? -1 : 1, row = (k >> 1) % 2 ? -1 : 1, slot = (k >> 2) + 1;
  const variation = ((g.id * 17 + k * 31) % 11) - 5;
  const frontage = alongStreet(g, row * (slot * 18 - 7) + variation);
  if (distanceToSegment(frontage, street.a, street.b) > 1) return null;
  const setback = 13 + ((g.id + k * 3) % 6);
  const angle = Math.atan2(g.plan.uy, g.plan.ux);
  const at = alongStreet(g, row * (slot * 18 - 7) + variation, side * setback);
  const entrance = { x: at.x + side * g.plan.uy * 5, y: at.y - side * g.plan.ux * 5 };
  return { ...at, angle, entrance, frontage };
}
function plotOk(S, g, p, radius = 6) {
  if (riverDist(S, p.x, p.y) < 24 || !streetClear(g, p, radius)) return false;
  for (const [dx, dy] of [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const x = p.x + dx * radius, y = p.y + dy * radius;
    if (!siteLand(S, x, y) || S.occ[cellAt(x, y)]) return false;
  }
  if (!reach(S, g.home.x, g.home.y, p.x, p.y)) return false;
  for (const h of g.houses) if (dist(h, p) < radius + 5) return false;
  for (const b of [g.workshop, g.granary, g.shrine, g.well]) if (b && dist(b, p) < radius + 8) return false;
  return !g.fortifications?.some(w => w.segments.some(({ a, b }) => distanceToSegment(p, a, b) < radius + 2));
}

function riverDist(S, x, y) { const r = S.river; if (!r) return 1e9; const k = clamp(Math.round((y + 20) / 20), 0, r.length - 1); return Math.abs(x - r[k][0]); }
function dryRing(S, cx, cy, a0, r) {
  for (let t = 0; t < 12; t++) { const a = a0 + t * 0.52, x = clamp(cx + Math.cos(a) * r, 10, 990), y = clamp(cy + Math.sin(a) * r, 10, 990); if (riverDist(S, x, y) > 24 && S.ter[cellAt(x, y)] !== 's') return { x, y }; }
  return { x: clamp(cx + Math.cos(a0) * r, 10, 990), y: clamp(cy + Math.sin(a0) * r, 10, 990) };
}
function usable(S, c, g) { const o = S.own && S.own[c]; return !o || !g || o === g.id || allied(S, o, g.id) || g.lord === o; }
function nearestForest(S, p, g) {
  let best = null, bd = 1e9;
  for (let c = 0; c < S.wood.length; c++) { if (S.ter[c] !== 'f' || S.wood[c] < 8 || !usable(S, c, g)) continue; const d = Math.hypot((c % N) * CS + 10 - p.x, Math.floor(c / N) * CS + 10 - p.y); if (d < bd) { bd = d; best = c; } }
  return bd < 420 ? best : null;
}
