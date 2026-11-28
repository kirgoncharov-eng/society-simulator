/* ---------- memory of communities and places (К1, see docs/CULTURE.md) ---------- */
// A village (and a lineage) remembers what struck it: its founding, blood, disasters, turns of power, help. A memory has a
// weight and witnesses: every adult of the village at the time. While witnesses live it hardly fades (Assmann's living
// memory); after the last of them dies it fades within two or three generations unless something holds it: a named
// place, a monument (a mound, a mass grave, a memorial stone), a memorial day (Whitehouse). The founding fades slowest
// (Vansina's floating gap: origins and recent times are remembered, the middle drops out). Places keep their names after
// the memory is gone (Basso): the name outlives the story — the seed of a myth (К2).
// g.mem: [{ id, ev, kind, tone, w, w0, t, wit: [ids], what, place, mon, other, hero, lin, lastWit }]
// g.memGone: forgotten memories, kept for myths. S.places: [{ id, name, kind, x, y, ev, t, g, mon, forgot }]
const MEM_FORGET = 0.15;
const MEM_RATE = { living: 0.004, heard: 0.012 };
const hash01 = n => (Math.imul((n | 0) ^ 0x9e3779b1, 0x85ebca6b) >>> 0) / 4294967296;
const pickBy = (arr, n) => arr[Math.floor(hash01(n) * arr.length) % arr.length];

// remember an event in village g. o: { ev, kind, tone, w, what, place, mon, other, hero, lin }
function remember(S, g, o) {
  if (!g || g.dead || !o.ev) return null;
  const wit = g.members.filter(id => { const m = S._a.get(id); return m && m.age >= 16; }).slice(0, 60);
  const m = Object.assign({ id: (S.memId = (S.memId || 0) + 1), t: S.tick, w0: o.w, wit, lastWit: null }, o);
  // names are kept with the memory: the people and villages it speaks of may be long gone when it becomes a legend (К2)
  const h = o.hero && personOf(S, o.hero); if (h) { m.heroName = h.name; m.heroSex = h.sex; m.heroLin = h.lin || h.linId || null; }
  const og = o.other && S._g.get(o.other); if (og) m.otherName = og.name;
  const pl0 = o.place && placeById(S, o.place); if (pl0) m.placeName = pl0.name;
  m.gname = g.name; m.faith = g.faith && S.faiths && S.faiths[g.faith] ? S.faiths[g.faith].base : null;
  (g.mem || (g.mem = [])).push(m);
  // a village keeps at most twenty memories: the weakest goes first
  if (g.mem.length > 20) { g.mem.sort((a, b) => b.w - a.w); forget(S, g, g.mem[g.mem.length - 1], true); }
  cite(S, o.ev);
  S.stats.memories = (S.stats.memories || 0) + 1;
  return m;
}
const memOf = (g, id) => g && (g.mem || []).find(m => m.id === id);
// the living witnesses of a memory
const witnesses = (S, m) => m.wit.filter(id => S._a.has(id)).length;

/* ---------- places with names ---------- */
function terrainAt(S, x, y) {
  const c = cellAt(x, y), t = S.ter[c];
  if (riverDist(S, x, y) < 40) return 'ford';
  if (t === 'h') return 'hill';
  if (t === 'f') return 'wood';
  if (t === 'b' || t === 's' || t === 'w') return 'shore';
  return 'field';
}
const PLACE_NAMES = {
  battle: { ford: ['Кровавый брод', 'Брод сечи'], hill: ['Красный холм', 'Холм сечи'], wood: ['Чёрная роща', 'Роща павших'], shore: ['Берег сечи', 'Красный берег'], field: ['Поле сечи', 'Красное поле'] },
  sea: ['Заводь Невернувшихся', 'Вдовий мыс', 'Мыс Невернувшихся'],
  plague: ['Моровая яма', 'Моровой лог'],
  hunger: ['Голодная могила', 'Голодный лог']
};
// a unique name on the island: the second «Кровавый брод» becomes «Новый кровавый брод», the next ones name the village
const NOUN_GENDER = { брод: 'm', холм: 'm', берег: 'm', мыс: 'm', лог: 'm', камень: 'm', курган: 'm', роща: 'f', заводь: 'f', яма: 'f', могила: 'f', поле: 'n' };
function uniqueName(S, name, g) {
  const taken = new Set((S.places || []).map(p => p.name));
  if (!taken.has(name)) return name;
  const noun = name.toLowerCase().split(' ').find(w => NOUN_GENDER[w]), gen = NOUN_GENDER[noun] || 'm';
  const second = `${gen === 'f' ? 'Новая' : gen === 'n' ? 'Новое' : 'Новый'} ${name.charAt(0).toLowerCase() + name.slice(1)}`;
  if (!taken.has(second)) return second;
  return g ? `${name} (${g.name})` : `${name} (${(S.places || []).length})`;
}
function namePlace(S, o) {
  const p = Object.assign({ id: (S.placeId = (S.placeId || 0) + 1), t: S.tick }, o);
  p.name = uniqueName(S, o.name, o.g && S._g.get(o.g));
  (S.places || (S.places = [])).push(p);
  S.stats.places = (S.stats.places || 0) + 1;
  return p;
}
const placeById = (S, id) => id && (S.places || []).find(p => p.id === id);

