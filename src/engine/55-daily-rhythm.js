/* ---------- daily routine for close observation ---------- */
function daylightHours(tick) {
  const halfDay = 6 - 2 * Math.cos((tick % 360 - 45) * Math.PI / 180);
  return { sunrise: 12 - halfDay, sunset: 12 + halfDay };
}

function dailyRoutine(S, a) {
  if (a.war || a.car || !a.group) return null;
  const g = S._g.get(a.group);
  if (!g) return null;
  const house = houseOf(g, a.house);
  const home = house && !house.ruined ? house : null;
  const shelter = home || g.home || { x: g.cx, y: g.cy };
  const start = cellAt(shelter.x, shelter.y), end = cellAt(a.x, a.y);
  const costs = navigationCosts(S);
  if (!costs[start] || !costs[end]) return null;
  const path = getPath(S, start, end);
  if (!path) return null;
  const bed = { x: shelter.x, y: shelter.y };
  if (home) {
    const x = (start % N) * CS, y = Math.floor(start / N) * CS;
    bed.x = clamp(bed.x + a.id % 7 - 3, x + 1, x + CS - 1);
    bed.y = clamp(bed.y + Math.floor(a.id / 7) % 7 - 3, y + 1, y + CS - 1);
  }
  const route = [bed];
  if (start !== end) {
    for (const cell of path) {
      route.push({ x: (cell % N) * CS + CS / 2, y: Math.floor(cell / N) * CS + CS / 2 });
    }
  }
  route.push({ x: a.x, y: a.y });
  return {
    route, home: home?.id ?? null,
    departure: (a.id % 11) * 0.035,
    travel: Math.min(3, 0.35 + (path.length - 1) * 0.18),
  };
}

function routinePosition(routine, hour, light, position) {
  const { route, departure, travel } = routine;
  const out = light.sunrise + departure;
  const homeBy = light.sunset - departure;
  if (hour <= out || hour >= homeBy) {
    position.x = route[0].x;
    position.y = route[0].y;
    return;
  }
  const progress = Math.min(1, (hour - out) / travel, (homeBy - hour) / travel);
  const index = progress * (route.length - 1);
  const first = Math.floor(index), part = index - first;
  const next = route[Math.min(first + 1, route.length - 1)];
  position.x = route[first].x + (next.x - route[first].x) * part;
  position.y = route[first].y + (next.y - route[first].y) * part;
}
