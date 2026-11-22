/* ---------- time and movement within a simulated day ---------- */
const DAY_MINUTES = 24 * 60;
const CELL_METRES = 240;
const METRES_PER_UNIT = CELL_METRES / CS;
const WALK_SPEED = 4000 / 60 / METRES_PER_UNIT;
const LOAD_SPEED = 3000 / 60 / METRES_PER_UNIT;
const LONG_WALK = 24000 / METRES_PER_UNIT;
const CAMP_WALK = WALK_SPEED * 25;
const RETURN_LOAD = new Set(['farm', 'gather', 'wood', 'stone', 'water', 'fish']);
const boatMinutes = (a, b) => Math.ceil(moveDistance(b.x - a.x, b.y - a.y) * METRES_PER_UNIT / (5500 / 60));

function daylightHours(tick) {
  const halfDay = 6 - 2 * Math.cos((tick % 360 - 45) * Math.PI / 180);
  return { sunrise: 12 - halfDay, sunset: 12 + halfDay };
}

// The committed world is the one at the start of the displayed day. An
// observed day can be calculated ahead from that same world, including its RNG.
function prepareDay(S) {
  const end = restore(serialize(S)), plans = new Map();
  step(end, plans);
  return { end, plans };
}

function advanceMinutes(S, elapsed) {
  if (!Number.isSafeInteger(elapsed) || elapsed < 0) throw new RangeError('Expected nonnegative whole minutes');
  const total = S.minute + elapsed;
  for (let days = Math.floor(total / DAY_MINUTES); days > 0; days--) step(S);
  S.minute = total % DAY_MINUTES;
}

function eventTime(ev) {
  // An untimed event belongs to the midnight at which its day's outcome commits.
  return Number.isInteger(ev.minute) && ev.minute >= 0 && ev.minute < DAY_MINUTES
    ? Math.max(0, ev.t - 1) * DAY_MINUTES + ev.minute
    : ev.t * DAY_MINUTES;
}

function wallBetween(walls, a, b) {
  const from = cellAt(a.x, a.y), to = cellAt(b.x, b.y);
  const cuts = segment => lineCrossing(a, b, segment.a, segment.b) !== null;
  if (walls[from]?.some(cuts) || (from !== to && walls[to]?.some(cuts))) return true;
  const x = to % N - from % N, y = Math.floor(to / N) - Math.floor(from / N);
  return !!(x && y && (walls[from + x]?.some(cuts) || walls[to - x]?.some(cuts)));
}

function cellCenter(c) {
  return { x: (c % N + 0.5) * CS, y: (Math.floor(c / N) + 0.5) * CS };
}

