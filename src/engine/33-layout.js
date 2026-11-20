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
function wallPlan(S, g) {
  planOf(S, g);
  const point = (x, y) => alongStreet(g, x, y);
  const buildings = g.houses.filter(h => !h.ruined);
  buildings.sort((a, b) => dist(a, g.home) - dist(b, g.home));
  if (g.granary) buildings.unshift(g.granary);
  const occupied = buildings.concat([g.well, g.shrine, g.workshop].filter(Boolean));
  // Draw one fixed perimeter around the occupied core, with gates where the street crosses it.
  for (let count = Math.min(8, buildings.length); count >= Math.min(2, buildings.length); count--) {
    let left = -17, right = 17, lower = -17, upper = 17;
    for (const b of buildings.slice(0, count)) {
      const dx = b.x - g.home.x, dy = b.y - g.home.y;
      const along = dx * g.plan.ux + dy * g.plan.uy, across = -dx * g.plan.uy + dy * g.plan.ux;
      left = Math.min(left, along - 9); right = Math.max(right, along + 9);
      lower = Math.min(lower, across - 9); upper = Math.max(upper, across + 9);
    }
    const points = [point(left, lower), point(right, lower), point(right, upper), point(left, upper)];
    const edges = points.map((a, i) => ({ a, b: points[(i + 1) % points.length] }));
    if (!edges.every(({ a, b }) => lineOnLand(S, a, b))) continue;
    if (occupied.some(p => edges.some(({ a, b }) => distanceToSegment(p, a, b) < 7))) continue;
    const street = g.plan.street;
    const segments = [edges[0], edges[2]], gates = [];
    for (const along of [left, right]) {
      const at = point(along, 0);
      if (distanceToSegment(at, street.a, street.b) < 1) {
        gates.push({ ...at, width: 9 });
        segments.push({ a: point(along, lower), b: point(along, -4.5) }, { a: point(along, 4.5), b: point(along, upper) });
      } else segments.push({ a: point(along, lower), b: point(along, upper) });
    }
    if (!gates.length) continue;
    return { points, segments, gates, bounds: { left, right, lower, upper }, length: segments.reduce((n, { a, b }) => n + dist(a, b), 0) };
  }
  return null;
}
function insideWall(g, wall, point) {
  const dx = point.x - g.home.x, dy = point.y - g.home.y;
  const x = dx * g.plan.ux + dy * g.plan.uy, y = -dx * g.plan.uy + dy * g.plan.ux;
  const { left, right, lower, upper } = wall.bounds;
  return x > left && x < right && y > lower && y < upper;
}
function wallSite(S, g) {
  const prior = g.wallPlan;
  const outside = prior ? g.houses.filter(h => !h.ruined && !insideWall(g, prior, h)) : [];
  if (g.walls && (!prior || outside.length < 3 || S.tick - prior.built < 360 * 6)) return null;
  const layout = wallPlan(S, g);
  if (!layout) return null;
  if (prior && (layout.length <= prior.length || outside.filter(h => insideWall(g, layout, h)).length < 3)) return null;
  return { kind: 'walls', ...g.home, prog: 0, need: Math.max(90, Math.round(layout.length * 0.5)),
    wood: Math.max(8, Math.ceil(layout.length * 0.07)), layout };
}
