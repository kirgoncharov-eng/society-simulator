/* ---------- the hour of an event and the day of the month for decisions (Ч4) ---------- */
// Every event gets an hour by its kind: the band strikes at dawn, the assembly meets in the morning, the dead are buried
// before noon, the wedding feast starts before sunset, talk and secrets belong to the evening. Hours tied to the light
// move with the season: a winter dawn raid is later than a summer one. The spread around the usual hour is drawn from the
// event's id, not from the world's random stream, so giving events an hour changes nothing else in the world.
// [anchor, offset, spread]: anchor 'r' = sunrise, 's' = sunset, 'h' = the clock; offset and spread in hours
const EVENT_HOUR = {
  // war: at first light, and the night before for a raid
  battle: ['r', -0.5, 0.5], raid: ['r', -1.5, 0.75], war: ['r', 1, 1], conquest: ['h', 12, 2], revolt: ['r', 0, 1], coup: ['r', -2, 1],
  ransom: ['h', 11, 2], revenge: ['s', 1.5, 1.5], conflict: ['h', 10, 3], border: ['h', 10, 3],
  // the assembly and the court: in the morning, once the cattle is out
  law: ['r', 2.5, 1], gov: ['r', 2.5, 1], land: ['r', 2.5, 1], debt: ['r', 2.5, 1], case: ['r', 3, 1], reform: ['r', 3, 1.5],
  tax: ['r', 3, 1.5], money: ['h', 11, 2], succession: ['h', 13, 1], regime: ['h', 12, 2], state: ['h', 12, 2], alliance: ['h', 12, 2],
  merge: ['h', 12, 2], crisis: ['h', 10, 2], collapse: ['h', 12, 3], faith: ['r', 0.5, 1],
  // leaving and arriving: people set out at dawn and arrive by midday
  quit: ['r', 0.5, 1], exile: ['r', 1, 1], exodus: ['r', 0.5, 1], emigr: ['r', 0.5, 1], schism: ['r', 0.5, 1], colony: ['r', 0.5, 1],
  abandon: ['r', 0.5, 1], found: ['h', 12, 2], settle: ['h', 12, 2], boat: ['h', 11, 2],
  // family: weddings before sunset, flight at night
  marriage: ['s', -1, 1], elope: ['s', 3, 1.5], break: ['s', 1, 1.5],
  // talk, plans and secrets: the evening by the fire
  arc: ['s', 2, 1.5], secret: ['s', 2.5, 1.5], rumor: ['s', 2, 1.5],
  // work done: in the working hours
  tech: ['h', 14, 3], well: ['h', 15, 2], bridge: ['h', 15, 2], milestone: ['h', 15, 3], trade: ['h', 11, 2], route: ['h', 11, 2], market: ['h', 10, 2],
  // hardship: found out in the morning; the sea and the heat take people by day
  famine: ['r', 1, 1.5], tyranny: ['r', 3, 1.5], aid: ['h', 10, 2], drought: ['h', 13, 3], thirst: ['h', 15, 2], drown: ['h', 13, 3], plague: ['h', 9, 3], plagueEnd: ['h', 12, 3],
  death: ['h', 4, 3]
};
const RITE_HOUR = { funeral: ['h', 11, 1], feast: ['s', -1.5, 1], wedding: ['s', -1, 1], cemetery: ['h', 12, 2] };
// ids of the kinds that need no hour: the chronicle's summaries of an era and the first lines of the world
function eventMinute(S, ev) {
  const r = ev.type === 'rite' ? RITE_HOUR[ev.rite] || RITE_HOUR.feast : EVENT_HOUR[ev.type];
  if (!r) return undefined;
  const light = daylightHours(ev.t), base = r[0] === 'r' ? light.sunrise : r[0] === 's' ? light.sunset : 0;
  const u = (Math.imul(ev.id ^ 0x5bd1e995, 0x2c1b3c6d) >>> 0) / 4294967296;
  return clamp(Math.round((base + r[1] + (2 * u - 1) * r[2]) * 60), 0, DAY_MINUTES - 1);
}
// give the event its hour and count, for the audit, how many events have one and on which day of the month they fall
function evClock(S, ev) {
  if (ev.minute === undefined) { const m = eventMinute(S, ev); if (m !== undefined) ev.minute = m; }
  const c = S.stats.clock || (S.stats.clock = { all: 0, timed: 0, day: new Array(30).fill(0) });
  c.all++; if (Number.isInteger(ev.minute)) c.timed++; c.day[ev.t % 30]++;
}
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Each village holds its monthly reckoning (shares, grievances, coups, laws, exits) on its own day of the month, the way
// markets and courts in a district met on different days; the island-wide rounds (marriages, talk, relations between
// villages) go on fixed days of their own. A month is still thirty days between two reckonings of the same village.
const monthDay = g => (g.id * 7) % 30;
function monthDays(S) {
  const d = S.tick % 30, y = S.tick % 360;
  for (const g of S.groups.slice()) if (!g.dead && monthDay(g) === d) groupMonth(S, g);
  // the harvest feast falls on a village's own day in the ten days after the harvest is in
  if (y >= 330 && y < 340) for (const g of S.groups.slice()) if (!g.dead && 330 + monthDay(g) % 10 === y) harvestFeast(S, g);
  if (d === 6) families(S);
  if (d === 12) plagueMonth(S);
  if (d === 18) { affairsMonth(S); gossipMonth(S); goalsMonth(S); }
  if (d === 24) { relations(S); tradeMonth(S); warMonth(S); marketWatch(S); }
}

/* ---------- how long things take (Ч4): measured in the world, compared in the audit with real references ---------- */
function durNote(S, k, days) { const d = S.stats.dur || (S.stats.dur = {}), x = d[k] || (d[k] = [0, 0]); x[0] += days; x[1]++; }
// a pregnancy lasts nine months: the child is conceived in the monthly round and born on its own day (Ч4)
const PREGNANCY = 270;
function births(S) {
  for (const a of S.agents) {
    const p = a.preg; if (!p || S.tick < p.due) continue;
    a.preg = null;
    const h = S._a.get(p.fa), sx = p.sex;
    S.kids.push({ t: S.tick, mo: a.id, fa: p.fa, lin: p.lin, g: a.group, sex: sx, x: a.x, y: a.y }); a.lastBirth = S.tick;
    S.stats.births = (S.stats.births || 0) + 1; durNote(S, 'preg', S.tick - p.t);
    const tx = sx === 'f' ? 'Рождается дочь' : 'Рождается сын'; bio(S, a, 'child', tx); if (h) bio(S, h, 'child', tx);
  }
}