/* ---------- events that a community remembers ---------- */
// a battle: both sides remember it, the winners as a victory, the losers as a defeat; with three or more dead the fallen
// lie in a mass grave on the field; if the defenders do not bury the attackers they left behind, that is a grudge apart
function memBattle(S, A, B, win, deadA, deadB, ev) {
  const dead = deadA.length + deadB.length;
  if (!dead && !win) return;
  if (dead) { const bp = S.stats.bloodPairs || (S.stats.bloodPairs = []); bp.push([key(A.id, B.id), S.tick]); if (bp.length > 200) bp.shift(); }
  const LA = S._a.get(A.leader), LB = S._a.get(B.leader);
  const x = B.home.x + (A.home.x - B.home.x) * 0.15, y = B.home.y + (A.home.y - B.home.y) * 0.15;
  let place = null;
  if (dead >= 2) {
    const kind = terrainAt(S, x, y), base = pickBy(PLACE_NAMES.battle[kind], ev.id);
    place = namePlace(S, { name: base, kind: 'battle', x, y, ev: ev.id, g: B.id, mon: dead >= 3 ? 'massgrave' : null });
    if (place.mon) S.stats.massGraves = (S.stats.massGraves || 0) + 1;
  }
  const what = place ? `битву на месте, что зовут «${place.name}»` : `битву у «${B.name}»`;
  // attackers who lost leave their dead on enemy land; a hard leader does not bury them
  const unburied = !win && deadA.length && LB && LB.coop < 0.4;
  // the fallen of each side are its heroes; the side that lost remembers the battle harder
  const ma = remember(S, A, { ev: ev.id, kind: 'blood', tone: win ? 'win' : 'loss', w: clamp(0.5 + 0.12 * dead + (win ? 0 : 0.2) + (unburied ? 0.3 : 0), 0.4, 2), what, place: place && place.id, mon: place && place.mon, other: B.id, hero: deadA[0] && deadA[0].id, unburied: unburied || undefined, dead: deadA.length, foeDead: deadB.length, att: true });
  const mb = remember(S, B, { ev: ev.id, kind: 'blood', tone: win ? 'loss' : 'win', w: clamp(0.6 + 0.12 * dead + (win ? 0.2 : 0), 0.4, 2), what, place: place && place.id, mon: place && place.mon, other: A.id, hero: deadB[0] && deadB[0].id, dead: deadB.length, foeDead: deadA.length });
  for (const [g, m] of [[A, ma], [B, mb]]) if (m && m.mon && hash01(ev.id + g.id) < 0.4) memorialFor(S, g, m);
  if (place && place.mon) note(S, 'rite', `${unburied ? `Павших «${A.name}» оставляют без погребения, своих` : 'Павших'} хоронят в братской могиле: ${place.name}`, x, y, B.hue, { rite: 'grave', who: deadA.concat(deadB).slice(0, 6).map(m => m.id), gs: [B.id, A.id], causes: [ev.id] });
  if (unburied) S.stats.unburied = (S.stats.unburied || 0) + 1;
}
// a boat that never came back: a stone at the landing for those the sea did not give back, if the village has stone
function memSea(S, g, m, ev) {
  if (!g || !g.home) return;
  const at = g.landing || g.home, x = at.x, y = at.y;
  const stone = (g.stone || 0) >= 1;
  if (stone) g.stone -= 1;
  const place = namePlace(S, { name: stone ? `Камень ${nameCase(m, 'genitive')}` : pickBy(PLACE_NAMES.sea, ev.id), kind: 'sea', x, y, ev: ev.id, g: g.id, mon: stone ? 'stone' : null });
  if (stone) S.stats.stones = (S.stats.stones || 0) + 1;
  remember(S, g, { ev: ev.id, kind: 'woe', tone: 'grief', w: 0.7, what: `лодку ${nameCase(m, 'genitive')}, что не вернулась с моря`, place: place.id, mon: place.mon, hero: m.id, dead: 1, sub: 'sea' });
}
// a plague that killed many: the dead go into a pit at the edge of the burial ground, a place people fear
function memPlague(S, g, dead, ev) {
  if (!g || !g.home || dead < 4) return;
  const cem = g.cemetery || g.home, x = cem.x + 18, y = cem.y + 12;
  const place = namePlace(S, { name: pickBy(PLACE_NAMES.plague, ev.id), kind: 'plague', x, y, ev: ev.id, g: g.id, mon: 'massgrave', dread: true });
  S.stats.massGraves = (S.stats.massGraves || 0) + 1;
  remember(S, g, { ev: ev.id, kind: 'woe', tone: 'grief', w: clamp(0.6 + dead * 0.05, 0.6, 2), what: `мор, унёсший ${dead} ${pl(dead, 'человека', 'человек', 'человек')}`, place: place.id, mon: 'massgrave', dead, sub: 'plague' });
}
function memFamine(S, g, hungry, n, ev) { remember(S, g, { ev: ev.id, kind: 'woe', tone: 'grief', w: clamp(0.3 + hungry / Math.max(1, n), 0.4, 1.3), what: `голодную зиму г.${Math.floor(S.tick / 360)}`, sub: 'famine' }); }
// the founding of a village: a stone where the first house stood
function memFounding(S, g, L, ev, how) {
  if (!g || !L) return;
  // К2: a daughter village carries its mother's legends
  if (how === 'colony' || how === 'schism') inheritMyths(S, ev.gs && S._g.get(ev.gs.find(id => id !== g.id)), g);
  const at = g.home || { x: g.cx, y: g.cy };
  const place = g.home ? namePlace(S, { name: `Камень ${nameCase(L, 'genitive')}`, kind: 'origin', x: at.x - 14, y: at.y + 10, ev: ev.id, g: g.id, mon: 'stone' }) : null;
  remember(S, g, { ev: ev.id, kind: 'origin', tone: 'pride', w: 1, what: `основание деревни ${L.name}`, place: place && place.id, mon: place && 'stone', hero: L.id, lin: L.lin, how: how || (S.tick < 360 * 8 ? 'landing' : 'found'), from: ev.gs && ev.gs.length > 1 ? (S._g.get(ev.gs.find(id => id !== g.id)) || {}).name : undefined });
}
// a village founded on the march gets its stone when it settles
function originStone(S, g) {
  const m = (g.mem || []).find(x => x.kind === 'origin' && !x.place); if (!m) return;
  const L = personOf(S, m.hero); if (!L) return;
  const p = namePlace(S, { name: `Камень ${nameCase(L, 'genitive')}`, kind: 'origin', x: g.home.x - 14, y: g.home.y + 10, ev: m.ev, g: g.id, mon: 'stone' });
  m.place = p.id; m.mon = 'stone'; m.placeName = p.name;
}
function memAid(S, from, to, ev) { remember(S, to, { ev: ev.id, kind: 'good', tone: 'thanks', w: 0.6, what: `зерно от «${from.name}» в голодную зиму`, other: from.id }); }
function memPower(S, g, o) { remember(S, g, Object.assign({ kind: 'power' }, o)); }

