/* ---------- Settlement geometry shared by the simulation and both map views ---------- */
function siteLand(S, x, y) {
  if (x < 12 || x > 988 || y < 12 || y > 988) return false;
  const t = S.ter[cellAt(x, y)];
  return t !== 's' && t !== 'w' && t !== 'h';
}
function lineOnLand(S, a, b) {
  if (!siteLand(S, a.x, a.y) || !siteLand(S, b.x, b.y)) return false;
  const marks = [0, 1];
  for (const axis of ['x', 'y']) {
    const low = Math.min(a[axis], b[axis]), high = Math.max(a[axis], b[axis]);
    for (let p = (Math.floor(low / CS) + 1) * CS; p < high; p += CS) marks.push((p - a[axis]) / (b[axis] - a[axis]));
  }
  marks.sort((u, v) => u - v);
  for (let i = 1; i < marks.length; i++) {
    const t = (marks[i - 1] + marks[i]) / 2;
    if (!siteLand(S, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}
function alongStreet(g, along, across = 0) {
  const { ux, uy } = g.plan;
  return { x: g.home.x + along * ux - across * uy, y: g.home.y + along * uy + across * ux };
}
function streetFor(S, g) {
  const ends = [-1, 1].map(direction => {
    let last = 0;
    for (let n = 4; n <= 144; n += 4) {
      const p = alongStreet(g, n * direction);
      if (!lineOnLand(S, alongStreet(g, last * direction), p)) break;
      last = n;
    }
    return alongStreet(g, last * direction);
  });
  return { a: ends[0], b: ends[1], width: 6 };
}
function streetApproach(S, g) {
  const h = cellAt(g.home.x, g.home.y), ci = h % N, cj = Math.floor(h / N);
  let point = null, best = 0;
  for (let j = Math.max(0, cj - 7); j <= Math.min(N - 1, cj + 7); j++) {
    for (let i = Math.max(0, ci - 7); i <= Math.min(N - 1, ci + 7); i++) {
      const c = j * N + i, road = S.road[c], wear = S.wear[c];
      if (!road && wear < 80) continue;
      const x = i * CS + CS / 2, y = j * CS + CS / 2, d = Math.hypot(x - g.home.x, y - g.home.y);
      if (d < 28 || d > 144 || !siteLand(S, x, y)) continue;
      const score = (1 + 2 * road + Math.min(wear, 520) / 150) / (1 + d / 50);
      if (score <= best || !reach(S, g.home.x, g.home.y, x, y)) continue;
      best = score;
      point = { x, y };
    }
  }
  const destination = point || waterSrc(S, g);
  if (!destination) return null;
  const path = getPath(S, h, cellAt(destination.x, destination.y));
  if (!path || path.length < 2) return null;
  const first = path[Math.min(2, path.length - 1)];
  return {
    x: (first % N) * CS + CS / 2, y: Math.floor(first / N) * CS + CS / 2,
    toward: point ? 'тропе' : 'воде',
  };
}
function distanceToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const u = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - dx * u, p.y - a.y - dy * u);
}
function streetClear(g, p, width) {
  const street = g.plan?.street;
  return !street || distanceToSegment(p, street.a, street.b) >= street.width / 2 + width;
}
function lineCrossing(a, b, c, d) {
  const x = b.x - a.x, y = b.y - a.y, u = d.x - c.x, v = d.y - c.y;
  const den = x * v - y * u;
  if (Math.abs(den) < 1e-8) return null;
  const dx = c.x - a.x, dy = c.y - a.y;
  const t = (dx * v - dy * u) / den, q = (dx * y - dy * x) / den;
  return t > 0 && t < 1.000001 && q >= 0 && q <= 1 ? t : null;
}

function wallSite(S, g) {
  const existing = g.fortifications || [];
  if (existing.length && S.tick - existing[existing.length - 1].built < 360) return null;
  const candidates = S.groups.filter(o => o !== g && o.home && !allied(S, g.id, o.id) && dist(g.home, o.home) < 460)
    .map(o => ({ o, threat: S.wars.some(w => w.att === o.id && w.def === g.id) ? 2 : S.hostility[key(g.id, o.id)] || 0 }))
    .filter(({ threat }) => threat > 0.6)
    .sort((a, b) => b.threat - a.threat || dist(g.home, a.o.home) - dist(g.home, b.o.home));
  if (!candidates.length) return null;
  const street = planOf(S, g).street;
  const core = g.houses.filter(h => !h.ruined && dist(h, g.home) < 50);
  if (g.granary && dist(g.granary, g.home) < 65) core.push(g.granary);
  const buildings = g.houses.concat([g.well, g.granary, g.workshop, g.shrine].filter(Boolean));
  for (const { o } of candidates) {
    const d = dist(g.home, o.home), ux = (o.home.x - g.home.x) / d, uy = (o.home.y - g.home.y) / d;
    if (existing.some(w => w.facing && w.facing.x * ux + w.facing.y * uy > 0.7)) continue;
    const forward = p => (p.x - g.home.x) * ux + (p.y - g.home.y) * uy;
    const side = p => (p.y - g.home.y) * ux - (p.x - g.home.x) * uy;
    const beyond = Math.max(15, ...core.map(forward)) + 9;
    const center = core.length ? core.reduce((sum, p) => sum + side(p), 0) / core.length : 0;
    let best = null, bestScore = -Infinity;
    for (const extra of [0, 10, 20]) for (const offset of [0, -8, 8]) {
      for (const bend of [0, -8, 8]) for (const half of [20, 27]) {
        const point = (front, across) => ({ x: g.home.x + ux * front - uy * across, y: g.home.y + uy * front + ux * across });
        const a = point(beyond + extra - bend, center + offset - half);
        const b = point(beyond + extra + bend, center + offset + half);
        const length = dist(a, b);
        if (!lineOnLand(S, a, b)) continue;
        const at = t => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        const crossing = lineCrossing(a, b, street.a, street.b);
        const gap = 9 / length;
        if (crossing !== null && (crossing < gap || crossing > 1 - gap)) continue;
        const segments = crossing === null ? [{ a, b }] : [
          { a, b: at(crossing - gap / 2) }, { a: at(crossing + gap / 2), b },
        ];
        const gates = crossing === null ? [] : [{ ...at(crossing), width: 9, angle: Math.atan2(b.y - a.y, b.x - a.x) }];
        const work = gates[0] || at(0.5);
        if (!usable(S, cellAt(work.x, work.y), g) || !reach(S, g.home.x, g.home.y, work.x, work.y)) continue;
        if (buildings.some(p => distanceToSegment(p, a, b) < (p.footprint ? Math.hypot(p.footprint.width, p.footprint.depth) / 2 + 2 : 10))) continue;
        if (g.fields.some(p => distanceToSegment(p, a, b) < 13)) continue;
        if (g.cemetery && distanceToSegment(g.cemetery, a, b) < 14) continue;
        if (existing.some(w => w.segments.some(p => lineCrossing(a, b, p.a, p.b) !== null ||
          Math.min(distanceToSegment(p.a, a, b), distanceToSegment(p.b, a, b)) < 6))) continue;
        let hardGround = 0, roadConflict = false;
        for (const segment of segments) {
          const steps = Math.ceil(dist(segment.a, segment.b) / 4);
          for (let i = 0; i <= steps; i++) {
            const f = i / steps, p = { x: segment.a.x + (segment.b.x - segment.a.x) * f, y: segment.a.y + (segment.b.y - segment.a.y) * f };
            const cell = cellAt(p.x, p.y);
            if (!usable(S, cell, g) || (S.road[cell] && distanceToSegment(p, street.a, street.b) > 10)) roadConflict = true;
            if (S.ter[cell] === 'f') hardGround++;
          }
        }
        if (roadConflict) continue;
        const cover = core.filter(p => Math.abs(side(p) - center - offset) < half).length;
        const score = cover * 12 - extra * 0.5 - Math.abs(offset) * 0.3 - Math.abs(bend) * 0.2 - length * 0.14 - hardGround;
        if (score <= bestScore) continue;
        bestScore = score;
        const posts = segments.reduce((n, s) => n + Math.ceil(dist(s.a, s.b) / 1.55), 0);
        const layout = { segments, gates, facing: { x: ux, y: uy }, posts, height: 11, threatId: o.id, threatName: o.name };
        best = { kind: 'palisade', ...work, prog: 0, need: 22 + posts * 3, wood: Math.ceil(posts / 3) + (gates.length ? 2 : 0), layout };
      }
    }
    if (best) return best;
  }
  return null;
}

function wallCover(g, from) {
  if (!from || !g.home) return false;
  return g.fortifications?.some(wall => wall.segments.some(({ a, b }) => lineCrossing(g.home, from, a, b) !== null));
}

function wallCells(S) {
  if (S._wallCells && S._wallV === S.wallV) return S._wallCells;
  const cells = [];
  for (const g of S.groups) for (const wall of g.fortifications || []) for (const segment of wall.segments) {
    const { a, b } = segment;
    const x0 = (cellAt(Math.min(a.x, b.x) - 6, 0) % N), x1 = (cellAt(Math.max(a.x, b.x) + 6, 0) % N);
    const y0 = (cellAt(0, Math.min(a.y, b.y) - 6) / N) | 0, y1 = (cellAt(0, Math.max(a.y, b.y) + 6) / N) | 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) (cells[y * N + x] ||= []).push(segment);
  }
  S._wallV = S.wallV;
  return S._wallCells = cells;
}