function walkingRoute(S, a, x0, y0, x1, y1) {
  const saved = a._walkRoute;
  if (saved && saved.nav === S.navV && saved.wall === S.wallV &&
      saved.x0 === x0 && saved.y0 === y0 && saved.x1 === x1 && saved.y1 === y1) return saved.route;

  const c0 = cellAt(x0, y0), c1 = cellAt(x1, y1);
  const cells = getPath(S, c0, c1);
  let route = null;
  if (cells && navigationCosts(S)[c0]) {
    const start = { x: x0, y: y0 }, end = { x: x1, y: y1 };
    const points = [start, ...cells.slice(1, -1).map(cellCenter), end];
    const walls = wallCells(S);
    let length = 0;
    const distances = [0];
    for (let i = 1; i < points.length; i++) {
      if (walls.length && wallBetween(walls, points[i - 1], points[i])) {
        length = -1;
        break;
      }
      length += moveDistance(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      distances.push(length);
    }
    if (length >= 0) route = { points, distances, length };
  }
  a._walkRoute = { nav: S.navV, wall: S.wallV, x0, y0, x1, y1, route };
  return route;
}

function positionOnRoute(route, distance, position) {
  const { points, distances, length } = route;
  if (distance <= 0) {
    position.x = points[0].x;
    position.y = points[0].y;
    return;
  }
  if (distance >= length) {
    position.x = points[points.length - 1].x;
    position.y = points[points.length - 1].y;
    return;
  }
  let i = 1;
  while (distances[i] < distance) i++;
  const f = (distance - distances[i - 1]) / (distances[i] - distances[i - 1]);
  position.x = points[i - 1].x + f * (points[i].x - points[i - 1].x);
  position.y = points[i - 1].y + f * (points[i].y - points[i - 1].y);
}

function followRoute(S, a, route, distance, reverse, wear, fordRisk, loaded) {
  const { points, distances, length } = route;
  const edge = reverse ? points.length - 1 : 0, direction = reverse ? -1 : 1;
  if (!reverse) positionOnRoute(route, Math.min(distance, length), a);
  let previous = cellAt(points[edge].x, points[edge].y);
  for (let i = edge + direction; i >= 0 && i < points.length; i += direction) {
    const partial = Math.abs(distances[i] - distances[edge]) > distance;
    if (partial && reverse) break;
    const p = partial ? a : points[i], cell = cellAt(p.x, p.y);
    if (partial && previous === cell) break;
    if (previous === cell) continue;
    S.wear[cell] += wear;
    if (S.ter[cell] === 'w' && !S.bridge[cell] && (S.ter[previous] !== 'w' || S.bridge[previous])) {
      const g = S._groupsById[a.group];
      if (g) g.cross = (g.cross || 0) + 1;
      if (rnd(S) < fordRisk * (loaded ? 3 : 1) * (a.age > 55 ? 1.5 : 1)) {
        a.x = p.x;
        a.y = p.y;
        (S._drown || (S._drown = [])).push(a);
        return false;
      }
    }
    previous = cell;
    if (partial) break;
  }
  return true;
}

function walkedNear(a, place, radius) {
  const trip = a._travel;
  if (!trip?.route || !trip.distance) return within(a.x - place.x, a.y - place.y, radius);
  const { points, distances } = trip.route;
  for (let i = 1; i < points.length; i++) {
    const partial = distances[i] >= trip.distance;
    if (distanceToSegment(place, points[i - 1], partial ? a : points[i]) < radius) return true;
    if (partial) return false;
  }
  return false;
}

function planMovement(S, a, tx, ty, trip, shelter, house, light, fordRisk, plans) {
  const x = a.x, y = a.y;
  const originX = shelter?.x ?? x, originY = shelter?.y ?? y;
  const route = walkingRoute(S, a, originX, originY, tx, ty);
  const start = Math.ceil(light.sunrise * 60 + a.id % 11 * 2);
  const finish = Math.floor(light.sunset * 60);
  const laden = !!(a.haul || a.car), carryBack = !a.haul && RETURN_LOAD.has(a.job);
  const speed = laden ? LOAD_SPEED : WALK_SPEED;
  const backSpeed = carryBack ? LOAD_SPEED : WALK_SPEED;
  const outMinutes = route ? Math.ceil(route.length / speed) : 0;
  const backMinutes = route && shelter ? Math.ceil(route.length / backSpeed) : 0;
  const local = !!shelter;
  a._workBlocked = !route || (local && start + outMinutes + backMinutes > finish);
  a.commute = local ? (a._workBlocked ? null : outMinutes + backMinutes) : 0;
  a._travel = null;

  let distance = 0;
  const wear = a.car ? 7 : a.war ? 3 : 1;
  if (!a._workBlocked) {
    distance = local ? route.length : Math.min(route.length, trip ? LONG_WALK : CAMP_WALK, (finish - start) * speed);
    const safe = followRoute(S, a, route, distance, false, wear, fordRisk, laden);
    if (safe && local) followRoute(S, a, route, distance, true, wear, fordRisk, carryBack);
    if (safe && distance === route.length) {
      if (trip === 'relocation') delete a.relocation;
      if (trip === 'escape') delete a.escape;
    }
  } else if (local && navigationCosts(S)[cellAt(originX, originY)]) {
    a.x = originX;
    a.y = originY;
  }

  if (trip) a._travel = { route, distance, arrived: !!route && distance === route.length };
  if (plans) {
    plans.set(a.id, {
      kind: trip || (a._workBlocked ? 'home' : a.haul ? 'delivery' : a.rite && S.tick < a.rite.until ? 'rite' : a.job || 'gather'),
      home: house && !house.ruined ? house.id : null,
      origin: { x: originX, y: originY },
      destination: { x: a.x, y: a.y },
      route: distance > 0 ? route : null,
      distance, depart: start, arrive: start + Math.ceil(distance / speed),
      leave: local && distance > 0 ? finish - backMinutes : null,
      finish,
      commuteMinutes: a.commute,
      blocked: a._workBlocked
    });
  }
}

function routinePosition(plan, minute, position) {
  if (!plan.route || minute <= plan.depart) {
    position.x = plan.origin.x;
    position.y = plan.origin.y;
    return;
  }
  let progress = Math.min(1, (minute - plan.depart) / (plan.arrive - plan.depart));
  if (plan.leave !== null && minute > plan.leave) {
    progress = Math.max(0, (plan.finish - minute) / (plan.finish - plan.leave));
  }
  positionOnRoute(plan.route, progress * plan.distance, position);
}