/* ---------- the ruler's mound and the burial plots of the lines ---------- */
// on a burial: the lineage's plot grows; a founder or a long ruler gets a mound if the village can feed the diggers;
// a tyrant does not (Parker Pearson 1999: the dead do not bury themselves — a mound is the living's claim)
function burialPlot(S, g, a) { const cem = g.cemetery; if (!cem || !a.lin) return; const P = cem.plots || (cem.plots = {}); P[a.lin] = (P[a.lin] || 0) + 1; }
function rulerMound(S, g, a, fev) {
  if (g.leader !== a.id || !g.cemetery) return;
  const years = Math.round((S.tick - (g.since || g.founded)) / 360), founder = g.gen <= 1, n = g.members.length;
  if ((!founder && years < 10) || n < 8) return; // a hamlet does not raise a mound
  const tyrant = g.tyr && g.tyr.L === a.id && S.tick - g.tyr.t < 360 * 30;
  if (tyrant) { note(S, 'rite', `${a.name} ${fem(a, 'брал', 'брала')} хлеб у голодных — кургана ${fem(a, 'ему', 'ей')} не насыпают`, g.cemetery.x, g.cemetery.y, g.hue, { rite: 'grave', who: [a.id], gs: [g.id], causes: [g.tyr.ev, fev].filter(Boolean) }); return; }
  if (g.treasury < n * 2 || g.famY === Math.floor(S.tick / 360)) return;
  g.treasury -= n * 0.6;
  for (const id of g.members) { const m = S._a.get(id); if (m && m.age >= 16 && m.age < 55) m.energy = Math.max(0.1, m.energy - 0.05); }
  const cem = g.cemetery, x = cem.x - 20 + hash01(a.id) * 10, y = cem.y - 16;
  const place = namePlace(S, { name: `Курган ${nameCase(a, 'genitive')}`, kind: 'mound', x, y, ev: fev, g: g.id, mon: 'mound', lin: a.lin });
  S.stats.mounds = (S.stats.mounds || 0) + 1;
  const ev = log(S, 'rite', `«${g.name}» насыпает курган над ${fem(a, 'вождём', 'вождём')} ${nameCase(a, 'instrumental')}`, x, y, g.hue, { rite: 'mound', why: sent([founder ? `${a.name} ${fem(a, 'основал', 'основала')} деревню` : `${a.name} ${fem(a, 'правил', 'правила')} ${yrs(years)}`, 'всё лето мужчины носят землю; деревня кормит работников из общего амбара', 'курган будет виден издалека и напомнит, чей род здесь первый']), who: [a.id], gs: [g.id], causes: [fev].filter(Boolean) });
  place.ev = ev.id;
  remember(S, g, { ev: ev.id, kind: founder ? 'origin' : 'power', tone: 'pride', w: founder ? 1.2 : 0.9, what: `${fem(a, 'вождя', 'вождя')} ${nameCase(a, 'accusative')}, что лежит в кургане`, place: place.id, mon: 'mound', hero: a.id, lin: a.lin, years });
}
// an ancestor's mound that is still remembered: the line of its hero holds the right to rule more firmly
function ancestorMound(S, g, lin) { return (g.mem || []).find(m => m.mon === 'mound' && m.lin === lin && m.w >= 0.4); }
// graves of one's line in the village: leaving them is harder, and the line's word weighs more when fields are divided
const linGraves = (g, lin) => (g && g.cemetery && g.cemetery.plots && lin && g.cemetery.plots[lin]) || 0;

/* ---------- the memorial day ---------- */
// after a heavy loss with a monument, a village may keep a day when everyone goes to the grave or the mound; that day the
// memory is retold and does not fade. Adults walk there in the day plan (a rite), so the observer sees it on the map
function memorialFor(S, g, m) {
  if (g.memDay || !m.mon || m.w0 < 1) return;
  g.memDay = m.id;
  const p = placeById(S, m.place);
  log(S, 'rite', `«${g.name}» будет каждый год поминать ${p ? `тех, кто лежит у места «${p.name}»` : m.what}`, p ? p.x : g.home.x, p ? p.y : g.home.y, g.hue, { rite: 'memorial', why: sent(['боль слишком велика, чтобы её забыть', 'раз в год вся деревня приходит к могиле', 'так помнят и те, кто родится потом']), gs: [g.id], causes: [m.ev] });
}
function memorialDay(S, g) {
  const m = memOf(g, g.memDay); if (!m) { g.memDay = null; return; }
  const p = placeById(S, m.place) || g.cemetery; if (!p) return;
  for (const id of g.members) { const a = S._a.get(id); if (a && a.age >= 12) a.rite = { x: p.x, y: p.y, until: S.tick + 1 }; }
  m.w = Math.min(m.w0, m.w + 0.01); m.kept = S.tick;
  S.stats.memorials = (S.stats.memorials || 0) + 1;
}

/* ---------- a year of memory ---------- */
function memoryYear(S, g) {
  if (!g.mem || !g.mem.length) return;
  for (const m of g.mem.slice()) {
    const live = witnesses(S, m);
    if (!live && m.lastWit === null) {
      m.lastWit = S.tick;
      if (m.w0 >= 1) note(S, 'arc', `В «${g.name}» не осталось никого, кто сам помнил бы ${m.what}`, g.home ? g.home.x : g.cx, g.home ? g.home.y : g.cy, g.hue, { gs: [g.id], causes: [m.ev] });
    }
    let rate = live ? MEM_RATE.living : MEM_RATE.heard;
    if (m.place) rate *= 0.5;
    if (m.mon) rate *= 0.5;
    if (m.kind === 'origin') rate *= 0.5;
    if (g.memDay === m.id) rate = 0;
    m.w -= rate;
    if (m.w < MEM_FORGET) forget(S, g, m);
  }
}
function forget(S, g, m, quiet) {
  g.mem = g.mem.filter(x => x !== m);
  (g.memGone || (g.memGone = [])).push({ ev: m.ev, kind: m.kind, tone: m.tone, what: m.what, t: m.t, gone: S.tick, place: m.place, other: m.other, hero: m.hero, lin: m.lin });
  if (g.memGone.length > 30) g.memGone.shift();
  cite(S, m.ev);
  const p = placeById(S, m.place);
  if (p) p.forgot = p.forgot || S.tick;
  S.stats.forgotten = (S.stats.forgotten || 0) + 1;
  if (!quiet) { const life = S.stats.memLife || (S.stats.memLife = { bare: [0, 0], place: [0, 0], mon: [0, 0] }), k = m.mon ? 'mon' : m.place ? 'place' : 'bare'; life[k][0] += (S.tick - m.t) / 360; life[k][1]++; }
  if (!quiet) note(S, 'arc', `В «${g.name}» больше не помнят ${m.what}${p ? `. Место по-прежнему зовут ${p.name}, но уже не знают почему` : ''}`, g.home ? g.home.x : g.cx, g.home ? g.home.y : g.cy, g.hue, { gs: [g.id], causes: [m.ev] });
}

/* ---------- what memory changes in the world ---------- */
// blood between two villages, still remembered: the enmity does not cool below a floor; help: it cools faster
function memoryTies(S) {
  const grudge = {}, thanks = {};
  for (const g of S.groups) for (const m of g.mem || []) {
    if (!m.other) continue;
    const k = key(g.id, m.other);
    if (m.kind === 'blood') { if (!grudge[k] || grudge[k].w < m.w) grudge[k] = m; }
    else if (m.kind === 'good') thanks[k] = Math.max(thanks[k] || 0, m.w);
  }
  // К2: a legend of defeat or of a Great War keeps the grudge after the last witness is gone
  for (const g of S.groups) for (const y of g.myths || []) {
    if (!y.other || !(y.kind === 'war' || (y.kind === 'blood' && y.tone === 'loss'))) continue;
    const k = key(g.id, y.other); if (!grudge[k] || grudge[k].w < 0.6) grudge[k] = { w: 0.6, ev: y.ev, myth: true };
  }
  return { grudge, thanks };
}
const GRUDGE_FLOOR = 0.35;
// fear of a place: a plague pit or a mass grave, still remembered, keeps settlers and fields away
function dreadAt(S, x, y, r = 70) {
  for (const p of S.places || []) {
    if (!p.cursed && (p.forgot || !(p.dread || p.mon === 'massgrave'))) continue; // К2: a haunted place keeps its fear
    if (Math.hypot(p.x - x, p.y - y) < r) return p;
  }
  return null;
}
// a monument takes ground: no field on a grave or a mound
function onMonument(S, x, y) { for (const p of S.places || []) if (p.mon && Math.hypot(p.x - x, p.y - y) < 22) return true; return false; }
// a child named after someone the village remembers: a fallen hero, a founder in his mound, a grandparent
function memoryName(S, a, g) {
  const cands = [];
  for (const m of (g && g.mem) || []) { if (!m.hero || m.w < 0.5) continue; const h = personOf(S, m.hero); if (h && h.sex === a.sex && h.name !== a.name) cands.push([h, m]); }
  for (const y of (g && g.myths) || []) { if (!y.heroName || y.villain || y.heroSex !== a.sex || y.version === 'old') continue; cands.push([{ name: y.heroName, sex: y.heroSex }, { w: 0.8, ev: y.ev, what: `предание о ${y.heroName}` }]); }
  const gps = [a.mother, a.father].map(id => personOf(S, id)).filter(Boolean).flatMap(p => [p.mother, p.father]).map(id => personOf(S, id)).filter(p => p && p.sex === a.sex && !S._a.has(p.id));
  const u = hash01(a.id * 31 + S.tick);
  if (cands.length && u < 0.12 * cands[0][1].w) { const [h, m] = cands[Math.floor(hash01(a.id) * cands.length) % cands.length]; return { name: h.name, why: `в честь ${h.id ? nameCase(h, 'genitive') : h.name}: в «${g.name}» ${m.what.startsWith('предание') ? 'рассказывают ' + m.what : 'помнят ' + m.what}`, ev: m.ev, hero: h.id }; }
  if (gps.length && u > 0.9) { const h = gps[0]; return { name: h.name, why: `в честь ${h.sex === 'f' ? 'бабушки' : 'деда'} ${nameCase(h, 'genitive')}`, hero: h.id }; }
  return null;
}
