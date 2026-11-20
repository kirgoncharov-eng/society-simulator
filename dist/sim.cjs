const SIM = (() => {
const SYL = ['ар','вен','ли','мир','та','ро','эл','ка','дан','ис','ор','ну','са','вел','ин','то','ри','ла','мэ','зор','ан','ви','лей','дар','ми','ту','ре','ол','фа','ям','бо','се','ха','ют'];
const T_EG = ['Круг','Община','Братство','Артель','Совет'];
const T_HI = ['Дом','Орден','Престол','Дело','Синдикат'];
const SEASON = ['зима','весна','лето','осень'];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function rnd(S) {
  let t = (S.rng = (S.rng + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const gauss = S => (rnd(S) + rnd(S) + rnd(S) - 1.5) / 1.5;
const pick = (S, arr) => arr[Math.floor(rnd(S) * arr.length)];
function mkName(S) {
  const s1 = pick(S, SYL); let s2 = pick(S, SYL); if (s2 === s1) s2 = SYL[(SYL.indexOf(s1) + 7) % SYL.length];
  let n = s1 + s2;
  if (rnd(S) < 0.2) n += pick(S, SYL);
  return n[0].toUpperCase() + n.slice(1);
}
const one = n => n % 10 === 1 && n % 100 !== 11;
const cells = d => { const n = Math.max(1, Math.round(d / 20)); return `${n} ${one(n) ? 'клетке' : 'клетках'}`; };
const pl = (n, a, b, c) => one(n) ? a : (n % 10 > 1 && n % 10 < 5 && (n % 100 < 12 || n % 100 > 14)) ? b : c;
const yrs = n => `${n} ${one(n) ? 'год' : (n % 10 > 1 && n % 10 < 5 && (n % 100 < 12 || n % 100 > 14)) ? 'года' : 'лет'}`;
const P0 = v => Math.round(v * 100) + '%';
const avg = (arr, f) => arr.length ? arr.reduce((s, m) => s + f(m), 0) / arr.length : 0;
const sent = parts => { const t = parts.filter(Boolean).join('; '); return t ? t[0].toUpperCase() + t.slice(1) + '.' : ''; };
const key = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const date = t => `г.${Math.floor(t / 360)} · ${SEASON[Math.floor((t % 360) / 90)]}`;

function index(S) {
  S._a = new Map(S.agents.map(a => [a.id, a]));
  S._g = new Map(S.groups.map(g => [g.id, g]));
}
function log(S, type, text, x, y, hue, ex) {
  S.evId = (S.evId || 0) + 1; S.evc = S.evc || {}; S.evc[type] = (S.evc[type] || 0) + 1;
  S.events.unshift(Object.assign({ id: S.evId, t: S.tick, type, text, x, y, hue }, ex || {}));
  if (S.events.length > 250) S.events.length = 250;
  if (x !== undefined) S.flashes.push({ id: S.flashId++, t: S.tick, type, x, y, hue });
  if (S.flashes.length > 60) S.flashes.splice(0, S.flashes.length - 60);
}

function beachSpot(S, avoid) {
  const B = []; for (let c = 0; c < N * N; c++) if (S.ter[c] === 'b') B.push(c);
  let best = null, bv = -1e9;
  for (let t = 0; t < 30 && B.length; t++) { const c = B[Math.floor(rnd(S) * B.length)], x = (c % N) * CS + 10, y = ((c / N) | 0) * CS + 10; let v = rnd(S) * 50; if (avoid) for (const g of S.groups) if (g.home) v += Math.min(200, Math.hypot(g.home.x - x, g.home.y - y)) / 4; if (v > bv) { bv = v; best = { c, x, y }; } }
  return best;
}
function landBoat(S, size, first) {
  const b = beachSpot(S, first); if (!b) return;
  const ix = S.isle ? S.isle.x : 500, iy = S.isle ? S.isle.y : 500, d = Math.hypot(b.x - ix, b.y - iy) || 1, ux = (b.x - ix) / d, uy = (b.y - iy) / d;
  const band = spawnBand(S, size, b.x - ux * 10, b.y - uy * 10, first ? 12 : 8);
  const g = band.length && S._g.get(band[0].group); if (g) { g.treasury = band.length * 9; g.goats = 2 + Math.floor(rnd(S) * 3); }
  for (const a of band) { a.bio = [[S.tick, 'born', first ? 'Среди первых приплывает на остров' : 'Приплывает на остров из-за моря']]; a.drama = 1; }
  S.boats = S.boats || []; S.boats.push({ x0: b.x + ux * 140, y0: b.y + uy * 140, x1: b.x + ux * 8, y1: b.y + uy * 8, t: S.tick, out: false });
  if (S.boats.length > 30) S.boats.shift();
  S.stats.arrived = (S.stats.arrived || 0) + band.length;
  const firstEver = !S.firstBoat; S.firstBoat = true;
  log(S, 'boat', firstEver ? `Первая лодка пристаёт к острову: ${band.length} ${pl(band.length, 'человек', 'человека', 'человек')}` : `К берегу пристаёт лодка: ${band.length} ${pl(band.length, 'человек', 'человека', 'человек')} из-за моря`, b.x, b.y, g ? g.hue : 200, { first: firstEver, why: sent([first ? 'остров пуст: ни домов, ни троп' : `на острове уже ${popOf(S) - band.length} ${pl(popOf(S) - band.length, 'человек', 'человека', 'человек')}`, 'в лодке одна семья или род: родители, дети, братья и сёстры', 'с собой немного зерна на первое время, а дальше — как сложится', !first ? 'новички будут искать свободную землю у воды или проситься к соседям' : '']), who: band.map(a => a.id), gs: g ? [g.id] : [] });
}
function sectorOf(S, x, y) { return ((Math.round((Math.atan2(y - S.isle.y, x - S.isle.x) + Math.PI) / (2 * Math.PI) * 12)) % 12 + 12) % 12; }
function homeEconomy(S, g, mem) {
  const seas = seasonOf(S.tick), dry = S.tick < (S.drought || 0), n = mem.length;
  if (S.tick % 360 === 30 || g.landing === undefined) { const b = beachNear(S, g.home.x, g.home.y, 170); g.landing = b || null; }
  if (!g.pasture || S.tick % 1800 === 0) { let best = null, bv = -1e9; for (let t = 0; t < 14; t++) { const a = t * 0.45 + g.id, r = 50 + (t % 3) * 25, x = g.home.x + Math.cos(a) * r, y = g.home.y + Math.sin(a) * r, c = cellAt(x, y), tt = S.ter[c]; if (tt !== 'g' && tt !== 'r' && tt !== 'h') continue; if (S.occ[c]) continue; const v = (tt === 'g' ? 2 : 1) - r / 100; if (v > bv) { bv = v; best = { x, y }; } } g.pasture = best; }
  // gardens behind the houses: women, children and the old tend them
  if (seas !== 0) { const hh = g.houses.filter(h => !h.ruined).length; g.treasury += hh * 0.45 * (dry ? 0.5 : 1); }
  // goats
  if (g.goats) {
    const cap = 6 + Math.round(40 * (g.room === undefined ? 0.5 : g.room)) + (g.pasture ? 6 : 0);
    if (seas === 1) g.goats += Math.max(g.goats >= 2 ? 1 : 0, Math.round(g.goats * 0.14 * (g.goats < cap ? 1 : 0.2)));
    if (g.goats > cap) g.goats -= Math.ceil((g.goats - cap) * 0.15);
    if (seas !== 0) g.treasury += g.goats * 0.12 * (dry ? 0.6 : 1);
    if (g.treasury < n * 1.2 && g.goats > 3) { const k = Math.min(g.goats - 3, Math.ceil(n / 5)); g.goats -= k; g.treasury += k * 4; g.slaughter = (g.slaughter || 0) + k; }
  } else if (S.tick - g.founded > 360 && rnd(S) < 0.01) { for (const o of S.groups) if (o !== g && o.goats > 8 && o.home && Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y) < 300 && (S.hostility[key(o.id, g.id)] || 0) < 0.6) { o.goats -= 2; g.goats = 2; break; } }
  // sea fishing from boats
  const fishers = mem.filter(m => m.job === 'fish');
  if (fishers.length && g.landing) {
    S.seaFish = S.seaFish || Array.from({ length: 12 }, () => ({ amt: 220, cap: 220 }));
    const sec = S.seaFish[sectorOf(S, g.landing.x, g.landing.y)], stock = sec.amt / sec.cap;
    let catchT = 0;
    // winter storms: boats go out only when the village is short of food, otherwise fishers mend nets ashore
    const needy = g.treasury < (n + 1) * 2;
    for (const m of fishers) {
      if (seas === 0 && !needy) continue;
      const c = 3.4 * (0.4 + m.energy * 0.6) * (0.3 + 0.7 * stock) * (seas === 0 ? 0.45 : 1); catchT += c;
      const risk = seas === 0 ? 0.0025 : seas === 3 ? 0.0012 : seas === 1 ? 0.0005 : 0.00025;
      if (rnd(S) < risk) { bio(S, m, 'drowned', 'Уходит в море на лодке и не возвращается'); S.stats.lostAtSea = (S.stats.lostAtSea || 0) + 1; if (rnd(S) < 0.4 && g.fboats) g.fboats--; if (!S.firstLost || S.tick - S.firstLost > 360 * 6) { log(S, 'drown', `Лодка из «${g.name}» не возвращается с моря: ${m.name} не вернул${m.sex === 'f' ? 'ась' : 'ся'}`, g.landing.x, g.landing.y, g.hue, { first: !S.firstLost, why: seas === 0 ? 'Зимние шторма: в это время в море выходят только от голода.' : 'Море опасно и летом: лодку могло опрокинуть ветром.', who: [m.id], gs: [g.id] }); S.firstLost = S.tick; } removeAgent(S, m, 'drown'); }
    }
    sec.amt = Math.max(0, sec.amt - catchT * 0.55);
    g.treasury += catchT; S.stats.seaCatch = (S.stats.seaCatch || 0) + catchT;
  }
}
function seaRegen(S) { for (const sec of S.seaFish || []) sec.amt = Math.min(sec.cap, sec.amt + (sec.cap - sec.amt) * 0.035 + 1.5); }
function seaMonth(S) {
  seaRegen(S);
  while (S.waves && S.waves.length && S.waves[0] <= S.tick) { S.waves.shift(); landBoat(S, 6 + Math.floor(rnd(S) * 5), false); }
  if (S.tick % 360 === 180 && S.tick > 360 * 35 && popOf(S) < 420 && rnd(S) < 0.1) landBoat(S, 4 + Math.floor(rnd(S) * 4), false);
  // emigration: crowded, hungry or thirsty coastal villages send families away by boat
  if (S.tick % 360 !== 240) return;
  for (const g of S.groups.slice()) {
    if (!g.home || g.dead || g.members.length < 8 || g.wood < 6) continue;
    const hungryF = g.members.filter(id => { const m = S._a.get(id); return m && m.wealth < 0.3; }).length / g.members.length;
    const pressure = (1 - (g.room === undefined ? 1 : g.room)) * 0.6 + (g.thirst ? 0.5 : 0) + hungryF * 0.9 + (g.warsLost > (g.wl1 || 0) ? 0.2 : 0);
    g.wl1 = g.warsLost;
    if (pressure < 0.32 || rnd(S) > 0.35 * pressure) continue;
    const bs = beachNear(S, g.home.x, g.home.y, 260); if (!bs) continue;
    const mem = g.members.map(id => S._a.get(id)).filter(Boolean);
    const head = mem.filter(m => m.spouse && m.role !== 'leader' && m.age > 22 && m.age < 50).sort((a, b) => b.res - a.res)[0]; if (!head) continue;
    const fam = mem.filter(m => m === head || m.id === head.spouse || ((m.mother === head.id || m.father === head.id) && !m.spouse));
    if (fam.length < 2) continue;
    g.wood -= 8;
    const tx = `Уплывает с семьёй за море: в «${g.name}» ${g.thirst ? 'нет воды' : hungryF > 0.3 ? 'голодно' : 'тесно, свободной земли нет'}`;
    for (const m of fam) bio(S, m, 'emigr', tx);
    S.kids = (S.kids || []).filter(k => !fam.some(m => m.id === k.mo || m.id === k.fa));
    const d = Math.hypot(bs.x - S.isle.x, bs.y - S.isle.y) || 1;
    S.boats.push({ x0: bs.x, y0: bs.y, x1: bs.x + (bs.x - S.isle.x) / d * 160, y1: bs.y + (bs.y - S.isle.y) / d * 160, t: S.tick, out: true });
    S.stats.emigrated = (S.stats.emigrated || 0) + fam.length;
    log(S, 'emigr', `Семья ${head.name} уплывает из «${g.name}» искать новую землю`, bs.x, bs.y, g.hue, { first: !S.firstEmigr, why: sent([g.thirst ? 'в деревне нет воды' : hungryF > 0.3 ? `в деревне голодают ${Math.round(hungryF * 100)}%` : 'остров тесен: вокруг деревни не осталось свободной земли', `на лодку ушло дерево, а с острова — ${fam.length} ${pl(fam.length, 'человек', 'человека', 'человек')}`, 'кто уплыл, тот не вернётся: о них больше никто не услышит']), who: fam.map(m => m.id), gs: [g.id] });
    S.firstEmigr = true;
    for (const m of fam) removeAgent(S, m, 'emigr');
  }
}
function beachNear(S, x, y, R0) { let best = null, bd = R0; const ci = Math.floor(x / CS), cj = Math.floor(y / CS), r = Math.ceil(R0 / CS); for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) { if (i < 0 || j < 0 || i >= N || j >= N) continue; const c = j * N + i; if (S.ter[c] !== 'b') continue; const bx = i * CS + 10, by = j * CS + 10, d = Math.hypot(bx - x, by - y); if (d < bd && reach(S, x, y, bx, by)) { bd = d; best = { x: bx, y: by }; } } return best; }
function spawnBand(S, size, bx, by, kidsMax) {
  let made = 0; const band = [];
  for (let i = 0; i < size; i++) { const a = spawn(S, 'start'); a.x = clamp(bx + gauss(S) * 18, 10, 990); a.y = clamp(by + gauss(S) * 18, 10, 990); band.push(a); made++; }
  for (const a of band) for (const b of band) if (a !== b) a.trust[b.id] = 0.3 + rnd(S) * 0.15;
  const fs = band.filter(a => a.sex === 'f'), ms = band.filter(a => a.sex === 'm');
  for (let i = 0; i < Math.min(fs.length, ms.length); i++) if (rnd(S) < 0.75) { fs[i].spouse = ms[i].id; ms[i].spouse = fs[i].id; fs[i].trust[ms[i].id] = 0.8; ms[i].trust[fs[i].id] = 0.8; }
  if (band.length >= 3) { const L = band.slice().sort((p, q) => (q.ambition * 0.7 + q.skill * 0.3) - (p.ambition * 0.7 + p.skill * 0.3))[0]; const g = createGroup(S, L, band.filter(a => a !== L)); g.treasury = band.length * 7; }
  for (const a of band) if (a.spouse && a.sex === 'f' && rnd(S) < 0.6) { const n = 1 + Math.floor(rnd(S) * 3); for (let c = 0; c < n; c++) S.kids.push({ t: -Math.floor(rnd(S) * 360 * 12), mo: a.id, fa: a.spouse, g: null, sex: rnd(S) < 0.5 ? 'f' : 'm', x: a.x, y: a.y }); }
  return band;
}
function newWorld(seed, params) {
  const S = {
    seed, rng: seed | 0, tick: 0, nextId: 1, flashId: 1, hueI: 0,
    agents: [], groups: [], nodes: [], hostility: {}, alliances: [],
    events: [], flashes: [], drought: 0, kids: [], plague: null, ruins: [], occ: {},
    hist: { pop: [], groups: [], entropy: [], gini: [], big: [], gs: [], solo: [], pf: [], pw: [], ps: [], pt: [] }, arch: {},
    stats: { coups: 0, schisms: 0, conflicts: 0, merges: 0, reforms: 0, founded: 0, trades: 0, wars: 0, battles: 0, conquests: 0, revolts: 0, raids: 0 }, wars: [], truce: {}, warId: 1, price: { food: 1, wood: 1.5, stone: 2.5, tools: 6 }, routes: {},
    params: Object.assign({ scarcity: 0.5, inflow: 0.5, synergy: 0.5, memory: 0.5, ambition: 0.5, landPriv: 1, assembly: 1, coin: 1, usury: 1 }, params || {}), own: null, borders: {}
  };
  index(S);
  genTerrain(S);
  navInit(S);
  springsInit(S);
  let tries = 0;
  while (S.nodes.length < 16 && tries++ < 3000) {
    const x = 70 + rnd(S) * 860, y = 70 + rnd(S) * 860, t = S.ter[cellAt(x, y)];
    if (t === 'w' || t === 'h' || t === 's' || t === 'b') continue;
    if (S.nodes.every(n => Math.hypot(n.x - x, n.y - y) > 115)) S.nodes.push({ id: S.nextId++, x, y, amt: 40, cap: 55 + rnd(S) * 40 });
  }
  for (let t = 0; t < 600 && S.nodes.filter(n => n.kind === 'fish').length < 11; t++) {
    const c = Math.floor(rnd(S) * N * N); if (S.ter[c] !== 'b') continue; const x = (c % N) * CS + 10, y = ((c / N) | 0) * CS + 10;
    if (S.nodes.every(n => Math.hypot(n.x - x, n.y - y) > (n.kind === 'fish' ? 110 : 50))) S.nodes.push({ id: S.nextId++, x, y, amt: 50, cap: 60 + rnd(S) * 40, kind: 'fish' });
  }
  log(S, 'genesis', `Остров: ${S.nodes.filter(n => n.kind !== 'fish').length} диких угодий, ${S.nodes.filter(n => n.kind === 'fish').length} рыбных мест у берега, река, родники, лес и холмы. Людей пока нет`);
  // the first boats land on the island; more arrive over the first decades
  S.boats = []; S.waves = [];
  for (let k = 0; k < 5; k++) landBoat(S, 8 + Math.floor(rnd(S) * 4), true);
  for (let k = 0; k < 8; k++) S.waves.push(Math.floor(360 * (1 + rnd(S) * 34)));
  S.waves.sort((a, b) => a - b);
  return S;
}

function spawn(S, kind, o = {}) {
  const P = S.params;
  const a = {
    id: S.nextId++, name: mkName(S), x: 0, y: 0, age: 18 + rnd(S) * 22, life: 52 + rnd(S) * 28,
    skill: clamp(0.55 + gauss(S) * 0.35, 0.15, 1), ambition: clamp(P.ambition + gauss(S) * 0.4, 0, 1),
    coop: clamp(0.5 + gauss(S) * 0.45, 0, 1), norm: clamp(0.5 + gauss(S) * 0.5, 0, 1),
    energy: 0.7 + rnd(S) * 0.2, wealth: 3, status: 1, group: null, boss: null, role: null,
    trust: {}, res: 0, eff: 0, born: kind, joined: S.tick, tnode: null, xp: {},
    sex: rnd(S) < 0.5 ? 'f' : 'm', spouse: null, mother: null, father: null, rep: 0, ref: 3, patron: null
  };
  if (kind === 'start') { a.x = 60 + rnd(S) * 880; a.y = 60 + rnd(S) * 880; }
  else if (kind === 'child') {
    const p = o.parent, q = o.mother && o.father ? (p === o.mother ? o.father : o.mother) : null, g = o.g || (p ? S._g.get(p.group) : null);
    const mix = k => p ? (q ? (p[k] + q[k]) / 2 : p[k]) : 0.5;
    a.age = 15; a.wealth = 1; a.status = 0.5;
    a.skill = clamp(mix('skill') + gauss(S) * 0.25, 0.15, 1);
    a.ambition = clamp((mix('ambition') + P.ambition) / 2 + gauss(S) * 0.3, 0, 1);
    a.coop = clamp(mix('coop') + gauss(S) * 0.25, 0, 1);
    a.norm = clamp((g ? g.norm : mix('norm')) + gauss(S) * 0.15, 0, 1);
    a.x = (o.x !== undefined ? o.x : p.x) + gauss(S) * 20; a.y = (o.y !== undefined ? o.y : p.y) + gauss(S) * 20;
    a.mother = o.mother ? o.mother.id : null; a.father = o.father ? o.father.id : null; a.parent = p ? p.id : null;
    for (const par of [o.mother, o.father]) if (par) { a.trust[par.id] = 0.6; par.trust[a.id] = 0.5; }
  } else {
    const side = Math.floor(rnd(S) * 4), t = 40 + rnd(S) * 920;
    if (o.side !== undefined) { a.x = o.side === 0 ? 980 : 20; a.y = 300 + rnd(S) * 400; }
    else if (side < 2) { a.x = side ? 990 : 10; a.y = t; } else { a.x = t; a.y = side === 2 ? 10 : 990; }
    if (o.culture) Object.assign(a, o.culture(a));
  }
  S.agents.push(a); S._a.set(a.id, a);
  if (kind === 'child') { const g = (o.g && S._g.has(o.g.id) && !o.g.dead) ? o.g : o.parent ? S._g.get(o.parent.group) : null; if (g) { a.trust[g.leader] = (a.trust[g.leader] || 0) + 0.3; join(S, a, g, o.parent && o.parent.group === g.id ? o.parent.id : g.leader); } }
  return a;
}

function join(S, a, g, boss) {
  const pg = a.group;
  if (a.group) leave(S, a, 'move');
  if (pg && pg !== g.id && S.tick > 0) bio(S, a, 'move', `Переходит из «${groupName(S, pg)}» в «${g.name}»`);
  if (!S._g.has(g.id)) return;
  a.group = g.id; a.boss = boss && S._a.has(boss) ? boss : g.leader; a.role = 'member';
  a.joined = S.tick; a.res *= 0.3; g.members.push(a.id);
}

function leave(S, a, why) {
  a.car = null; a.war = null; a.load = 0; a.haul = false; a.lk = null;
  const g = S._g.get(a.group);
  if (g && g.land === 'private') {
    const heir = g.members.map(id => S._a.get(id)).filter(m => m && m !== a && (m.mother === a.id || m.father === a.id)).sort((x, y) => y.age - x.age)[0];
    for (const f of g.fields) if (f.owner === a.id) f.owner = heir ? heir.id : (g.leader !== a.id ? g.leader : null);
  }
  a.group = null; a.boss = null; a.role = null;
  if (!g) return;
  g.members = g.members.filter(id => id !== a.id);
  for (const id of g.members) { const m = S._a.get(id); if (m.boss === a.id) m.boss = g.leader; }
  if (g.leader === a.id) succession(S, g, why, a);
  else if (g.members.length < 2) dissolve(S, g);
}

function dissolve(S, g, silent) {
  if (g.dead) return;
  g.dead = true;
  if (S.arch && S.arch[g.id]) S.arch[g.id].end = S.tick;
  if (g.home) {
    S.ruins = S.ruins || [];
    S.ruins.push({ name: g.name, t: S.tick, x: g.home.x, y: g.home.y, houses: g.houses.concat([g.workshop, g.granary].filter(Boolean)).map(h => ({ x: h.x, y: h.y })), fields: g.fields.map(f => ({ x: f.x, y: f.y })), plan: g.plan || null });
    if (S.ruins.length > 14) S.ruins.shift();
    for (const f of g.fields) delete S.occ[f.c];
    if (S.own) for (let c = 0; c < S.own.length; c++) if (S.own[c] === g.id) S.own[c] = 0;
    if (g.site && g.site.c !== undefined) delete S.occ[g.site.c];
  }
  const share = g.treasury / Math.max(1, g.members.length);
  for (const id of g.members) { const m = S._a.get(id); if (m) { m.group = null; m.boss = null; m.role = null; m.wealth += share; } }
  g.members = [];
  S.groups = S.groups.filter(x => x !== g); S._g.delete(g.id);
  S.alliances = S.alliances.filter(al => al.a !== g.id && al.b !== g.id);
  for (const k of Object.keys(S.hostility)) { const [p, q] = k.split('|'); if (+p === g.id || +q === g.id) delete S.hostility[k]; }
  if (!silent && S.tick - g.founded > 360) log(S, 'collapse', `«${g.name}» распадается спустя ${yrs(Math.round((S.tick - g.founded) / 360))}`, g.cx, g.cy, g.hue, { why: 'В группе осталось меньше двух человек: остальные ушли, умерли или перебежали к соседям.', gs: [g.id] });
}

function createGroup(S, L, others, parent) {
  const eg = L.norm > 0.5;
  const hue = (S.hueI * 137.508 + 15) % 360; S.hueI++;
  const g = {
    id: S.nextId++, name: `${pick(S, eg ? T_EG : T_HI)} ${L.name}`, hue, leader: L.id, founder: L.name, founded: S.tick,
    members: [], treasury: 0, norm: L.norm, take: clamp(0.06 + 0.32 * L.ambition * (1 - 0.6 * L.norm), 0.04, 0.4),
    bureau: 0, entropy: 0, depth: 1, maxDepth: 1, cx: L.x, cy: L.y, target: null, cool: 0, gen: 1, legit: 0.7, pay: 1, avoid: {},
    home: null, houses: [], fields: [], wood: 0, site: null, woodCell: null, stone: 0, tools: 0, stoneCell: null, workshop: null, granary: null, walls: false, lord: null, raided: -1e9, faith: null, shrine: null, dynasty: false, dynName: null, dynGen: 0, code: null, trauma: 0, trades: 0, warsWon: 0, warsLost: 0, reforms: 0, rhist: [], rtype: null, since: S.tick, terr: 0, land: 'common', gov: 'chief', coupCount: 0, bcells: []
  };
  S.groups.push(g); S._g.set(g.id, g); S.stats.founded++;
  S.arch = S.arch || {};
  S.arch[g.id] = { name: g.name, hue, founded: S.tick, end: null, parent: parent || null, into: null };
  const prevG = L.group;
  if (L.group) leave(S, L, 'move');
  L.group = g.id; L.role = 'leader'; L.boss = null; L.joined = S.tick; L.res = 0; g.members.push(L.id);
  if (S.tick > 0 && others.length >= 2) { L.bioL = g.id; bio(S, L, parent ? 'schism' : 'found', parent ? `Уходит из «${groupName(S, parent)}» и основывает «${g.name}», за ${L.sex === 'f' ? 'ней' : 'ним'} идут ${others.length}` : `Основывает «${g.name}»`); }
  for (const o of others) { if (o.id !== L.id && S._a.has(o.id)) join(S, o, g, L.id); }
  pickTarget(S, g);
  return g;
}

function setLeader(S, g, W) {
  const old = S._a.get(g.leader);
  if (old && old.group === g.id) { old.role = 'member'; old.boss = W.id; }
  g.leader = W.id; W.role = 'leader'; W.boss = null; g.since = S.tick;
  if ((!W.bioL || W.bioL !== g.id) && g.members.length >= 5) { W.bioL = g.id; bio(S, W, 'leader', `Становится вождём «${g.name}»${old && old !== W ? ` вместо ${old.name}` : ''}`); }
  g.norm = g.norm * 0.6 + W.norm * 0.4;
  for (const id of g.members) { const m = S._a.get(id); if (m.id !== W.id && (m.boss === null || !S._a.has(m.boss))) m.boss = W.id; }
  restructure(S, g);
}

const VERB = { death: 'уходит из жизни', burnout: 'истощается и уходит', move: 'покидает группу', vanish: 'внезапно исчезает', war: 'погибает в бою' };
function succession(S, g, why, old) {
  if (g.members.length < 2) { dissolve(S, g); return; }
  const mem = g.members.map(id => S._a.get(id));
  if (g.dynasty) {
    const heirs = mem.filter(m => (m.father === old.id || m.mother === old.id || m.parent === old.id) && m.age >= 15).sort((a, b) => b.age - a.age);
    if (heirs.length) {
      const W = heirs[0]; W.bioL = g.id; bio(S, W, 'heir', `По праву рождения наследует власть ${old.sex === 'f' ? 'матери' : 'отца'} ${old.name} в «${g.name}»`); g.leader = -1; setLeader(S, g, W); g.gen++; g.dynGen++; g.legit = 0.7;
      const weak = W.skill < 0.45;
      log(S, 'succession', `${old.name} ${VERB[why] || 'уходит'}. По праву рождения «${g.name}» наследует ${W.name}, ${g.dynGen}-е поколение династии ${g.dynName}`, W.x, W.y, g.hue, { why: sent(['в группе действует закон о наследовании, поэтому выборов нет', `наследнику ${Math.floor(W.age)} лет`, weak ? `способности средние (навык ${P0(W.skill)}): сильные соперники могут не смириться` : `навык ${P0(W.skill)}`]), who: [W.id], gs: [g.id] });
      return;
    }
  }
  const pw = m => m.status * (0.5 + m.ambition) * (m.job === 'pray' ? 1.6 : 1);
  const cands = mem.slice().sort((a, b) => pw(b) - pw(a)).slice(0, 3);
  const votes = new Map(cands.map(c => [c.id, 0]));
  for (const m of mem) {
    let best = cands[0], bv = -9;
    for (const c of cands) { const v = (c.id === m.id ? 0.4 : (m.trust[c.id] || 0)) + c.status * 0.01 + 0.25 * (c.rep || 0) + (kin(m, c) ? 0.3 : 0); if (v > bv) { bv = v; best = c; } }
    votes.set(best.id, votes.get(best.id) + (m.age > 55 ? 1.5 : 1));
  }
  const ranked = cands.slice().sort((a, b) => votes.get(b.id) - votes.get(a.id));
  const W = ranked[0], share = votes.get(W.id) / mem.length;
  g.leader = -1; setLeader(S, g, W); g.gen++; g.legit = clamp(share, 0.2, 1);
  if (W.job === 'pray') { W.wasPriest = true; g.priestRule = true; } else g.priestRule = false;
  if (g.dynasty) { g.dynasty = false; g.dynName = null; if (g.gov === 'monarch') g.gov = 'chief'; }
  const lead = `${old.name} ${VERB[why] || 'уходит'}`;
  const R = ranked[1];
  if (R && share < 0.5 && R.ambition > 0.5 && mem.length >= 6) {
    const sup = mem.filter(m => m !== W && m !== R && (m.trust[R.id] || 0) > (m.trust[W.id] || 0));
    if (sup.length >= 4) {
      const ng = createGroup(S, R, sup, g.id);
      S.hostility[key(g.id, ng.id)] = 0.7; S.stats.schisms++;
      log(S, 'crisis', `${lead}. Кризис преемственности в «${g.name}»: власть берёт ${W.name}, а ${R.name} уводит ${sup.length} ${one(sup.length) ? 'сторонника' : 'сторонников'} в «${ng.name}»`, W.x, W.y, g.hue, { why: sent([`${W.name} получает только ${P0(share)} голосов`, `${R.name} с амбициями ${P0(R.ambition)} не признаёт итог`, `за ним те, кто доверяет ему больше, чем новому лидеру`]), who: [W.id, R.id, ...sup.map(m => m.id)], gs: [g.id, ng.id] });
      return;
    }
  }
  log(S, 'succession', `${lead}. «${g.name}» возглавляет ${W.name}${g.gen > 2 ? `, ${g.gen}-й лидер со времён ${g.founder}` : ''}`, W.x, W.y, g.hue, { why: sent([`${W.name} набирает ${P0(share)} голосов`, share > 0.6 ? 'сильный мандат' : share < 0.4 ? 'мандат слабый, недовольство может вырасти' : '']), who: [W.id], gs: [g.id] });
}

function restructure(S, g) {
  const L = S._a.get(g.leader); if (!L) return;
  const span = 4 + Math.round(L.coop * 3) + (g.cool > S.tick ? 2 : 0);
  const rest = g.members.filter(id => id !== L.id).map(id => S._a.get(id)).sort((a, b) => b.status - a.status);
  for (const m of rest) m.role = 'member';
  let layer = [L], depth = 1, i = 0;
  const load = new Map();
  while (i < rest.length) {
    const chunk = rest.slice(i, i + layer.length * span); i += chunk.length;
    for (const m of chunk) {
      let best = null, bv = -9;
      for (const b of layer) { if ((load.get(b.id) || 0) >= span) continue; const v = m.trust[b.id] || 0; if (v > bv) { bv = v; best = b; } }
      m.boss = best.id; load.set(best.id, (load.get(best.id) || 0) + 1);
    }
    for (const b of layer) if (b !== L && load.get(b.id)) b.role = 'lt';
    layer = chunk; depth++;
  }
  g.depth = depth;
  if (depth > g.maxDepth) {
    g.maxDepth = depth;
    if (depth === 3) log(S, 'milestone', `В «${g.name}» появляется средний менеджмент: ${g.members.length} человек уже не помещаются под одним лидером`, L.x, L.y, g.hue, { why: `Лидер ${L.name} напрямую управляет не больше чем ${span} людьми, поэтому самые статусные становятся начальниками. Каждый новый уровень добавляет группе энтропии.`, who: [L.id], gs: [g.id] });
    if (depth === 4) log(S, 'milestone', `«${g.name}» отращивает четвёртый уровень управления`, L.x, L.y, g.hue, { why: `Группа выросла до ${g.members.length} человек. Информация теперь проходит четыре ступени и искажается на каждой.`, who: [L.id], gs: [g.id] });
  }
}

function pickTarget(S, g) {
  let best = null, bv = -1;
  for (const n of S.nodes) {
    const o = g.home || { x: g.cx, y: g.cy };
    let v = (n.amt + 5) / (1 + Math.hypot(n.x - o.x, n.y - o.y) / 110);
    if ((g.avoid[n.id] || 0) > S.tick) v *= 0.15;
    if (!usable(S, cellAt(n.x, n.y), g)) v *= 0.25;
    if (n.id === g.target) v *= 1.8;
    if (!reach(S, o.x, o.y, n.x, n.y)) v *= 0.05;
    v /= 1 + 0.3 * S.groups.filter(o => o !== g && o.target === n.id).length;
    if (v > bv) { bv = v; best = n; }
  }
  g.target = best ? best.id : null;
}

const N = 50, CS = 20;
const seasonOf = t => Math.floor((t % 360) / 90);
const cellAt = (x, y) => clamp(Math.floor(y / CS), 0, N - 1) * N + clamp(Math.floor(x / CS), 0, N - 1);
function genTerrain(S) {
  const grid = () => { const a = []; for (let i = 0; i < 64; i++) a.push(rnd(S)); return a; };
  const E1 = grid(), E2 = grid(), M1 = grid();
  const sm = t => t * t * (3 - 2 * t);
  const vn = (A, u, v, f) => { const gx = u * f, gy = v * f, ix = Math.floor(gx), iy = Math.floor(gy), fx = sm(gx - ix), fy = sm(gy - iy), at = (i, j) => A[(j % 8) * 8 + (i % 8)]; const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
  // island: coastline radius varies with angle
  const ph = [rnd(S) * 6.28, rnd(S) * 6.28, rnd(S) * 6.28], amp = [40 + rnd(S) * 40, 25 + rnd(S) * 30, 15 + rnd(S) * 20], cx0 = 500 + gauss(S) * 15, cy0 = 500 + gauss(S) * 15;
  const RAD = (x, y) => { const a = Math.atan2(y - cy0, x - cx0); return 430 + amp[0] * Math.sin(2 * a + ph[0]) + amp[1] * Math.sin(3 * a + ph[1]) + amp[2] * Math.sin(5 * a + ph[2]); };
  S.isle = { x: cx0, y: cy0 };
  const sea = (x, y) => Math.hypot(x - cx0, y - cy0) > RAD(x, y) + (vn(E2, x / 1000, y / 1000, 6) - 0.5) * 50;
  // river: from the highlands near the centre down to the sea
  const pts = []; let x = cx0 + gauss(S) * 90, dx = 0, src = cy0 - 140 - rnd(S) * 80, mouth = null;
  for (let y = -20; y <= 1020; y += 20) {
    if (y < src || mouth !== null) { pts.push([-10000, y]); continue; }
    dx = dx * 0.82 + gauss(S) * 10; x = clamp(x + dx, 160, 840); pts.push([Math.round(x), y]);
    if (sea(x, y + 20)) mouth = y;
  }
  S.river = pts; S.riverSrc = src;
  let ter = ''; const wood = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const cx = i * CS + 10, cy = j * CS + 10, u = i / N, v = j / N;
    const rr = Math.hypot(cx - cx0, cy - cy0) / RAD(cx, cy), inl = clamp(1 - rr, 0, 1);
    const el = vn(E1, u, v, 3) * 0.6 + vn(E2, u, v, 7) * 0.32 + inl * 0.14, mo = vn(M1, u, v, 4);
    const rx = pts[clamp(Math.round((cy + 20) / 20), 0, pts.length - 1)][0], dr = Math.abs(cx - rx);
    let t = 'g';
    if (sea(cx, cy)) t = 's';
    else if (dr < 15) t = 'w'; else if (el > 0.66 && dr > 50) t = 'h'; else if (mo > 0.57 && dr > 45) t = 'f'; else if ((dr < 110 && el < 0.62) || el < 0.36) t = 'r';
    ter += t; wood.push(t === 'f' ? 60 : 0);
  }
  // beaches: land next to sea
  const T = ter.split('');
  for (let c = 0; c < N * N; c++) { if (T[c] === 's' || T[c] === 'w') continue; const ci = c % N, cj = (c / N) | 0; let sea1 = false; for (const [dx2, dy2] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = (cj + dy2) * N + ci + dx2; if (ci + dx2 < 0 || cj + dy2 < 0 || ci + dx2 >= N || cj + dy2 >= N || T[q] === 's') sea1 = true; } if (sea1) { T[c] = 'b'; wood[c] = 0; } }
  S.ter = T.join(''); S.wood = wood;
}
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
function aStar(S, c0, c1) {
  if (c0 === c1) return [c0];
  if (!passCost(S, c1) || !passCost(S, c0) && S.ter[c0] === 'w' && !S.frozen && !S.ford[c0] && !S.bridge[c0]) { if (!passCost(S, c1)) return null; }
  const NN = N * N, gS = S._gS || (S._gS = new Float64Array(NN)), from = S._from || (S._from = new Int32Array(NN)), seen = S._seen || (S._seen = new Int32Array(NN));
  S._stamp = (S._stamp || 0) + 1; const stamp = S._stamp;
  const tx = c1 % N, ty = (c1 / N) | 0, h = c => { const dx = Math.abs(c % N - tx), dy = Math.abs(((c / N) | 0) - ty); return (Math.max(dx, dy) + 0.414 * Math.min(dx, dy)) * 0.5; };
  const heap = [], hf = [];
  const push = (c, f) => { heap.push(c); hf.push(f); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; [hf[p], hf[i]] = [hf[i], hf[p]]; i = p; } };
  const pop = () => { const top = heap[0], lc = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = lc; hf[0] = lf; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && hf[l] < hf[m]) m = l; if (r < heap.length && hf[r] < hf[m]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; [hf[m], hf[i]] = [hf[i], hf[m]]; i = m; } } return top; };
  seen[c0] = stamp; gS[c0] = 0; from[c0] = -1; push(c0, h(c0));
  const closed = S._closed || (S._closed = new Int32Array(NN));
  let it = 0;
  while (heap.length && it++ < 6000) {
    const c = pop(); if (closed[c] === stamp) continue; closed[c] = stamp;
    if (c === c1) { const out = []; for (let q = c; q !== -1; q = from[q]) out.push(q); return out.reverse(); }
    const cx = c % N, cy = (c / N) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const nc = ny * N + nx, k = passCost(S, nc); if (!k) continue;
      if (dx && dy && (!passCost(S, cy * N + nx) || !passCost(S, ny * N + cx))) continue;
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
    const y = j * CS + 10, x = (ws[0] % N) * CS + 10, d = Math.hypot(x - g.home.x, y - g.home.y);
    if (d > 320) continue;
    let near = false; for (const c in S.bridge) if (Math.abs(((+c / N) | 0) - j) < 6) near = true;
    if (near) continue;
    const v = -ws.length * 60 - d / 4 + (S.road[ws[0] - 1] || 0) * 20 + (S.road[ws[ws.length - 1] + 1] || 0) * 20;
    if (v > bv) { const side = g.home.x < x ? -1 : 1, bi = side < 0 ? (ws[0] % N) - 1 : (ws[ws.length - 1] % N) + 1; bv = v; best = { kind: 'bridge', cells: ws, x: bi * CS + 10, y, prog: 0, need: 120 + ws.length * 40 }; }
  }
  return best;
}
function planOf(S, g) {
  if (g.plan) return g.plan;
  let ang;
  if (riverDist(S, g.home.x, g.home.y) < 220) ang = Math.PI / 2 + gauss(S) * 0.25;
  else { const fc = nearestForest(S, g.home, g); ang = fc !== null ? Math.atan2(Math.floor(fc / N) * CS + 10 - g.home.y, (fc % N) * CS + 10 - g.home.x) : rnd(S) * Math.PI; }
  g.plan = { ux: Math.cos(ang), uy: Math.sin(ang), k: 0 };
  return g.plan;
}
function plotPos(g, k) {
  const P = g.plan, street = k < 32 ? 0 : 1, kk = street ? k - 32 : k, slot = (kk >> 2) + 1, dir = (kk >> 1) & 1 ? -1 : 1, side = kk & 1 ? -1 : 1;
  const ux = street ? -P.uy : P.ux, uy = street ? P.ux : P.uy, along = dir * (slot * 17 - 4) + (street ? 0 : 0), perp = side * 12, off = street ? 26 : 0;
  return { x: g.home.x + ux * along - uy * perp + (street ? P.ux * off : 0), y: g.home.y + uy * along + ux * perp + (street ? P.uy * off : 0) };
}
function plotOk(S, g, p) {
  if (p.x < 12 || p.y < 12 || p.x > 988 || p.y > 988) return false;
  const t = S.ter[cellAt(p.x, p.y)]; if (t === 'w' || t === 'h' || t === 's' || riverDist(S, p.x, p.y) < 24) return false;
  for (const h of g.houses) if (Math.hypot(h.x - p.x, h.y - p.y) < 11) return false;
  for (const b of [g.workshop, g.granary, g.shrine]) if (b && Math.hypot(b.x - p.x, b.y - p.y) < 14) return false;
  return true;
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
function settle(S, g) {
  const L = S._a.get(g.leader), o = { x: g.cx, y: g.cy };
  let best = null, bv = -1e9, info = null;
  for (const r of S.ruins || []) {
    if (S.tick - r.t > 360 * 40 || !r.houses.length || Math.hypot(r.x - o.x, r.y - o.y) > 380) continue;
    if (S.groups.some(h => h !== g && h.home && Math.hypot(h.home.x - r.x, h.home.y - r.y) < 130)) continue;
    if (!reach(S, o.x, o.y, r.x, r.y)) continue;
    const v = 18 + r.houses.length * 5 + r.fields.length * 2 - Math.hypot(r.x - o.x, r.y - o.y) / 40;
    if (v > bv) { bv = v; best = r; }
  }
  if (best && rnd(S) < 0.85) {
    const r = best; S.ruins = S.ruins.filter(x => x !== r);
    g.home = { x: r.x, y: r.y }; g.cx = r.x; g.cy = r.y;
    g.houses = r.houses.slice(0, 16).map(h => ({ x: h.x, y: h.y, ruined: true }));
    for (const f of r.fields) { const c = cellAt(f.x, f.y); if (S.occ[c] || (S.own && S.own[c])) continue; S.occ[c] = g.id; g.fields.push({ x: f.x, y: f.y, c, fert: S.ter[c] === 'r' ? 0.9 : 0.55 }); }
    if (r.plan) g.plan = Object.assign({}, r.plan);
    claim(S, g, 20, 20); pickTarget(S, g);
    S.settledOnce = true;
    log(S, 'settle', `«${g.name}» занимает заброшенную деревню «${r.name}» и чинит дома`, r.x, r.y, g.hue, { why: sent([`деревня пустует ${yrs(Math.max(1, Math.round((S.tick - r.t) / 360)))}`, `там стоят ${g.houses.length} ${pl(g.houses.length, 'дом', 'дома', 'домов')} без крыш${g.fields.length ? ` и ${g.fields.length} ${pl(g.fields.length, 'заросшее поле', 'заросших поля', 'заросших полей')}` : ''}`, 'починить старый дом вдвое быстрее, чем построить новый', 'место уже проверено: здесь когда-то жили']), gs: [g.id] });
    return;
  }
  best = null; bv = -1e9;
  for (let t = 0; t < 140; t++) {
    const x = clamp(o.x + gauss(S) * 260, 40, 960), y = clamp(o.y + gauss(S) * 260, 40, 960);
    const c = cellAt(x, y), tt = S.ter[c]; if (tt === 'w' || tt === 'h' || tt === 's' || tt === 'b' || riverDist(S, x, y) < 45) continue;
    let fert = 0, forest = 0, water = 0;
    const ci = c % N, cj = Math.floor(c / N);
    for (let dj = -6; dj <= 6; dj++) for (let di = -6; di <= 6; di++) {
      const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= N || j >= N) continue;
      const q = S.ter[j * N + i], dd = di * di + dj * dj;
      if (dd <= 25 && q === 'r' && !S.occ[j * N + i]) fert++; if (dd <= 36 && q === 'f') forest++; if (dd <= 9 && q === 'w') water++;
    }
    let near = 1e9; for (const h of S.groups) if (h !== g && h.home) near = Math.min(near, Math.hypot(h.home.x - x, h.home.y - y));
    let wd = riverDist(S, x, y) - 22; for (const sp of S.springs || []) wd = Math.min(wd, Math.hypot(sp.x - x, sp.y - y));
    const v = fert * 1.6 + Math.min(forest, 20) * 0.8 + (water ? 8 : 0) - (near < 170 ? 40 : near < 260 ? 10 : 0) - Math.hypot(x - o.x, y - o.y) / 40 - Math.max(0, wd - 60) / 12;
    if (v > bv) { bv = v; best = { x, y }; info = { fert, forest, water, near }; }
  }
  if (!best || !reach(S, o.x, o.y, best.x, best.y)) return;
  g.home = best; g.cx = best.x; g.cy = best.y; planOf(S, g);
  claim(S, g, 20, 20);
  pickTarget(S, g);
  const first = !S.settledOnce; S.settledOnce = true;
  log(S, 'settle', first ? `Первое поселение в мире: «${g.name}» перестаёт кочевать${info.water ? ' и оседает у реки' : ''}` : `«${g.name}» основывает поселение${info.water ? ' у реки' : ''}`, best.x, best.y, g.hue, { first, why: sent([info.fert ? `рядом ${info.fert} клеток плодородной земли под поля` : 'плодородной земли мало, придётся жить собирательством', info.forest ? `лес в шаге: ${info.forest} клеток на брёвна` : 'леса рядом нет, брёвна носить издалека', info.water ? 'вода под боком' : '', info.near < 1e8 ? `ближайшие соседи в ${cells(info.near)}` : 'соседей поблизости нет']), who: [L.id], gs: [g.id] });
}
function houseSpot(S, g) {
  const P = planOf(S, g);
  for (let t = 0; t < 64; t++) { const p = plotPos(g, P.k); P.k++; if (P.k > 63) P.k = 0; if (plotOk(S, g, p)) return { kind: 'house', x: p.x, y: p.y, prog: 0, need: 50 }; }
  const k = g.houses.length, p = dryRing(S, g.home.x, g.home.y, k * 2.39996 + 0.6, 18 + 10 * Math.sqrt(k));
  return { kind: 'house', x: p.x, y: p.y, prog: 0, need: 50 };
}
function fieldSpot(S, g) {
  const hc = cellAt(g.home.x, g.home.y), ci = hc % N, cj = Math.floor(hc / N);
  let best = null, bv = -1e9;
  for (let dj = -8; dj <= 8; dj++) for (let di = -8; di <= 8; di++) {
    const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= N || j >= N) continue;
    const c = j * N + i, t = S.ter[c]; if ((t !== 'r' && t !== 'g') || S.occ[c] || (S.own && S.own[c] && S.own[c] !== g.id)) continue;
    const x = i * CS + 10, y = j * CS + 10, d = Math.hypot(x - g.home.x, y - g.home.y);
    if (riverDist(S, x, y) < 28) continue;
    if (d < 48 || d > 170) continue;
    let adj = 0; for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = c + ox + oy * N; if (S.occ[q] === g.id) adj++; }
    const fert = t === 'r' ? 1 : 0.6, v = fert * 2 - d / 110 + adj * 0.45 - (S.road[c] ? 1 : 0);
    if (v > bv) { bv = v; best = { kind: 'field', x, y, c, fert, prog: 0, need: 40 }; }
  }
  if (best) { S.occ[best.c] = g.id; if (S.own) S.own[best.c] = g.id; best.owner = g.land === 'private' ? g.leader : null; }
  return best;
}
function finishSite(S, g) {
  const st = g.site; g.site = null;
  if (st.kind === 'house') {
    g.houses.push({ x: st.x, y: st.y });
    const k = g.houses.length;
    if (k === 5 || k === 10 || k === 15) log(S, 'milestone', `Поселение «${g.name}» разрастается до ${k} домов`, g.home.x, g.home.y, g.hue, { why: `В группе ${g.members.length} человек, под крышей могут зимовать ${k * 4}. Каждый дом — это 6 брёвен из леса и месяцы работы строителей.`, gs: [g.id] });
  } else if (st.kind === 'workshop') {
    g.workshop = { x: st.x, y: st.y };
    const first = !S.firstWorkshop; S.firstWorkshop = true;
    log(S, 'tech', first ? `Первая мастерская в мире: «${g.name}» начинает делать орудия` : `«${g.name}» строит мастерскую`, st.x, st.y, g.hue, { first, why: `Камень с холмов и брёвна из леса превращаются в орудия. С орудием любая работа идёт на половину быстрее, но орудия изнашиваются, и камень с деревом нужны постоянно. Холмы у «${g.name}» в ${cells(g.stoneDist)} от поселения.`, gs: [g.id] });
  } else if (st.kind === 'walls') {
    g.walls = true;
    log(S, 'tech', `«${g.name}» обносит поселение частоколом`, g.home.x, g.home.y, g.hue, { why: sent([`угроза от соседей ${P0(Math.min(1, g.threat || 0))}`, S.tick - g.raided < 720 ? 'недавно был набег' : '', 'частокол усиливает оборону в 1,7 раза, но стоит 12 брёвен и месяцы работы']), gs: [g.id] });
  } else if (st.kind === 'shrine') {
    g.shrine = { x: st.x, y: st.y };
    S.faiths = S.faiths || {};
    const partner = S.groups.find(o => o !== g && o.faith && o.home && (S.routes[key(o.id, g.id)] || (S.hostility[key(o.id, g.id)] || 0) < 0.2 && Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y) < 300));
    const why0 = sent([g.famY !== undefined ? 'голодные зимы' : '', g.warsLost ? 'проигранные битвы' : '', 'люди ищут смысл в бедах', 'святилище утешает: обиды копятся на треть медленнее, а лидер выглядит законнее', 'жрец кормится подношениями']);
    if (!g.faith && partner && rnd(S) < 0.6) {
      g.faith = partner.faith; const fn = S.faiths[g.faith];
      log(S, 'faith', `«${g.name}» ставит святилище и принимает ${fn.name} от соседей из «${partner.name}»`, st.x, st.y, fn.hue, { why: why0, gs: [g.id, partner.id] });
    } else if (!g.faith) {
      const nearRiver = riverDist(S, g.home.x, g.home.y) < 120, h = nearestHill(S, g.home), fc = nearestForest(S, g.home);
      const kind = nearRiver ? 'культ Реки' : h.d < 150 ? 'культ Горы' : fc !== null && Math.hypot((fc % N) * CS - g.home.x, Math.floor(fc / N) * CS - g.home.y) < 80 ? 'культ Леса' : (g.warsWon > g.warsLost ? 'культ Огня' : 'культ Предков');
      const same = Object.values(S.faiths).filter(f => f.base === kind).length;
      const id = 'f' + (Object.keys(S.faiths).length + 1);
      S.faiths[id] = { name: same ? `${kind} (${['северный', 'новый', 'южный', 'истинный', 'старый'][same % 5]})` : kind, base: kind, hue: (g.hue + 180) % 360, founded: S.tick, by: g.id, usury: rnd(S) < 0.4 ? 'ban' : 'ok' };
      g.faith = id;
      const first = !S.firstFaith; S.firstFaith = true;
      log(S, 'faith', first ? `Первая вера в мире: в «${g.name}» рождается ${S.faiths[id].name}` : `В «${g.name}» рождается ${S.faiths[id].name}`, st.x, st.y, S.faiths[id].hue, { first, why: why0 + ` Чему поклоняться, подсказывает место: ${nearRiver ? 'река рядом кормит и топит' : h.d < 150 ? 'над деревней нависают холмы' : 'деревню окружает лес'}.`, gs: [g.id] });
    }
  } else if (st.kind === 'bridge') {
    for (const c of st.cells) S.bridge[c] = g.id; S.navV++; g.bridgeAt = S.tick;
    const first = !S.firstBridge; S.firstBridge = true;
    log(S, 'bridge', first ? `Первый мост в мире: «${g.name}» перекидывает мост через реку` : `«${g.name}» строит мост через реку`, st.x, st.y, g.hue, { first, why: sent([`за год жители ${g.cross12 || 0} ${pl(g.cross12 || 0, 'раз', 'раза', 'раз')} переходили реку вброд или по льду`, g.drowned ? `${g.drowned} ${pl(g.drowned, 'человек утонул', 'человека утонули', 'человек утонули')}` : 'брод опасен, особенно в половодье', 'мост — это брёвна и месяцы работы, зато по нему ходят без риска и вдвое быстрее', 'теперь по мосту пойдут и чужие: торговцы и войска']), gs: [g.id] });
  } else if (st.kind === 'fboat') {
    g.fboats = (g.fboats || 0) + 1;
    if (!S.firstFboat) { S.firstFboat = true; log(S, 'tech', `Первая рыбацкая лодка: «${g.name}» выходит в море`, st.x, st.y, g.hue, { first: true, why: 'Рыба у берега быстро кончается, а в море её больше. На лодке двое рыбаков ловят за день столько, сколько с берега за неделю. Но море опасно: в шторм лодки не возвращаются.', gs: [g.id] }); }
  } else if (st.kind === 'well') {
    const ok = rnd(S) < wellOk(S, st.x, st.y);
    if (ok) { g.well = { x: st.x, y: st.y, t: S.tick, depth: wellOk(S, st.x, st.y) > 0.9 ? 1 : 0.5, dry: false }; }
    const first = ok && !S.firstWell; if (ok) S.firstWell = true;
    log(S, 'well', ok ? (first ? `Первый колодец в мире: «${g.name}» копает свой колодец` : `«${g.name}» копает колодец`) : `«${g.name}» копает колодец, но до воды не докапывается`, st.x, st.y, g.hue, { first, why: sent([`до воды ${Math.round(g.wd || 0)} шагов: каждый день ${g.wNeed || 0} ${pl(g.wNeed || 0, 'человек', 'человека', 'человек')} только носят воду`, ok ? 'теперь вода прямо в деревне, и руки освобождаются для полей' : 'здесь глубоко до воды: в низине у реки копать легче', ok && wellOk(S, st.x, st.y) < 0.9 ? 'колодец неглубокий и в засуху может пересохнуть' : '']), gs: [g.id] });
  } else if (st.kind === 'repair') {
    const hh = g.houses[st.idx]; if (hh) hh.ruined = false;
  } else if (st.kind === 'granary') {
    g.granary = { x: st.x, y: st.y };
    const first = !S.firstGranary; S.firstGranary = true;
    log(S, 'tech', first ? `Первый амбар в мире: «${g.name}» учится хранить урожай` : `«${g.name}» строит амбар`, st.x, st.y, g.hue, { why: `Без амбара запасы гниют: полтора процента в месяц. В амбаре — в пять раз медленнее, и урожай доживает до весны. В «${g.name}» скопилось ${Math.round(g.treasury)} еды.`, gs: [g.id] });
  } else g.fields.push({ x: st.x, y: st.y, c: st.c, fert: st.fert });
}
function nearestHill(S, p, g) {
  let best = null, bd = 1e9;
  for (let c = 0; c < S.ter.length; c++) { if (S.ter[c] !== 'h' || !usable(S, c, g)) continue; const d = Math.hypot((c % N) * CS + 10 - p.x, Math.floor(c / N) * CS + 10 - p.y); if (d < bd) { bd = d; best = c; } }
  return bd < 360 ? { c: best, d: bd } : { c: null, d: bd };
}
function specialSpot(S, g, kind) {
  const P = planOf(S, g), cand = kind === 'granary' ? [[0, 22], [0, -22], [8, 24]] : kind === 'workshop' ? [[0, -24], [0, 24], [-8, -26]] : [[1, 0], [-1, 0]];
  for (const [a, b] of cand) {
    const along = kind === 'shrine' ? a * (Math.max(2, Math.ceil(g.houses.length / 4)) * 17 + 14) : a, q = { x: g.home.x + P.ux * along - P.uy * b, y: g.home.y + P.uy * along + P.ux * b };
    if (plotOk(S, g, q)) return { kind, x: q.x, y: q.y, prog: 0, need: kind === 'workshop' ? 70 : 60 };
  }
  const p = dryRing(S, g.home.x, g.home.y, kind === 'workshop' ? 2.4 : kind === 'shrine' ? 5.6 : 4.1, kind === 'shrine' ? 22 : 32 + 5 * Math.sqrt(g.houses.length));
  return { kind, x: p.x, y: p.y, prog: 0, need: kind === 'workshop' ? 70 : 60 };
}
const HAUL = 2.5, CAP = { food: 4, wood: 3, stone: 2 };
function load(m, k, v) { if (m.lk && m.lk !== k && m.load > 0) return; m.lk = k; m.load = (m.load || 0) + v; if (m.load >= CAP[k]) m.haul = true; }
function storeOf(g, k) { return k === 'food' && g.granary ? g.granary : k === 'stone' && g.workshop ? g.workshop : g.home; }
function deliver(S) {
  for (const a of S.agents) {
    if (!a.load) continue;
    const g = a.group && S._g.get(a.group);
    if (!g || !g.home) { a.load = 0; a.haul = false; a.lk = null; continue; }
    const st = storeOf(g, a.lk);
    if (a.haul && Math.hypot(a.x - st.x, a.y - st.y) < 16) { addStock(g, a.lk, a.load); a.load = 0; a.haul = false; a.lk = null; }
    else if (!a.haul && seasonOf(S.tick) === 0 && a.lk === 'food' && a.job !== 'gather') a.haul = true;
    else if (!a.haul && a.job !== ({ food: a.job === 'gather' ? 'gather' : 'farm', wood: 'wood', stone: 'stone' })[a.lk]) a.haul = true;
  }
}
const TITLE = { farm: 'мастер-земледелец', wood: 'мастер-лесоруб', build: 'мастер-строитель', stone: 'каменотёс', craft: 'мастер-ремесленник', gather: 'опытный охотник' };
const JOBX = ['farm', 'wood', 'build', 'stone', 'craft', 'gather'];
const jobSkill = (m, j) => m.skill * (1 + 0.6 * Math.min(1, (m.xp && m.xp[j]) || 0));
function jobs(S, g) {
  const mem = g.members.map(id => S._a.get(id)), n = mem.length, season = seasonOf(S.tick);
  const cap = g.houses.filter(h => !h.ruined).length * 4;
  mem.slice().sort((a, b) => (b.role === 'leader') - (a.role === 'leader') || b.status - a.status).forEach((m, i) => { m.shel = i < cap; });
  if (!g.home) { for (const m of mem) m.job = 'gather'; return; }
  const wantH = Math.ceil(n / 4), wantF = Math.max(1, Math.ceil(n / 2.2));
  if (S.tick % 90 === 0 || g.woodCell === null || S.wood[g.woodCell] < 3) g.woodCell = nearestForest(S, g.home, g);
  if (S.tick % 360 === 0 || g.stoneDist === undefined) { const h = nearestHill(S, g.home, g); g.stoneCell = h.c; g.stoneDist = h.d; }
  const needWS = !g.workshop && g.stoneCell !== null && n >= 5 && g.houses.length >= 2;
  const needGR = !g.granary && g.treasury > n * 5 && n >= 4;
  const threat = threatOf(S, g); let bs = null;
  g.threat = threat;
  if (!g.site) {
    if (threat > 0.6 && !g.walls && g.houses.length >= 3 && g.wood >= 12) { g.wood -= 12; g.site = { kind: 'walls', x: g.home.x, y: g.home.y, prog: 0, need: 90 }; }
    else if (!g.shrine && n >= 7 && g.trauma > 0 && g.houses.length >= 2 && g.wood >= 8) { g.wood -= 8; g.site = specialSpot(S, g, 'shrine'); }
    else if (g.landing && (g.fboats || 0) < Math.ceil(n / 8) && g.houses.length >= 2 && g.wood >= 8 && n >= 4) { g.wood -= 8; g.site = { kind: 'fboat', x: g.landing.x, y: g.landing.y, prog: 0, need: 70 }; }
    else if (g.houses.some(h => h.ruined) && g.wood >= 2) { const idx = g.houses.findIndex(h => h.ruined), hh = g.houses[idx]; g.wood -= 2; g.site = { kind: 'repair', idx, x: hh.x, y: hh.y, prog: 0, need: 20 }; }
    else if (!g.bridgeAt && n >= 8 && g.houses.length >= 3 && g.wood >= 16 && ((g.cross12 || 0) >= 10 || (g.drowned || 0) >= 1) && (bs = bridgeSpot(S, g))) { g.wood -= 16; g.site = bs; g.bridgeAt = -1; }
    else if (g.houses.length < wantH && g.wood >= (g.workshop ? 5 : 6)) { g.wood -= g.workshop ? 5 : 6; g.site = houseSpot(S, g); }
    else if (g.fields.length < wantF && season !== 0) g.site = fieldSpot(S, g);
    else if (needGR && g.wood >= 8) { g.wood -= 8; g.site = specialSpot(S, g, 'granary'); }
    else if (needWS && g.wood >= 4 && g.stone >= 4) { g.wood -= 4; g.stone -= 4; g.site = specialSpot(S, g, 'workshop'); }
  }
  const L = S._a.get(g.leader);
  const pool = mem.filter(m => !(m === L && n > 4) && !m.car && !m.war);
  if (L && n > 4) L.job = 'lead';
  const woodNeed = g.houses.length < wantH || (needGR && g.wood < 8) || (needWS && g.wood < 4) || (g.workshop && g.wood < 6);
  const stoneNeed = g.stoneCell !== null && ((needWS && g.stone < 4) || (g.workshop && g.stone < 6));
  const lean = ((n <= 6 && g.treasury < n * 3) || g.treasury < n * 1.2) && season !== 0;
  const quota = {
    build: g.site ? (lean && g.site.kind !== 'field' ? 0 : Math.max(1, Math.round(n * 0.2))) : 0,
    wood: g.woodCell === null || lean ? 0 : woodNeed ? Math.max(1, Math.round(n * 0.2)) : (season === 0 ? 1 : 0),
    stone: stoneNeed ? Math.max(1, Math.round(n * 0.12)) : 0,
    craft: lean ? 0 : (g.workshop && g.wood >= 1 && g.stone >= 1 && g.tools < n * 1.2) || (n >= 5 && ((g.pots || 0) < n * 0.5 || ((g.goats || 0) >= 4 && (g.cloth || 0) < n * 0.6))) ? Math.max(1, Math.round(n * 0.1)) : 0,
    farm: season === 0 ? 0 : g.fields.length * 2,
    pray: g.shrine ? 1 : 0,
    water: g.wNeed || 0,
    fish: g.fboats && g.landing ? Math.min(g.fboats * 2, Math.ceil(n * 0.3)) : 0,
    herd: (g.goats || 0) > 0 ? Math.max(1, Math.round(g.goats / 18)) : 0,
    guard: threat > 0.5 || S.tick - g.raided < 720 || g.lord ? Math.max(1, Math.round(n * (0.08 + 0.18 * Math.min(1.5, threat)))) : 0
  };
  const free = new Set(pool);
  for (const job of ['water', 'pray', 'guard', 'herd', 'fish', 'craft', 'build', 'stone', 'wood', 'farm']) {
    let q = Math.min(quota[job], free.size);
    if (!q) continue;
    const ranked = [...free].sort((a, b) => job === 'pray' ? (((b.xp.pray || 0) - (a.xp.pray || 0)) || (b.coop * (1 + b.status / 10) - a.coop * (1 + a.status / 10))) : (((b.xp[job] || 0) - (a.xp[job] || 0)) || a.id - b.id));
    let fi = 0;
    for (const m of ranked.slice(0, q)) { m.job = job; free.delete(m); if (job === 'farm') m.slot = fi++; }
    if (job === 'water') g.wGot = q;
  }
  if (!quota.water) g.wGot = 0;
  for (const m of free) m.job = 'gather';
}

const GOODS = ['food', 'wood', 'stone', 'tools'];
const BASE = { food: 1, wood: 1.5, stone: 2.5, tools: 6 };
const GNAME = { food: 'еды', wood: 'брёвен', stone: 'камня', tools: 'орудий' };
const GNOM = { food: 'еда', wood: 'брёвна', stone: 'камень', tools: 'орудия' }, GACC = { food: 'еду', wood: 'брёвна', stone: 'камень', tools: 'орудия' };
const GPRO = { food: 'её', wood: 'их', stone: 'его', tools: 'их' }, GNEED = { food: 'нужна', wood: 'нужны', stone: 'нужен', tools: 'нужны' };
const QF = { food: ['меру еды', 'меры еды', 'мер еды'], wood: ['бревно', 'бревна', 'брёвен'], stone: ['глыбу камня', 'глыбы камня', 'глыб камня'], tools: ['орудие', 'орудия', 'орудий'] };
const qty = (q, k) => { const n = Math.max(1, Math.round(q)); return `${n} ${pl(n, ...QF[k])}`; };
const stockOf = (g, k) => k === 'food' ? g.treasury : (g[k] || 0);
const addStock = (g, k, q) => { if (k === 'food') g.treasury += q; else g[k] = (g[k] || 0) + q; };
function needOf(g, k) {
  const n = g.members.length;
  if (k === 'food') return n * 6;
  if (k === 'wood') return 8 + Math.max(0, Math.ceil(n / 4) - g.houses.length) * 6 + (g.granary ? 0 : 8) + (g.workshop ? 6 : 0);
  if (k === 'stone') return g.workshop ? 8 : n >= 5 ? 6 : 0;
  return n * 0.6;
}
const valueOf = (g, k) => BASE[k] * clamp((needOf(g, k) + 1) / (stockOf(g, k) + 1), 0.25, 4);
const surplus = (g, k) => Math.max(0, stockOf(g, k) - needOf(g, k) * 1.2 - 1);
function segDist(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1, t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l, 0, 1); return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y); }
function carTarget(S, a) {
  const c = a.car, dest = S._g.get(c.phase === 'go' ? c.to : c.from);
  if (!dest || !dest.home) { a.car = null; return null; }
  return dest.home;
}
function tradeMonth(S) {
  const G = S.groups.filter(g => g.home && g.members.length >= 4);
  for (const A of G) {
    if (A.dead) continue;
    const busy = A.members.filter(id => { const m = S._a.get(id); return m && m.car; }).length;
    if (busy >= (A.members.length >= 14 ? 2 : 1)) continue;
    let best = null, bs = 0;
    for (const B of G) {
      if (B === A || B.dead) continue;
      const d = Math.hypot(A.home.x - B.home.x, A.home.y - B.home.y);
      if (d > 460 || (S.hostility[key(A.id, B.id)] || 0) > 0.5 || !reach(S, A.home.x, A.home.y, B.home.x, B.home.y)) continue;
      if (S.groups.some(H => H !== A && H !== B && H.home && (S.hostility[key(H.id, A.id)] || 0) > 0.6 && segDist(H.home, A.home, B.home) < 130)) continue;
      for (const X of GOODS) {
        const sx = surplus(A, X); if (sx < 1) continue;
        for (const Y of GOODS) {
          if (Y === X) continue;
          const sy = surplus(B, Y); if (sy < 0.5) continue;
          const gain = (valueOf(B, X) / valueOf(A, X)) * (valueOf(A, Y) / valueOf(B, Y));
          const sc = gain - d / 450 + (S.routes[key(A.id, B.id)] ? 0.3 : 0);
          if (sc > Math.max(bs, A.coin && B.coin ? 1.15 : 1.5)) { bs = sc; best = { B, X, Y, sx, sy, d, gain }; }
        }
      }
    }
    if (!best) continue;
    const { B, X, Y } = best;
    const px = Math.sqrt(valueOf(A, X) * valueOf(B, X)), py = Math.sqrt(valueOf(A, Y) * valueOf(B, Y));
    let qx = Math.min(best.sx, (A.coin && B.coin ? 45 : 30) / BASE[X]), V = qx * px, qy = V / py;
    if (qy > best.sy) { qy = best.sy; V = qy * py; qx = V / px; }
    if (qx < 0.5 || qy < 0.3) continue;
    const L = S._a.get(A.leader);
    const cands = A.members.map(id => S._a.get(id)).filter(m => m && !m.car && m !== L && m.age >= 18);
    if (!cands.length) continue;
    cands.sort((a, b) => ((b.xp.trade || 0) - (a.xp.trade || 0)) || (b.coop + b.ambition - a.coop - a.ambition));
    const m = cands[0];
    addStock(A, X, -qx);
    m.job = 'trade';
    m.car = { from: A.id, to: B.id, x: X, qx, y: Y, qy, px, py, phase: 'go', t: S.tick, why: `Обмен выгоден обоим. «${A.name}» отдаёт лишнее (${GACC[X]}) и получает ${GACC[Y]}: дома ${GPRO[Y]} не хватает. Для «${B.name}» наоборот: ${GNOM[Y]} у неё в избытке, а ${GNOM[X]} ${GNEED[X]}. Чем сильнее расходятся нужды, тем выгоднее сделка.` };
  }
}
function caravans(S) {
  for (const a of S.agents.slice()) {
    if (!S._a.has(a.id)) continue;
    const c = a.car; if (!c) continue;
    const A = S._g.get(c.from), B = S._g.get(c.to);
    if (!A || a.group !== c.from) { a.car = null; continue; }
    if ((S.tick + a.id) % 6 === 0) {
      for (const H of S.groups) {
        if (!H.home || H === A || H.id === c.to || (S.hostility[key(H.id, A.id)] || 0) < 0.6) continue;
        if (Math.hypot(a.x - H.home.x, a.y - H.home.y) > 120 || H.members.length < 4 || rnd(S) > 0.25 || (S.raidCool || {})[key(H.id, A.id)] > S.tick) continue;
        S.raidCool = S.raidCool || {}; S.raidCool[key(H.id, A.id)] = S.tick + 360;
        const good = c.phase === 'go' ? c.x : c.y, q = c.phase === 'go' ? c.qx : c.qy;
        addStock(H, good, q); S.stats.raids++; A.raided = S.tick;
        S.hostility[key(H.id, A.id)] = Math.min(2, (S.hostility[key(H.id, A.id)] || 0) + 0.4);
        const killed = rnd(S) < 0.3, LH = S._a.get(H.leader);
        log(S, 'raid', `Люди «${H.name}» грабят караван «${A.name}»${killed ? `, купец ${a.name} убит` : ''}`, a.x, a.y, H.hue, { why: sent([`караван шёл в ${cells(Math.hypot(a.x - H.home.x, a.y - H.home.y))} от «${H.name}»`, `вражда между деревнями ${P0(Math.min(1, S.hostility[key(H.id, A.id)] / 2))}`, `добыча: ${qty(q, good)}`, 'теперь «' + A.name + '» выставит стражу']), who: [a.id, LH && LH.id].filter(Boolean), gs: [H.id, A.id] });
        a.car = null;
        if (killed) removeAgent(S, a, 'war'); else a.energy = Math.max(0.05, a.energy - 0.3);
        break;
      }
      if (!a.car) continue;
    }
    if (c.phase === 'go') {
      if (!B || !B.home) { addStock(A, c.x, c.qx * 0.5); a.car = null; continue; }
      if (Math.hypot(a.x - B.home.x, a.y - B.home.y) > 22) continue;
      const pyNow = Math.sqrt(valueOf(A, c.y) * valueOf(B, c.y));
      let qy = Math.min(c.qx * c.px / pyNow, Math.max(0, stockOf(B, c.y) - needOf(B, c.y) * 0.8));
      if (qy < 0.2) { c.phase = 'back'; c.y = c.x; c.qy = c.qx * 0.7; c.failed = true; continue; }
      addStock(B, c.x, c.qx); addStock(B, c.y, -qy);
      c.qy = qy; c.py = pyNow; c.phase = 'back';
      const V = c.qx * c.px;
      a.wealth += V * (A.coin ? 0.1 : 0.08); a.status += V * 0.03; a.trades = (a.trades || 0) + 1;
      a.xp.trade = (a.xp.trade || 0) + 0.25;
      if (a.xp.trade >= 1 && !a.master) a.master = 'trade';
      const LA = S._a.get(A.leader), LB = S._a.get(B.leader);
      if (LA && LB) { bump(LA, LB, 0.06); bump(LB, LA, 0.06); bump(a, LB, 0.05); bump(LB, a, 0.04); }
      const k = key(A.id, B.id);
      if (S.hostility[k]) S.hostility[k] = Math.max(0, S.hostility[k] - 0.12);
      S.stats.trades++; A.trades = (A.trades || 0) + 1; B.trades = (B.trades || 0) + 1;
      for (const [F, T] of [[A, B], [B, A]]) if (F.coin && !T.coin && S.params.coin >= 0.5 && rnd(S) < 0.2) {
        T.coin = true; S.stats.coinGroups = (S.stats.coinGroups || 0) + 1;
        log(S, 'money', `«${T.name}» переходит на монету «${F.name}»`, T.home.x, T.home.y, T.hue, { why: 'Торговать с партнёром за монету проще, чем искать, кому нужен именно твой товар. Монета не гниёт, поэтому богатство теперь можно копить.', gs: [T.id, F.id] });
        break;
      }
      for (const [F, T] of [[A, B], [B, A]]) {
        if (F.faith && T.faith !== F.faith && rnd(S) < (T.faith ? 0.04 : 0.15)) {
          const old = T.faith, fn = S.faiths[F.faith];
          T.faith = F.faith;
          if (fn) log(S, 'faith', `«${T.name}» ${old ? 'меняет веру и принимает' : 'принимает'} ${fn.name} от торговых партнёров из «${F.name}»`, T.home.x, T.home.y, fn.hue, { why: sent([`купцы годами ходят между деревнями`, old ? `прежняя вера «${T.name}» слабее: соседи и партнёры молятся иначе` : 'своей веры у деревни не было', 'общая вера растит доверие и гасит вражду между единоверцами']), gs: [T.id, F.id] });
          break;
        }
      }
      const P = S.price; P[c.x] = P[c.x] * 0.85 + c.px * 0.15; P[c.y] = P[c.y] * 0.85 + pyNow * 0.15;
      const r = S.routes[k];
      const ratio = `1 ${c.y === 'tools' ? 'орудие' : c.y === 'stone' ? 'камень' : c.y === 'wood' ? 'бревно' : 'мера еды'} = ${(pyNow / c.px).toFixed(1)} ${c.x === 'tools' ? 'орудия' : c.x === 'stone' ? 'камня' : c.x === 'wood' ? 'бревна' : 'еды'}`;
      if (!r) {
        S.routes[k] = { a: A.id, b: B.id, n: 1, t: S.tick, x1: A.home.x, y1: A.home.y, x2: B.home.x, y2: B.home.y };
        const first = !S.firstTrade; S.firstTrade = true;
        log(S, first ? 'trade' : 'route', first ? `Первая сделка в мире: «${A.name}» меняет ${qty(c.qx, c.x)} на ${qty(qy, c.y)} у «${B.name}»` : `«${A.name}» и «${B.name}» открывают торговый путь`, B.home.x, B.home.y, A.hue, { first, why: `${c.why} Цена сложилась сама, из того, насколько каждой стороне нужен товар: ${ratio}. Купец ${a.name} берёт себе восьмую часть сделки.`, who: [a.id, LA && LA.id, LB && LB.id].filter(Boolean), gs: [A.id, B.id] });
      } else { r.n++; r.t = S.tick; r.x1 = A.home.x; r.y1 = A.home.y; r.x2 = B.home.x; r.y2 = B.home.y; }
      if (LA && a.trades >= 3 && a.wealth > LA.wealth && !a.richer) {
        a.richer = true;
        log(S, 'trade', `Купец ${a.name} становится богаче своего лидера ${LA.name}`, a.x, a.y, A.hue, { why: `После ${a.trades} ${pl(a.trades, 'каравана', 'караванов', 'караванов')} у него ${a.wealth.toFixed(0)}, а у лидера ${LA.wealth.toFixed(0)}. Восьмая часть каждой сделки оседает у купца. Богатство даёт статус и сторонников: в иерархии появляется вторая сила.`, who: [a.id, LA.id], gs: [A.id] });
      }
    } else if (Math.hypot(a.x - A.home.x, a.y - A.home.y) < 22) {
      addStock(A, c.y, c.qy); a.car = null;
    }
  }
  for (const k in S.routes) { const r = S.routes[k], dead = !S._g.has(r.a) || !S._g.has(r.b); if (S.tick - r.t > 360 * (dead ? 5 : 10)) delete S.routes[k]; }
}
function marketWatch(S) {
  const h = S.hist; if (!h.pf || h.pf.length < 25 || !S.firstTrade) return;
  const now = h.pf[h.pf.length - 1], then = h.pf[h.pf.length - 25];
  if (now > then * 1.7 && S.tick - (S.foodSpike || -1e9) > 360 * 4) {
    S.foodSpike = S.tick;
    const fam = S.events.filter(e => e.type === 'famine' && S.tick - e.t < 720).length;
    log(S, 'market', `Еда подорожала в ${(now / then).toFixed(1)} раза за два года`, undefined, undefined, 0, { why: sent([fam ? `${fam} голодных зим за два года` : '', S.tick < S.drought + 360 ? 'засуха срезала урожай' : '', `население ${S.agents.length}`, 'у кого полный амбар, тот теперь богатеет на обмене']) });
  }
}

const wallR = g => Math.max(26, ...g.houses.map(h => Math.hypot(h.x - g.home.x, h.y - g.home.y) + 12));
function threatOf(S, g) {
  let t = 0;
  for (const o of S.groups) {
    if (o === g || !o.home || allied(S, g.id, o.id)) continue;
    if (Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y) > 460) continue;
    t = Math.max(t, S.hostility[key(g.id, o.id)] || 0);
  }
  for (const w of S.wars) if (w.def === g.id) t = Math.max(t, 1.5);
  return t;
}
function toolCov(g) { return Math.min(1, (g.tools || 0) / Math.max(1, g.members.length * 0.6)); }
function fightPow(m, g) { return m.skill * (0.3 + m.energy) * (1 + 0.5 * toolCov(g)) * (1 + 0.4 * Math.min(1, (m.xp && m.xp.guard) || 0)); }
function defence(S, g) {
  let p = 0;
  for (const id of g.members) { const m = S._a.get(id); if (!m || m.car || m.war) continue; if (Math.hypot(m.x - g.home.x, m.y - g.home.y) > 160) continue; p += fightPow(m, g) * (m.job === 'guard' ? 1 : 0.45); }
  return p * (g.walls ? 1.7 : 1);
}
function warTarget(S, a) {
  const w = S.wars.find(x => x.id === a.war);
  if (!w) { a.war = null; return null; }
  const T = S._g.get(w.phase === 'march' ? w.def : w.att);
  if (!T || !T.home) { a.war = null; return null; }
  return T.home;
}
function warMonth(S) {
  for (const A of S.groups) {
    if (!A.home || A.dead || A.members.length < 5 || S.wars.some(w => w.att === A.id || w.def === A.id)) continue;
    const LA = S._a.get(A.leader); if (!LA) continue;
    let best = null, bv = 0;
    for (const B of S.groups) {
      if (B === A || !B.home || B.dead || allied(S, A.id, B.id) || B.lord === A.id || (A.state && A.state === B.state && B.lord !== null && A.lord !== B.id)) continue;
      const k = key(A.id, B.id), h = S.hostility[k] || 0;
      const av = A.members.reduce((q, id) => { const m = S._a.get(id); return q + (m && m.feud && !m.feud.done && m.feud.g === B.id ? (m.id === A.leader ? 3 : 1) : 0); }, 0);
      if (h < (av >= 2 ? 0.65 : 0.9) || (S.truce[k] || 0) > S.tick) continue;
      const d = Math.hypot(A.home.x - B.home.x, A.home.y - B.home.y); if (d > 460 || !reach(S, A.home.x, A.home.y, B.home.x, B.home.y)) continue;
      const fighters = warband(S, A);
      let pa = 0; for (const m of fighters) pa += fightPow(m, A);
      const pdR = defence(S, B), pd = pdR * Math.exp(gauss(S) * 0.35) * (1 - 0.25 * LA.ambition) * (1 + 0.2 * ((S._a.get(B.leader) || {}).rep || 0)), odds = pa * pa / (pa * pa + pd * pd + 1e-6), oddsR = pa * pa / (pa * pa + pdR * pdR + 1e-6);
      const prize = B.treasury + (B.tools || 0) * 4 + (A.lord === B.id ? 40 : 0);
      const v = odds * (prize + 10) * h / (1 + d / 300) * (1 + av * 0.3);
      if (odds > 0.42 && v > bv) { bv = v; best = { B, fighters, pa, pd: pdR, odds, oddsR, h, d, av }; }
    }
    if (!best) continue;
    const hungry = A.famY === Math.floor(S.tick / 360);
    const young = A.members.filter(id => { const m = S._a.get(id); return m && m.age < 28; }).length / A.members.length, elders = A.members.filter(id => { const m = S._a.get(id); return m && m.age > 55; }).length / A.members.length;
    if (rnd(S) > (0.12 + 0.35 * LA.ambition + (hungry ? 0.2 : 0) + 0.4 * Math.max(0, young - 0.35) - 0.3 * elders) * (A.gov === 'assembly' && !hungry ? 0.45 : 1)) continue;
    const { B, fighters } = best;
    if (fighters.length < 3) continue;
    if (parley(S, A, B, LA, best, best.av)) continue;
    const w = { id: S.warId++, att: A.id, def: B.id, phase: 'march', t: S.tick, fighters: fighters.map(m => m.id), pa: best.pa, pd: best.pd, oddsE: best.odds, oddsR: best.oddsR };
    for (const m of fighters) { m.war = w.id; m.job = 'war'; }
    S.wars.push(w); S.stats.wars++;
    const pa0 = A.treasury / A.members.length, pb0 = B.treasury / Math.max(1, B.members.length);
    const blen = (S.borders || {})[key(A.id, B.id)] || 0;
    const reasons = [blen > 6 ? `спор за межу: общая граница ${blen} ${pl(blen, 'клетка', 'клетки', 'клеток')}` : '', hungry ? `в «${A.name}» голодная зима, а у «${B.name}» ${Math.round(B.treasury)} еды` : pb0 > pa0 * 2 ? `«${B.name}» вдвое богаче на человека` : '', S.arch[A.id] && S.arch[A.id].parent === B.id ? `«${A.name}» когда-то откололась от «${B.name}»` : S.arch[B.id] && S.arch[B.id].parent === A.id ? `«${B.name}» когда-то откололась от «${A.name}»` : '', A.lord === B.id ? `«${A.name}» платит «${B.name}» дань и хочет свободы` : '', `вражда ${P0(Math.min(1, best.h / 2))}`, `амбиции ${LA.name}: ${P0(LA.ambition)}`, `шансы на победу ${P0(best.odds)}`];
    w.why = sent(reasons);
    log(S, 'war', `«${A.name}» идёт войной на «${B.name}»: ${fighters.length} ${pl(fighters.length, 'воин', 'воина', 'воинов')}`, A.home.x, A.home.y, A.hue, { why: w.why, who: [LA.id, ...w.fighters], gs: [A.id, B.id] });
  }
  for (const w of S.wars.slice()) if (S.tick - w.t > 420) endWar(S, w);
}
// talks before a war: the weaker side usually buys peace with a ransom instead of fighting
function parley(S, A, B, LA, best, av) {
  const LB = S._a.get(B.leader);
  if (!LB || (B.treasury < B.members.length * 3 && (B.goats || 0) < 6 && (B.tools || 0) < 4)) return false;
  const p = (0.5 + 0.3 * LB.coop + 0.4 * Math.max(0, best.oddsR - 0.45) + (A.lord === B.id ? -0.25 : 0) + (B.gov === 'assembly' ? 0.1 : 0)) * (av >= 2 ? 0.35 : 1) * (1 - 0.35 * LA.ambition);
  if (rnd(S) > p) return false;
  const rate = clamp(0.15 + 0.25 * best.oddsR, 0.15, 0.4), food = Math.max(0, B.treasury - B.members.length * 1.5) * rate * 1.5, tools = (B.tools || 0) * rate * 0.5, goats = B.goats > 4 ? Math.floor(B.goats * rate * 0.8) : 0;
  const paid = [food >= 1 ? qty(food, 'food') : '', tools >= 1 ? qty(tools, 'tools') : '', goats ? `${goats} ${pl(goats, 'коза', 'козы', 'коз')}` : ''].filter(Boolean);
  if (!paid.length) return false;
  B.treasury -= food; B.tools = (B.tools || 0) - tools; A.treasury += food; A.tools = (A.tools || 0) + tools;
  if (goats) { B.goats -= goats; A.goats = (A.goats || 0) + goats; }
  const k = key(A.id, B.id);
  S.truce[k] = S.tick + 360 * 3; S.hostility[k] = (S.hostility[k] || 0) * 0.55;
  S.stats.ransoms = (S.stats.ransoms || 0) + 1;
  LA.status += 1; LA.rep = clamp((LA.rep || 0) + 0.04, -1, 1); LB.rep = clamp((LB.rep || 0) - 0.03, -1, 1);
  for (const id of B.members) { const m = S._a.get(id); if (m && m.id !== B.leader) m.res = clamp(m.res + 0.05, 0, 1); }
  log(S, 'ransom', `«${B.name}» откупается от войны с «${A.name}»: ${paid.join(', ')}`, B.home.x, B.home.y, A.hue, { why: sent([`${LA.name} собирает ${best.fighters.length} ${pl(best.fighters.length, 'воина', 'воинов', 'воинов')}, но сначала шлёт к «${B.name}» гонцов`, `${LB.name} видит, что шансы отбиться невелики (${P0(1 - best.oddsR)}), и предпочитает заплатить, а не хоронить своих`, LB.coop > 0.6 ? `${LB.name} миролюбив${LB.sex === 'f' ? 'а' : ''}` : '', 'на три года между деревнями мир, но в «' + B.name + '» многие недовольны откупом']), who: [LA.id, LB.id], gs: [A.id, B.id] });
  return true;
}
function warband(S, A) {
  const L = S._a.get(A.leader), n = A.members.length;
  const able = A.members.map(id => S._a.get(id)).filter(m => m && !m.car && m.age >= 17 && m.energy > 0.3);
  able.sort((a, b) => (b.job === 'guard') - (a.job === 'guard') || fightPow(b, A) - fightPow(a, A));
  return able.filter(m => m !== L || n < 8).slice(0, Math.max(3, Math.round(n * 0.45)));
}
function endWar(S, w) {
  for (const id of w.fighters) { const m = S._a.get(id); if (m && m.war === w.id) m.war = null; }
  S.wars = S.wars.filter(x => x !== w);
}
function wars(S) {
  for (const w of S.wars.slice()) {
    const A = S._g.get(w.att), B = S._g.get(w.def);
    if (!A || !B || !B.home || !A.home) { endWar(S, w); continue; }
    const band = w.fighters.map(id => S._a.get(id)).filter(m => m && m.war === w.id);
    if (!band.length) { endWar(S, w); continue; }
    if (w.phase === 'march') {
      const near = band.filter(m => Math.hypot(m.x - B.home.x, m.y - B.home.y) < 30).length;
      if (near >= Math.ceil(band.length * 0.6)) battle(S, w, A, B, band);
    } else if (band.every(m => Math.hypot(m.x - A.home.x, m.y - A.home.y) < 40)) endWar(S, w);
  }
}
function battle(S, w, A, B, band) {
  let pa = 0; for (const m of band) pa += fightPow(m, A);
  let pd = defence(S, B);
  const st = B.state && (S.states || []).find(x => x.id === B.state);
  if (st && st.type === 'Конфедерация') for (const id of st.members) { const o = S._g.get(id); if (o && o !== B && o !== A && o.home && Math.hypot(o.home.x - B.home.x, o.home.y - B.home.y) < 420) pd += defence(S, o) * 0.35; }
  const win = rnd(S) < pa * pa / (pa * pa + pd * pd + 1e-6);
  const LA = S._a.get(A.leader), LB = S._a.get(B.leader);
  const defenders = B.members.map(id => S._a.get(id)).filter(m => m && !m.car && !m.war && Math.hypot(m.x - B.home.x, m.y - B.home.y) < 160);
  // most clashes are skirmishes: a few wounded, 0-2 dead; a rout with heavy losses is rare and needs a clear edge
  const edge = win ? pa / Math.max(0.1, pd) : pd / Math.max(0.1, pa), rout = rnd(S) < clamp((edge - 1.2) * 0.12, 0, 0.3);
  const lossA = win ? (rout ? 0.06 : 0.045) : (rout ? 0.28 : 0.16), lossB = win ? (rout ? 0.26 : 0.14) : (rout ? 0.06 : 0.045);
  const deadA = band.filter(() => rnd(S) < lossA), deadB = defenders.filter(m => m.role !== 'leader' || rnd(S) < 0.5).filter(() => rnd(S) < lossB);
  const hurt = band.concat(defenders).filter(m => !deadA.includes(m) && !deadB.includes(m) && rnd(S) < (rout ? 0.15 : 0.08));
  for (const m of hurt) { m.energy = Math.max(0.1, m.energy - 0.25); if (rnd(S) < 0.5) bio(S, m, 'wounded', `${m.sex === 'f' ? 'Ранена' : 'Ранен'} в битве у «${B.name}»`); }
  S.stats.battles++;
  const k = key(A.id, B.id);
  S.truce[k] = S.tick + 360 * 3; S.hostility[k] = win ? 0.8 : 1.1;
  let text, why, conquer = false;
  const ratio = pa / Math.max(0.1, pd);
  if (win) {
    const food = B.treasury * (rout ? 0.5 : 0.35), tools = (B.tools || 0) * (rout ? 0.45 : 0.3), wood = (B.wood || 0) * 0.3;
    B.treasury -= food; B.tools -= tools; B.wood -= wood; A.treasury += food; A.tools += tools; A.wood += wood;
    let burnt = 0;
    if (B.houses.length > 1 && rnd(S) < (rout ? 0.7 : 0.3)) { const hh = B.houses.pop(); burnt = 1; S.ruins.push({ name: B.name, t: S.tick, x: hh.x, y: hh.y, houses: [hh], fields: [] }); }
    B.raided = S.tick; if (LB) B.legit = Math.max(0.2, B.legit - 0.2);
    let annexed = 0;
    if (S.own) { const bc = []; for (let c = 0; c < S.own.length; c++) if (S.own[c] === B.id) bc.push(c); bc.sort((p, q) => Math.hypot((p % N) * CS - A.home.x, Math.floor(p / N) * CS - A.home.y) - Math.hypot((q % N) * CS - A.home.x, Math.floor(q / N) * CS - A.home.y)); const nn = Math.min(10, Math.floor(bc.length / 4)); for (let i = 0; i < nn; i++) { if (S.occ[bc[i]]) continue; S.own[bc[i]] = A.id; annexed++; } }
    A.warsWon++; B.warsLost++; B.trauma++;
    if (B.goats > 2) { const k = Math.floor(B.goats / 2); B.goats -= k; A.goats = (A.goats || 0) + k; }
    if (LA) { LA.status += 3; LA.rep = clamp((LA.rep || 0) + 0.12, -1, 1); }
    if (LB) LB.rep = clamp((LB.rep || 0) - 0.08, -1, 1);
    for (const m of band) { m.status += 0.6; m.xp.guard = (m.xp.guard || 0) + 0.35; if (m.xp.guard >= 1 && !m.master) m.master = 'guard'; }
    for (const m of B.members.map(id => S._a.get(id))) if (m && m.id !== B.leader) { m.res = clamp(m.res + 0.12, 0, 1); if (LB) bump(m, LB, -0.1); }
    conquer = !B.lord && B.members.length < A.members.length && ratio > 1.3 && LA && LA.ambition > 0.5 && rnd(S) < 0.6;
    text = `Битва у «${B.name}»: войско «${A.name}» ${rout ? 'наголову разбивает защитников' : 'берёт верх'}, уносит ${qty(food, 'food')}${tools >= 1 ? ` и ${qty(tools, 'tools')}` : ''}${burnt ? ', один дом сожжён' : ''}${annexed ? `, отрезает ${annexed} ${pl(annexed, 'клетку', 'клетки', 'клеток')} земли` : ''}`;
    why = sent([`силы ${pa.toFixed(1)} против ${pd.toFixed(1)}`, B.walls ? 'частокол не спас' : 'частокола у защитников не было', toolCov(A) > toolCov(B) + 0.3 ? 'у нападавших больше орудий' : '', `погибли: у нападавших ${deadA.length}, у защитников ${deadB.length}${hurt.length ? `, ранены ${hurt.length}` : ''}`, rout ? 'перевес был таким, что защитники побежали' : 'дрались недолго: одна сторона дрогнула, и всё кончилось', w.why ? `повод: ${w.why.toLowerCase().replace(/\.$/, '')}` : '']);
  } else {
    if (LA) { LA.status = Math.max(0, LA.status - 2); A.legit = Math.max(0.2, A.legit - 0.25); LA.rep = clamp((LA.rep || 0) - 0.12, -1, 1); }
    A.warsLost++; B.warsWon++; A.trauma++;
    for (const m of A.members.map(id => S._a.get(id))) if (m && m.id !== A.leader) { m.res = clamp(m.res + 0.15, 0, 1); if (LA) bump(m, LA, -0.12); }
    for (const m of defenders) { m.status += 0.4; m.xp.guard = (m.xp.guard || 0) + 0.25; }
    text = `Битва у «${B.name}»: защитники ${rout ? 'обращают в бегство' : 'отбивают'} войско «${A.name}»`;
    why = sent([`силы ${pa.toFixed(1)} против ${pd.toFixed(1)}`, B.walls ? 'частокол удвоил оборону' : '', B.members.filter(id => { const m = S._a.get(id); return m && m.job === 'guard'; }).length ? 'у защитников была стража' : '', `погибли: у нападавших ${deadA.length}, у защитников ${deadB.length}`, `проигранная война бьёт по авторитету ${LA ? LA.name : 'лидера'}: в «${A.name}» растёт обида`]);
  }
  if (!win && w.oddsE > 0.55 && w.oddsR < 0.47) why = (why ? why + ' ' : '') + `Вожди «${A.name}» просчитались: по слухам и из гордости ждали шансов ${P0(w.oddsE)}, а на деле было ${P0(w.oddsR)}.`;
  log(S, 'battle', text, B.home.x, B.home.y, A.hue, { why, who: band.map(m => m.id).concat(LB ? [LB.id] : []), gs: [A.id, B.id] });
  for (const m of band) { if (deadA.includes(m)) continue; bio(S, m, win ? 'battleW' : 'battleL', `Ходит в поход на «${B.name}»: ${win ? 'победа' : 'поражение'}`); if (m.exiledFrom === B.id && !m.returned) { m.returned = S.tick; bio(S, m, 'returned', `Возвращается к «${B.name}», откуда ${m.sex === 'f' ? 'её' : 'его'} изгнали, — с чужим войском`); } if (win && m.feud && !m.feud.done && m.feud.g === B.id) revengeDone(S, m, `Ходит в поход на «${B.name}» и побеждает`); }
  for (const m of defenders) { if (deadB.includes(m)) continue; bio(S, m, win ? 'battleL' : 'battleW', `Защищает «${B.name}» от войска «${A.name}»: ${win ? 'поражение' : 'победа'}`); if (!win && m.feud && !m.feud.done && m.feud.g === A.id) revengeDone(S, m, `Отбивает войско «${A.name}» у стен родной деревни`); }
  for (const m of deadA) feudFor(S, m, B, `В походе на «${B.name}»`);
  for (const m of deadB) feudFor(S, m, A, `При набеге «${A.name}»`);
  const killedL = deadB.find(m => m.id === B.leader) || deadA.find(m => m.id === A.leader);
  if (killedL) for (const o of S.agents) if (o.feud && !o.feud.done && o.feud.L === killedL.id && band.concat(defenders).includes(o)) revengeDone(S, o, `В битве гибнет ${killedL.name}, тот, кто вёл врагов`);
  for (const m of deadA.concat(deadB)) removeAgent(S, m, 'war');
  if (conquer && !A.dead && !B.dead) {
    B.lord = A.id; B.tribRate = 0.12; S.stats.conquests++;
    if (A.faith && B.faith !== A.faith && rnd(S) < 0.4) B.faith = A.faith;
    const LA2 = S._a.get(A.leader), LB2 = S._a.get(B.leader);
    log(S, 'conquest', `«${B.name}» становится данником «${A.name}»`, B.home.x, B.home.y, A.hue, { why: `Перевес нападавших в ${ratio.toFixed(1)} раза, и ${LA2 ? LA2.name : 'лидер'} решает не грабить, а подчинить. Теперь «${B.name}» каждый месяц отдаёт восьмую часть еды и десятую часть орудий. Держится это на страхе: как только данник окрепнет, он попробует восстать.`, who: [LA2 && LA2.id, LB2 && LB2.id].filter(Boolean), gs: [A.id, B.id] });
  }
  w.phase = 'return';
}
function tribute(S, g) {
  const lord = S._g.get(g.lord);
  if (!lord || !lord.home) { g.lord = null; return; }
  const rate = g.tribRate || 0.12, f = g.treasury * rate, t = (g.tools || 0) * rate * 0.8;
  g.treasury -= f; g.tools -= t; lord.treasury += f; lord.tools += t;
  const LL = S._a.get(lord.leader), LG = S._a.get(g.leader);
  if (LL) LL.status += 0.3;
  for (const id of g.members) { const m = S._a.get(id); if (m && m.id !== g.leader) m.res = clamp(m.res + 0.03, 0, 1); }
  if (LG && LL) bump(LG, LL, -0.04);
  const mine = defence(S, g), theirs = lord.members.length ? defence(S, lord) : 0;
  const busy = S.wars.some(w => w.att === lord.id);
  if (mine > theirs * 0.8 || (busy && rnd(S) < 0.3) || (LG && LG.ambition > 0.6 && rnd(S) < 0.02)) {
    g.lord = null; S.stats.revolts++;
    S.hostility[key(g.id, lord.id)] = 1.2;
    log(S, 'revolt', `«${g.name}» сбрасывает власть «${lord.name}» и перестаёт платить дань`, g.home.x, g.home.y, g.hue, { why: sent([mine > theirs * 0.8 ? `данник окреп: его оборона ${mine.toFixed(1)} против ${theirs.toFixed(1)} у хозяина` : '', busy ? `«${lord.name}» увяз в другой войне` : '', LG && LG.ambition > 0.6 ? `${LG.name} амбициозен (${P0(LG.ambition)})` : '', 'годы дани копили обиду']), who: [LG && LG.id, LL && LL.id].filter(Boolean), gs: [g.id, lord.id] });
  }
}

const nb4 = c => { const i = c % N, j = Math.floor(c / N), r = []; if (i > 0) r.push(c - 1); if (i < N - 1) r.push(c + 1); if (j > 0) r.push(c - N); if (j < N - 1) r.push(c + N); return r; };
const cellVal = (S, c) => { const t = S.ter[c]; return t === 'r' ? 3 : t === 'f' ? 2 : t === 'h' ? 2 : t === 'g' ? 1 : 0.4; };
function claim(S, g, target, maxAdd) {
  if (!g.home) return;
  if (!S.own) S.own = new Array(N * N).fill(0);
  const own = S.own, mine = [];
  for (let c = 0; c < own.length; c++) if (own[c] === g.id) mine.push(c);
  if (!mine.length) { const hc = cellAt(g.home.x, g.home.y); if (own[hc]) return; own[hc] = g.id; mine.push(hc); }
  const nodeCells = new Set(S.nodes.map(n => cellAt(n.x, n.y)));
  let added = 0;
  while (mine.length < target && added < maxAdd) {
    let best = -1, bv = -1e9;
    const seen = new Set();
    for (const c of mine) for (const q of nb4(c)) {
      if (own[q] || seen.has(q)) continue; seen.add(q);
      const v = cellVal(S, q) + (nodeCells.has(q) ? 4 : 0) - Math.hypot((q % N) * CS + 10 - g.home.x, Math.floor(q / N) * CS + 10 - g.home.y) / 45;
      if (v > bv) { bv = v; best = q; }
    }
    if (best < 0) break;
    own[best] = g.id; mine.push(best); added++;
  }
  if (mine.length > target * 1.6) {
    mine.sort((p, q) => Math.hypot((q % N) * CS - g.home.x, Math.floor(q / N) * CS - g.home.y) - Math.hypot((p % N) * CS - g.home.x, Math.floor(p / N) * CS - g.home.y));
    for (let i = 0; i < 5 && i < mine.length; i++) if (!S.occ[mine[i]]) own[mine[i]] = 0;
  }
}
function territories(S) {
  if (!S.own) S.own = new Array(N * N).fill(0);
  for (const g of S.groups) if (g.home) claim(S, g, 16 + g.members.length * 3 + (g.walls ? 6 : 0), 8);
  const own = S.own, B = {}, cnt = {}, bc = {};
  for (let c = 0; c < own.length; c++) {
    const o = own[c]; if (!o) continue;
    cnt[o] = (cnt[o] || 0) + 1;
    for (const q of nb4(c)) { const p = own[q]; if (p !== o) { (bc[o] = bc[o] || []).push(c); if (p && q > c) { const k = key(o, p); B[k] = (B[k] || 0) + 1; } break; } }
  }
  S.borders = B;
  for (const g of S.groups) {
    g.terr = cnt[g.id] || 0;
    const cells = bc[g.id] || [];
    const hostile = cells.filter(c => nb4(c).some(q => own[q] && own[q] !== g.id && (S.hostility[key(g.id, own[q])] || 0) > 0.4));
    const hs = new Set(hostile); g.bcells = hostile.slice(0, 30).concat(cells.filter(c => !hs.has(c)).slice(0, 30));
  }
}
function patrol(S) {
  if (!S.own) return;
  S.borderLog = S.borderLog || {};
  for (const a of S.agents.slice()) {
    if (a.war || a.car || !S._a.has(a.id)) continue;
    const o = S.own[cellAt(a.x, a.y)]; if (!o || o === a.group) continue;
    if (a.group && (allied(S, a.group, o) || !['gather', 'wood', 'stone'].includes(a.job))) continue;
    const O = S._g.get(o); if (!O) continue;
    const G = a.group && S._g.get(a.group);
    if (G && G.lord === o) continue;
    let guard = null;
    for (const id of O.members) { const m = S._a.get(id); if (m && m.job === 'guard' && Math.hypot(m.x - a.x, m.y - a.y) < 90) { guard = m; break; } }
    if (!guard) continue;
    a.energy = Math.max(0.05, a.energy - 0.06); bump(a, guard, -0.15);
    S.stats.border = (S.stats.border || 0) + 1;
    const k = G ? key(o, G.id) : 'n' + o;
    S.patrolCool = S.patrolCool || {};
    if (G && (S.patrolCool[k] || 0) < S.tick) { S.patrolCool[k] = S.tick + 30; S.hostility[k] = Math.min(2, (S.hostility[k] || 0) + 0.04); }
    if (G) { if (a.job === 'gather') { G.avoid[G.target] = S.tick + 360; pickTarget(S, G); } else if (a.job === 'wood') G.woodCell = null; else if (a.job === 'stone') G.stoneDist = undefined; }
    else { a.tnode = null; a.x += (a.x - O.home.x) * 0.15; a.y += (a.y - O.home.y) * 0.15; }
    const kill = G && (S.hostility[k] || 0) > 1.2 && rnd(S) < 0.05;
    if ((S.borderLog[k] || 0) < S.tick || kill) {
      S.borderLog[k] = S.tick + 360 * 2;
      log(S, 'border', kill ? `Стычка на меже: стража «${O.name}» убивает ${a.name} из «${G.name}»` : `Стража «${O.name}» гонит ${G ? `людей «${G.name}»` : 'кочевников'} со своей земли`, a.x, a.y, O.hue, { why: sent([`${a.name} ${a.job === 'wood' ? 'рубил лес' : a.job === 'stone' ? 'ломал камень' : 'собирал и охотился'} на земле «${O.name}»`, `стражник ${guard.name} заметил чужака`, G ? `вражда между деревнями растёт: ${P0(Math.min(1, (S.hostility[k] || 0) / 2))}` : '', G ? `теперь «${G.name}» придётся искать ${a.job === 'gather' ? 'другие угодья' : a.job === 'wood' ? 'другой лес' : 'другие холмы'} или торговать` : '']), who: [a.id, guard.id], gs: [o, G && G.id].filter(Boolean) });
    }
    if (kill) removeAgent(S, a, 'war');
  }
}

function landTop(g) {
  if (g.land !== 'private' || !g.fields.length) return null;
  const cnt = {}; for (const f of g.fields) if (f.owner) cnt[f.owner] = (cnt[f.owner] || 0) + 1;
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  return top ? { id: +top[0], n: top[1], share: top[1] / g.fields.length, owners: Object.keys(cnt).length } : null;
}
function institutions(S, g, L) {
  const P = S.params, n = g.members.length; let imL, imA;
  if (!L || !g.home) return;
  const mem = g.members.map(id => S._a.get(id)).filter(Boolean);
  // private land
  if (g.land === 'private' && P.landPriv < 0.5) {
    g.land = 'common'; for (const f of g.fields) f.owner = null;
    log(S, 'land', `В «${g.name}» поля снова становятся общими`, g.home.x, g.home.y, g.hue, { why: 'Частная собственность на землю запрещена вводными.', gs: [g.id] });
  } else if (g.land !== 'private' && P.landPriv >= 0.5 && n >= 9 && g.fields.length >= 4 && (g.norm < 0.55 || g.dynasty) && (imL = imitP(S, g, o => o.land === 'private'), rnd(S) < 0.008 + imL.p)) {
    g.land = 'private'; g.imFrom = imL.p > 0.008 && imL.from && rnd(S) < imL.p / (imL.p + 0.008) ? imL.from.name : null;
    const owners = mem.slice().sort((a, b) => b.status - a.status).slice(0, Math.max(2, Math.ceil(n * 0.4)));
    g.fields.forEach((f, i) => { f.owner = owners[i % owners.length].id; });
    const first = !S.firstLand; S.firstLand = true;
    log(S, 'land', first ? `Впервые в мире: «${g.name}» делит поля в собственность` : `«${g.name}» делит поля в собственность`, g.home.x, g.home.y, g.hue, { first, why: sent([`в деревне ${n} человек и ${g.fields.length} ${pl(g.fields.length, 'поле', 'поля', 'полей')}`, g.dynasty ? `правит династия ${g.dynName}, и знать хочет закрепить землю за собой` : 'добычу и так делят по статусу, и статусные хотят закрепить поля за собой', `поля получили ${owners.length} самых влиятельных`, 'теперь хозяин поля забирает треть урожая, а остальные работают на чужой земле батраками', 'поля переходят по наследству детям']), who: owners.map(m => m.id), gs: [g.id] });
    imNote(S, g);
  }
  if (g.land === 'private') {
    const poor = mem.filter(m => m.wealth < 0 && g.fields.some(f => f.owner === m.id));
    const rich = mem.slice().sort((a, b) => b.wealth - a.wealth)[0];
    for (const p of poor) {
      if (!rich || rich === p || rich.wealth < 25 || rnd(S) > 0.3) continue;
      const f = g.fields.find(x => x.owner === p.id); if (!f) continue;
      f.owner = rich.id; rich.wealth -= 15; p.wealth += 15; bump(p, rich, -0.1);
      g.landSales = (g.landSales || 0) + 1;
    }
    const top = landTop(g);
    if (top && top.share >= 0.4 && top.n >= 3 && g.fields.length >= 6 && !g.bigLord) {
      g.bigLord = true; const T = S._a.get(top.id);
      if (T) log(S, 'land', `${T.name} владеет ${top.n} ${pl(top.n, 'полем', 'полями', 'полями')} из ${g.fields.length}: в «${g.name}» появляется крупный землевладелец`, g.home.x, g.home.y, g.hue, { why: sent([g.landSales ? `за голодные годы бедные хозяева продали ${g.landSales} ${pl(g.landSales, 'поле', 'поля', 'полей')} за еду` : '', 'поля наследуются, и у одних семей их становится всё больше', `всего хозяев земли: ${top.owners}, остальные — батраки`, 'так рождается земельная знать']), who: [T.id], gs: [g.id] });
    }
  }
  // assembly
  if (g.gov === 'assembly' && P.assembly >= 0.5 && L.ambition > 0.55 && (g.room !== undefined && g.room < 0.35 || g.warsLost > (g.wl0 || 0)) && mem.filter(m => m.patron === L.id).length >= 2 && rnd(S) < 0.015) {
    g.gov = 'chief'; g.wl0 = g.warsLost;
    log(S, 'gov', `${L.name} разгоняет вече «${g.name}» и правит один`, g.home.x, g.home.y, g.hue, { why: sent([`у ${L.name} своя дружина: ${mem.filter(m => m.patron === L.id).length} ${pl(mem.filter(m => m.patron === L.id).length, 'человек', 'человека', 'человек')} на жалованье`, g.room < 0.35 ? 'вокруг тесно: недовольным некуда уйти' : 'деревня проиграла войну, и люди хотят сильной руки', 'вече не может помешать тому, у кого есть оружие']), who: [L.id], gs: [g.id] });
  }
  if (g.gov === 'assembly' && P.assembly < 0.5) {
    g.gov = 'chief';
    log(S, 'gov', `В «${g.name}» распускают вече`, g.home.x, g.home.y, g.hue, { why: 'Народное собрание запрещено вводными.', gs: [g.id] });
  } else if (g.gov === 'chief' && P.assembly >= 0.5 && !g.dynasty && n >= 8 && g.norm > 0.45 && avg(mem, m => m.coop) > 0.42 && (g.trauma > 0 || g.coupCount > 0 || g.warsLost > 0 || g.scarce > S.tick) && (imA = imitP(S, g, o => o.gov === 'assembly'), rnd(S) < (0.003 + imA.p * 0.45) * (0.2 + 0.8 * (g.room === undefined ? 1 : g.room)))) {
    g.gov = 'assembly'; g.imFrom = imA.p > 0.003 && imA.from && rnd(S) < imA.p * 0.45 / (imA.p * 0.45 + 0.003) ? imA.from.name : null;
    const first = !S.firstAssembly; S.firstAssembly = true;
    log(S, 'gov', first ? `Впервые в мире: «${g.name}» собирает вече` : `«${g.name}» собирает вече`, g.home.x, g.home.y, g.hue, { first, why: sent([g.coupCount ? `деревня пережила ${g.coupCount} ${pl(g.coupCount, 'переворот', 'переворота', 'переворотов')}` : g.warsLost ? 'деревня проиграла войну по воле одного человека' : 'деревня пережила тяжёлые годы', `люди здесь склонны делить поровну (${P0(g.norm)}) и договариваться`, 'теперь о войне, доле лидера и преемнике решает собрание', 'вече реже начинает войны и мягче к недовольным, но решения даются дольше']), gs: [g.id] });
    imNote(S, g);
  }
}

function money(S, g, L) {
  if (!L || !g.home || g.dead) return;
  const P = S.params, mem = g.members.map(id => S._a.get(id)).filter(Boolean), n = mem.length;
  if (g.coin && P.coin < 0.5) g.coin = false;
  let imC;
  if (!g.coin && P.coin >= 0.5 && g.workshop && (g.trades || 0) >= 6 && (imC = imitP(S, g, o => o.coin, true), imC.p *= 0.5, rnd(S) < (S.firstCoin ? 0.0002 : 0.00025) * ((g.trades || 0) >= 25 ? 2 : 0.3) + imC.p)) {
    g.coin = true; g.imFrom = S.firstCoin && imC.from && rnd(S) < imC.p / (imC.p + 0.0002) ? imC.from.name : null; S.stats.coinGroups = (S.stats.coinGroups || 0) + 1;
    const first = !S.firstCoin; S.firstCoin = true;
    log(S, 'money', first ? `Первая монета в мире: в «${g.name}» начинают чеканить деньги` : `В «${g.name}» начинают чеканить свою монету`, g.home.x, g.home.y, g.hue, { first, why: sent([`через «${g.name}» прошло ${g.trades} ${pl(g.trades, 'сделка', 'сделки', 'сделок')}`, 'меновая торговля неудобна: каждый раз нужно найти того, кому нужно именно твоё', 'мастерская и камень с холмов дают материал', 'монета не гниёт, поэтому богатство теперь можно копить, а значит, давать в долг']), gs: [g.id] });
    imNote(S, g);
  }
  if (!g.coin) { for (const m of mem) if (m.debt) { m.debt = 0; m.cred = null; m.bond = false; } return; }
  const f = g.faith && S.faiths && S.faiths[g.faith], ban = f && f.usury === 'ban';
  const allowed = P.usury >= 0.5 && !ban;
  const lenders = mem.filter(m => m.wealth > 16 && !m.debt).sort((a, b) => b.wealth - a.wealth);
  const lean = seasonOf(S.tick) === 0 || g.treasury < n * 3;
  for (const m of mem) {
    if (m.wealth >= (lean ? 4 : 0) || (m.debt || 0) > 18 || m === L || !lenders.length) continue;
    const ln = lenders.find(x => x !== m && x.wealth > 10 && (!m.cred || m.cred === x.id)); if (!ln) continue;
    ln.wealth -= 6; m.wealth += 6;
    if (!m.debt) { m.cred = ln.id; m.rate = allowed ? 0.15 + 0.35 * ln.ambition * (1 - ln.coop * 0.5) : 0; m.dt = S.tick; }
    m.debt = (m.debt || 0) + 6; ln.loans = (ln.loans || 0) + 1; S.stats.loans = (S.stats.loans || 0) + 1;
    if (allowed && !S.firstLoan) {
      S.firstLoan = true;
      log(S, 'debt', `Первый заём под проценты: ${m.name} берёт в долг у ${ln.name}`, m.x, m.y, g.hue, { first: true, why: sent([`${m.name} голодает, а у ${ln.name} скопилось ${Math.round(ln.wealth + 6)} в монете`, `долг растёт на ${P0(m.rate)} в год`, 'если не вернуть, должник попадёт в кабалу и будет отдавать всё, что заработает']), who: [m.id, ln.id], gs: [g.id] });
    }
  }
  for (const m of mem) if (m !== L && rnd(S) < 0.025) m.wealth -= 4 + rnd(S) * 4;
  for (const m of mem) {
    if (!m.debt) continue;
    const cr = S._a.get(m.cred);
    if (!cr || cr.group !== g.id) { m.debt = 0; m.cred = null; m.bond = false; continue; }
    m.debt *= 1 + (m.rate || 0) / 12;
    const keep = m.bond ? 1 : 7;
    if (m.wealth > keep + 1) { const pay = Math.min(m.wealth - keep, m.debt); m.wealth -= pay; cr.wealth += pay; m.debt -= pay; }
    if (m.debt < 0.5) { m.debt = 0; m.cred = null; m.bond = false; continue; }
    if (!m.bond && m.rate > 0 && (m.debt > 14 || (S.tick - m.dt > 540 && m.debt > 6))) {
      m.bond = true; S.stats.bonds = (S.stats.bonds || 0) + 1; bio(S, m, 'bond', `Попадает в кабалу к ${cr.name}: долг ${Math.round(m.debt)}`);
      if ((g.bondLog || 0) < S.tick) {
        g.bondLog = S.tick + 360 * 3;
        log(S, 'debt', `${m.name} попадает в кабалу к ${cr.name}`, m.x, m.y, g.hue, { why: sent([`долг вырос до ${Math.round(m.debt)} под ${P0(m.rate)} годовых и уже не гасится`, `теперь почти всё, что зарабатывает ${m.name}, уходит ${cr.name}`, `у ${cr.name} уже ${cr.loans || 1} ${pl(cr.loans || 1, 'заём', 'займа', 'займов')}`]), who: [m.id, cr.id], gs: [g.id] });
      }
    }
    if (m.bond) { m.res = clamp(m.res + 0.04, 0, 1); bump(m, cr, -0.04); m.status *= 0.97; cr.status += 0.05; }
  }
  const bonds = mem.filter(m => m.bond && m !== L);
  if (bonds.length >= 2 && avg(bonds, m => m.res) > 0.45 && rnd(S) < 0.2) {
    const total = bonds.reduce((s2, m) => s2 + m.debt, 0), creds = [...new Set(bonds.map(m => m.cred))].map(id => S._a.get(id)).filter(Boolean);
    if (g.gov === 'assembly' || L.coop > 0.62) {
      for (const m of mem) if (m.debt) { if (m.bond) bio(S, m, 'freed', `Вече прощает долги: ${m.sex === 'f' ? 'свободна' : 'свободен'} от кабалы`); m.debt = 0; m.cred = null; m.bond = false; m.res *= 0.5; bump(m, L, 0.15); }
      for (const c of creds) bump(c, L, -0.3);
      S.stats.jubilees = (S.stats.jubilees || 0) + 1;
      log(S, 'debt', `${g.gov === 'assembly' ? `Вече «${g.name}»` : `${L.name}`} списывает все долги`, g.home.x, g.home.y, g.hue, { why: sent([`в кабале ${bonds.length} ${pl(bonds.length, 'человек', 'человека', 'человек')}, общий долг ${Math.round(total)}`, 'кабальные готовы бунтовать', g.gov === 'assembly' ? 'на вече должников больше, чем ростовщиков' : `${L.name} склонен договариваться (${P0(L.coop)})`, `ростовщики ${creds.slice(0, 2).map(c => c.name).join(' и ')} теряют деньги и затаили обиду на лидера`]), who: bonds.map(m => m.id).concat(creds.map(c => c.id)), gs: [g.id] });
    } else {
      const ch = bonds.slice().sort((a, b) => b.ambition - a.ambition)[0];
      for (const m of bonds) { m.debt = 0; m.cred = null; m.bond = false; }
      const ng = createGroup(S, ch, bonds.filter(m => m !== ch), g.id);
      S.hostility[key(g.id, ng.id)] = 0.8; S.stats.schisms++; S.stats.debtRevolts = (S.stats.debtRevolts || 0) + 1;
      log(S, 'debt', `Восстание должников в «${g.name}»: ${ch.name} уводит ${bonds.length - 1} ${pl(bonds.length - 1, 'кабального', 'кабальных', 'кабальных')} и основывает «${ng.name}»`, ch.x, ch.y, ng.hue, { why: sent([`в кабале ${bonds.length} ${pl(bonds.length, 'человек', 'человека', 'человек')}, общий долг ${Math.round(total)}`, `${L.name} на стороне ростовщиков и долги не прощает`, 'уйти — единственный способ не платить']), who: bonds.map(m => m.id).concat(creds.map(c => c.id)), gs: [g.id, ng.id] });
    }
  }
}

/* ---------- water: springs, river, wells, drought, dirty water ---------- */
function springsInit(S) {
  S.springs = [];
  const cand = [];
  for (let c = 0; c < N * N; c++) {
    const t = S.ter[c]; if (t === 'w' || t === 'h' || t === 's' || t === 'b') continue;
    const cx = c % N, cy = (c / N) | 0; let hill = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < N && y < N && S.ter[y * N + x] === 'h') hill++; }
    if (hill >= 2) cand.push(c);
  }
  for (let t = 0; t < 400 && S.springs.length < 9 && cand.length; t++) {
    const c = cand[Math.floor(rnd(S) * cand.length)], x = (c % N) * CS + 10, y = ((c / N) | 0) * CS + 10;
    if (S.springs.some(p => Math.hypot(p.x - x, p.y - y) < 140) || riverDist(S, x, y) < 120) continue;
    S.springs.push({ id: S.nextId++, c, x, y, big: rnd(S) < 0.35, dry: false });
  }
}
function wellOk(S, x, y) { const t = S.ter[cellAt(x, y)], rd = riverDist(S, x, y); return t === 'r' || rd < 160 ? 0.95 : t === 'g' ? 0.6 : t === 'f' ? 0.55 : 0.25; }
function waterSrc(S, g) {
  const o = g.home; let best = null, bd = 1e9;
  if (g.well && !g.well.dry) { best = { x: g.well.x, y: g.well.y, kind: 'well' }; bd = Math.hypot(g.well.x - o.x, g.well.y - o.y); }
  for (const sp of S.springs || []) { if (sp.dry) continue; const d = Math.hypot(sp.x - o.x, sp.y - o.y); if (d < bd && reach(S, o.x, o.y, sp.x, sp.y)) { bd = d; best = { x: sp.x, y: sp.y, kind: 'spring', id: sp.id }; } }
  const r = S.river; if (r) { const k = clamp(Math.round((o.y + 20) / 20), 0, r.length - 1), rx = r[k][0], bx = rx + (o.x < rx ? -22 : 22), d = Math.abs(o.x - bx); if (d < bd && reach(S, o.x, o.y, bx, o.y)) { bd = d; best = { x: bx, y: o.y, kind: 'river' }; } }
  if (best) best.d = bd;
  return best;
}
function waterMonth(S) {
  const yr = Math.floor(S.tick / 360), dr = S.tick < (S.drought || 0) && seasonOf(S.tick) >= 1;
  for (const sp of S.springs || []) { const was = sp.dry; sp.dry = dr && !sp.big ? true : dr && sp.big ? sp.dry || rnd(S) < 0.08 : false; if (!dr) sp.dry = false; sp.justDried = !was && sp.dry; }
  for (const g of S.groups) {
    if (!g.home || g.dead) continue;
    if (g.well) g.well.dry = dr && g.well.depth < 1 && (g.well.dryRoll = (g.well.dryRoll === undefined ? rnd(S) : g.well.dryRoll)) < 0.45;
    if (!dr && g.well) g.well.dryRoll = undefined;
    const src = waterSrc(S, g), n = g.members.length;
    g.wsrc = src; g.wd = src ? src.d : 9999;
    g.wNeed = src ? Math.round(n * clamp((src.d - 30) / 480, 0, 0.35) * ((g.pots || 0) >= n * 0.5 ? 0.8 : 1)) : Math.ceil(n * 0.4);
    if (src && src.kind === 'river') { let up = 0; for (const o of S.groups) if (o !== g && o.home && o.wsrc && o.wsrc.kind === 'river' && o.home.y < g.home.y && g.home.y - o.home.y < 260 && Math.abs(o.home.x - g.home.x) < 200) up += o.members.length; g.dirty = Math.min(1.5, up / 90); }
    else if (src && src.kind === 'well') g.dirty = Math.min(1.2, Math.max(0, (n - 22) / 40) + (S.tick - g.well.t) / (360 * 120));
    else g.dirty = 0;
    if (!src || g.wd > 600) { g.thirst = (g.thirst || 0) + 1; if (g.thirst === 2 && (g.thirstLog || 0) < yr) { g.thirstLog = yr + 2; log(S, 'thirst', `В «${g.name}» нет воды`, g.home.x, g.home.y, g.hue, { why: sent([dr ? 'засуха: ближние родники пересохли' : 'поблизости нет ни реки, ни родника', g.well ? 'колодец пересох' : 'колодца нет', 'люди слабеют от жажды и думают, куда уйти']), gs: [g.id] }); } }
    else g.thirst = 0;
    if (g.wNeed > 0 && (g.wGot || 0) < g.wNeed) g.wShort = (g.wShort || 0) + 1; else g.wShort = 0;
    // wells
    const L = S._a.get(g.leader);
    if (!g.site && !g.well && L && n >= 5 && g.wd > 110 && g.wood >= 4 && (g.wTry || 0) < S.tick && seasonOf(S.tick) !== 0) {
      g.wood -= 4; g.wTry = S.tick + 360 * 4; g.site = { kind: 'well', x: g.home.x + (planOf(S, g).uy * 10), y: g.home.y - (planOf(S, g).ux * 10), prog: 0, need: 60 + (wellOk(S, g.home.x, g.home.y) < 0.5 ? 60 : 0) };
    }
  }
  // drought conflicts over shared springs
  if (dr) for (const sp of S.springs || []) { const users = S.groups.filter(g => g.wsrc && g.wsrc.id === sp.id); for (let i = 0; i < users.length; i++) for (let j = i + 1; j < users.length; j++) { const k = key(users[i].id, users[j].id); S.hostility[k] = Math.min(2, (S.hostility[k] || 0) + 0.06); } }
}
function droughtYear(S) {
  if (S.tick < (S.drought || 0)) return;
  if (rnd(S) < 0.07) {
    S.drought = S.tick + 360; S.stats.droughts = (S.stats.droughts || 0) + 1;
    log(S, 'drought', 'Засушливый год: дождей нет, родники пересыхают', undefined, undefined, 30, { why: 'Малые родники уйдут до осени, мелкие колодцы тоже. Река обмелеет, броды станут безопаснее. Урожай упадёт втрое, а деревни у одного родника начнут ссориться из-за воды.' });
  }
}

/* ---------- fates: life chronicle, memory, motives ---------- */
const BW = { theft: 1.5, born: 1, marry: 1.5, child: 0.3, childDied: 0.6, spouseDied: 2, move: 1, found: 3, leader: 4, deposed: 4, coup: 4, schism: 3, exiled: 3, master: 2, client: 2, retainer: 2, bond: 3, freed: 2, battleW: 2, battleL: 2, wounded: 1, feud: 3, revenge: 5, murder: 5, elope: 5, plague: 2, orphan: 2, inherit: 1, returned: 4, apprentice: 1, death: 1, heir: 3, drowned: 2, famine: 1 };
function bio(S, a, k, s) {
  if (!a) return;
  const b = a.bio || (a.bio = []);
  b.push([S.tick, k, s]);
  if (b.length > 46) b.splice(6, b.length - 46);
  a.drama = (a.drama || 0) + (BW[k] || 1);
}
function groupName(S, id) { const g = S._g.get(id); return g ? g.name : (S.arch && S.arch[id] ? S.arch[id].name : 'исчезнувшей деревни'); }
function kinOf(S, a) { return S.agents.filter(o => o !== a && kin(o, a) && o.spouse !== a.id || o.id === a.spouse); }
function legend(S, a, why) {
  if ((a.drama || 0) < 14 || !a.bio) return;
  S.legends = S.legends || [];
  S.legends.push({ id: a.id, name: a.name, sex: a.sex, born: a.bornT !== undefined ? a.bornT : S.tick - a.age * 360, died: S.tick, why, bio: a.bio.slice(), drama: a.drama, mother: a.mother, father: a.father, group: a.group ? groupName(S, a.group) : null });
  S.legends.sort((x, y) => y.drama - x.drama);
  if (S.legends.length > 40) S.legends.length = 40;
}
function feudFor(S, victim, killers, how) {
  if (!killers) return;
  for (const o of S.agents) {
    if (o === victim || o.group === killers.id) continue;
    const rel = o.mother === victim.id || o.father === victim.id ? (victim.sex === 'f' ? 'мать' : 'отца') : victim.spouse === o.id ? (victim.sex === 'f' ? 'жену' : 'мужа') : (victim.mother && o.mother === victim.mother) || (victim.father && o.father === victim.father) ? (victim.sex === 'f' ? 'сестру' : 'брата') : null;
    if (!rel) continue;
    if (o.feud && S.tick - o.feud.t < 360 * 30) continue;
    o.feud = { g: killers.id, gname: killers.name, L: killers.leader, Lname: (S._a.get(killers.leader) || {}).name || '', t: S.tick, v: victim.name, rel };
    const NOM = { 'отца': 'отец', 'мать': 'мать', 'жену': 'жена', 'мужа': 'муж', 'брата': 'брат', 'сестру': 'сестра' };
    bio(S, o, 'feud', `${how} гибнет ${NOM[rel]} ${victim.name}. ${o.name} клянётся отомстить «${killers.name}»`);
  }
}
function revengeDone(S, a, how) {
  if (!a.feud || a.feud.done) return;
  a.feud.done = S.tick;
  bio(S, a, 'revenge', how);
  const first = !S.firstRevenge; S.firstRevenge = true;
  log(S, 'revenge', `${a.name} мстит за ${a.feud.rel} ${a.feud.v}: ${how.charAt(0).toLowerCase() + how.slice(1)}`, a.x, a.y, (S._g.get(a.group) || {}).hue || 0, { first, why: `${yrs(Math.max(1, Math.round((S.tick - a.feud.t) / 360)))} назад «${a.feud.gname}» убили ${a.feud.rel === 'мать' ? 'мать' : a.feud.rel === 'жену' ? 'жену' : a.feud.rel === 'сестру' ? 'сестру' : a.feud.rel === 'мужа' ? 'мужа' : a.feud.rel === 'брата' ? 'брата' : 'отца'} ${a.name}. С тех пор ${a.sex === 'f' ? 'она' : 'он'} ждал${a.sex === 'f' ? 'а' : ''} своего часа.`, who: [a.id] });
}
function fatesMonth(S) {
  for (const g of S.groups) {
    if (!g.home || g.dead) continue;
    const L = S._a.get(g.leader); if (!L) continue;
    // feud pressure on group relations
    for (const id of g.members) {
      const m = S._a.get(id); if (!m || !m.feud || m.feud.done) continue;
      const T = S._g.get(m.feud.g); if (m.feud.personal && !S._a.has(m.feud.L)) { m.feud.done = S.tick; continue; }
      if (!T || T.dead) { if (S.tick - m.feud.t > 360 * 3 && !m.feud.done) { m.feud.done = S.tick; bio(S, m, 'feud', `Обидчики из «${m.feud.gname}» сошли со сцены, и месть остаётся неисполненной`); } continue; }
      const k = key(g.id, T.id), w = m === L ? 0.035 : 0.004 * Math.min(3, 0.5 + m.status / 6);
      if (T !== g && !allied(S, g.id, T.id)) S.hostility[k] = Math.min(2, (S.hostility[k] || 0) + w);
      // killer's leader lives in this very village: blood for blood
      const KL = S._a.get(m.feud.L);
      if (KL && KL.group === g.id && KL !== m && m.ambition > 0.4 && m.age > 17 && rnd(S) < (m.feud.personal ? 0.02 : 0.012)) {
        const wasL = KL === L;
        bio(S, KL, 'death', `${KL.sex === 'f' ? 'Убита' : 'Убит'}: ${m.name} мстит за ${m.feud.v}`);
        revengeDone(S, m, `Убивает ${KL.name}${wasL ? `, вождя «${g.name}»` : ''}`);
        bio(S, m, 'murder', `Своими руками убивает ${KL.name}`);
        S.stats.murders = (S.stats.murders || 0) + 1;
        for (const o of kinOf(S, KL)) if (!o.feud || o.feud.done) { o.feud = { g: g.id, gname: g.name, L: m.id, Lname: m.name, t: S.tick, v: KL.name, rel: o.mother === KL.id || o.father === KL.id ? (KL.sex === 'f' ? 'мать' : 'отца') : 'родича', personal: m.id }; bio(S, o, 'feud', `${m.name} убивает ${KL.name}. ${o.name} клянётся отомстить`); }
        removeAgent(S, KL, 'killed');
        if (g.dead) break;
        if (!wasL && m.group === g.id && L.coop > 0.4 && rnd(S) < 0.6) { leave(S, m, 'move'); m.x += 50; bio(S, m, 'exiled', `За убийство ${m.sex === 'f' ? 'изгнана' : 'изгнан'} из «${g.name}»`); m.exiledFrom = g.id; }
        break;
      }
    }
    if (g.dead) continue;
    // personal vengeance inside the village (killer is a person, not a village)
  }
  // apprentices
  for (const a of S.agents) {
    if (a.age > 25 || !a.group || a.master || a.teacher) continue;
    const g = S._g.get(a.group); if (!g) continue;
    const t = g.members.map(id => S._a.get(id)).find(m => m && m.master && m.master === a.job && m !== a);
    if (t) { a.teacher = t.id; a.teacherName = t.name; bump(a, t, 0.25); bump(t, a, 0.15); bio(S, a, 'apprentice', `Учится ремеслу у ${t.name}`); }
  }
}
function elope(S, f, m) {
  const gf = S._g.get(f.group), gm = S._g.get(m.group);
  leave(S, f, 'move'); leave(S, m, 'move');
  f.spouse = m.id; m.spouse = f.id; bump(f, m, 0.6); bump(m, f, 0.6);
  const ng = createGroup(S, m.ambition >= f.ambition ? m : f, [m.ambition >= f.ambition ? f : m]);
  ng.x0 = (f.x + m.x) / 2;
  for (const g of [gf, gm]) if (g && !g.dead) S.hostility[key(g.id, ng.id)] = 0.5;
  const txt = `Бегут вместе: «${gf ? gf.name : '?'}» и «${gm ? gm.name : '?'}» враждуют, свадьбы им не дали`;
  bio(S, f, 'elope', `${txt}. С ${m.name} ${f.sex === 'f' ? 'она' : 'он'} основывает свою семью`); bio(S, m, 'elope', `${txt}. С ${f.name} основывает свою семью`);
  S.stats.elopes = (S.stats.elopes || 0) + 1;
  log(S, 'elope', `${f.name} из «${gf ? gf.name : '?'}» и ${m.name} из «${gm ? gm.name : '?'}» бегут вместе и уходят жить своим домом`, (f.x + m.x) / 2, (f.y + m.y) / 2, ng.hue, { first: !S.firstElope, why: sent([`деревни враждуют: вражда ${P0(Math.min(1, S.hostility[key(gf ? gf.id : 0, gm ? gm.id : 0)] || 0))}`, 'вожди не отдают своих людей за врагов', `${f.name} и ${m.name} доверяют друг другу больше, чем своим деревням`]), who: [f.id, m.id], gs: [ng.id] });
  S.firstElope = true;
}

/* ---------- people: kin, families, children, plague, culture ---------- */
function kin(a, b) {
  if (!a || !b || a === b) return false;
  return a.spouse === b.id || a.mother === b.id || a.father === b.id || b.mother === a.id || b.father === a.id || (!!a.mother && a.mother === b.mother) || (!!a.father && a.father === b.father);
}
function popOf(S) { return S.agents.length + (S.kids ? S.kids.length : 0); }
function kidsOf(S, a) { let n = 0; for (const k of S.kids || []) if (k.mo === a.id || k.fa === a.id) n++; return n; }
function cdist(A, B) {
  return (A.faith && B.faith && A.faith !== B.faith ? 0.3 : 0) + ((A.gov || 'chief') !== (B.gov || 'chief') ? 0.2 : 0) + ((A.land || 'common') !== (B.land || 'common') ? 0.15 : 0) + (!!A.coin !== !!B.coin ? 0.1 : 0) + Math.abs(A.norm - B.norm) * 0.5;
}
function families(S) {
  S.kids = S.kids || [];
  const pop = popOf(S), crowd = pop > 650 ? 0.25 : pop > 520 ? 0.6 : 1;
  // marriages
  const singles = S.agents.filter(a => !a.spouse && a.age >= 17 && a.age < 52);
  const men = singles.filter(a => a.sex === 'm');
  for (const f of singles) {
    if (f.sex !== 'f' || f.spouse || rnd(S) > 0.14 || !men.length) continue;
    let best = null, bv = -9;
    for (let t = 0; t < 10; t++) {
      const m = men[Math.floor(rnd(S) * men.length)];
      if (m.spouse || Math.abs(m.age - f.age) > 14 || kin(m, f)) continue;
      const d = Math.hypot(m.x - f.x, m.y - f.y), gm = S._g.get(m.group), gf = S._g.get(f.group);
      if (m.group !== f.group && d > 320) continue;
      const v = (m.group && m.group === f.group ? 0.8 : 0) + (f.trust[m.id] || 0) + 0.3 * (m.rep || 0) + 0.02 * m.status - d / 600 - (gm && gf && gm !== gf ? cdist(gm, gf) * 0.6 : 0);
      if (v > bv) { bv = v; best = m; }
    }
    if (!best || bv < -0.4) continue;
    const gf0 = S._g.get(f.group), gm0 = S._g.get(best.group), hh = gf0 && gm0 && gf0 !== gm0 ? (S.hostility[key(gf0.id, gm0.id)] || 0) : 0;
    if (hh > 0.55) { if (f.trust[best.id] !== undefined && (f.trust[best.id] || 0) > -0.1 && f.age < 32 && best.age < 36 && f.role !== 'leader' && best.role !== 'leader' && rnd(S) < 0.35) elope(S, f, best); continue; }
    marry(S, f, best);
  }
  // births
  for (const a of S.agents) {
    if (a.sex !== 'f' || !a.spouse || a.age < 17 || a.age > 42) continue;
    if (S.tick - (a.lastBirth || -1e9) < 450) continue;
    const h = S._a.get(a.spouse); if (!h) { a.spouse = null; continue; }
    const g = S._g.get(a.group), store = g ? g.treasury / Math.max(1, g.members.length) : 1;
    const fert = clamp((a.wealth + h.wealth * 0.5 + store) / 8, 0.04, 1.6) * (a.wealth < 0.5 && store < 1 ? 0.4 : 1) * (g && g.home ? 1 : 0.55) * crowd * (g && g.sick ? 0.4 : 1);
    if (rnd(S) < 0.034 * fert) { const sx = rnd(S) < 0.5 ? 'f' : 'm'; S.kids.push({ t: S.tick, mo: a.id, fa: h.id, g: a.group, sex: sx, x: a.x, y: a.y }); a.lastBirth = S.tick; S.stats.births = (S.stats.births || 0) + 1; const tx = sx === 'f' ? 'Рождается дочь' : 'Рождается сын'; bio(S, a, 'child', tx); bio(S, h, 'child', tx); }
  }
  // children: cost, mortality, growing up
  const keep = [];
  for (const k of S.kids) {
    const mo = S._a.get(k.mo), fa = S._a.get(k.fa);
    let carer = mo || fa;
    if (!carer && S.tick % 90 === 0) { const sib = S.agents.find(o => (k.mo && o.mother === k.mo) || (k.fa && o.father === k.fa)); if (sib) { k.mo = sib.id; k.fa = sib.spouse || null; carer = sib; } }
    if (carer) { k.g = carer.group; k.x = carer.x; k.y = carer.y; }
    const g = S._g.get(k.g);
    let hungry = false;
    if (g && g.home && g.treasury > g.members.length * 1.5) g.treasury -= 0.33;
    else if (carer && carer.wealth > 0.5) carer.wealth -= 0.33;
    else if (g && g.treasury > 1) g.treasury -= 0.33;
    else hungry = true;
    const age = (S.tick - k.t) / 360;
    let pd = (age < 1 ? 0.013 : age < 5 ? 0.0035 : 0.0006) * (1 + 1.2 * ((g && g.dirty) || 0)) + (g && g.thirst ? 0.03 : 0) + (hungry ? (age < 5 ? 0.012 : 0.005) : 0) + (!carer ? 0.006 : 0) + (g && g.sick ? 0.04 : 0) + (g && g.home ? 0 : 0.0015);
    if (rnd(S) < pd) { S.stats.childDeaths = (S.stats.childDeaths || 0) + 1; const tx = `Умирает ${k.sex === 'f' ? 'дочь' : 'сын'}${age < 1 ? ' во младенчестве' : `, ${Math.floor(age)} ${pl(Math.floor(age), 'год', 'года', 'лет')}`}${g && g.sick ? ', от мора' : hungry ? ', от голода' : ''}`; if (mo) bio(S, mo, 'childDied', tx); if (fa) bio(S, fa, 'childDied', tx); continue; }
    if (age >= 15) { growUp(S, k, mo, fa, g); continue; }
    keep.push(k);
  }
  S.kids = keep;
}
function marry(S, f, m) {
  f.spouse = m.id; m.spouse = f.id; bump(f, m, 0.5); bump(m, f, 0.5);
  bio(S, f, 'marry', `Выходит замуж за ${m.name}${m.group && m.group !== f.group ? ` из «${groupName(S, m.group)}»` : ''}`); bio(S, m, 'marry', `Женится на ${f.name}${f.group && f.group !== m.group ? ` из «${groupName(S, f.group)}»` : ''}`);
  S.stats.marriages = (S.stats.marriages || 0) + 1;
  const gf = S._g.get(f.group), gm = S._g.get(m.group);
  if (gf === gm) return;
  // wife moves to husband's side, unless she leads
  if (gm && f.role !== 'leader') join(S, f, gm, m.id);
  else if (gf && m.role !== 'leader') join(S, m, gf, f.id);
  if (!gf || !gm || gf.dead || gm.dead) return;
  const LF = S._a.get(gf.leader), LM = S._a.get(gm.leader);
  const royal = x => x && (x.role === 'leader' || (LF && (x.mother === LF.id || x.father === LF.id)) || (LM && (x.mother === LM.id || x.father === LM.id)));
  const k = key(gf.id, gm.id);
  S.hostility[k] = (S.hostility[k] || 0) * (royal(f) || royal(m) ? 0.4 : 0.85);
  if (LF && LM) { bump(LF, LM, royal(f) || royal(m) ? 0.3 : 0.05); bump(LM, LF, royal(f) || royal(m) ? 0.3 : 0.05); }
  S.kinTies = S.kinTies || {}; S.kinTies[k] = (S.kinTies[k] || 0) + 1;
  if ((royal(f) || royal(m)) && gf.home && gm.home && (S.marLog || {})[k] === undefined || ((royal(f) || royal(m)) && S.tick - ((S.marLog || {})[k] || 0) > 360 * 6)) {
    S.marLog = S.marLog || {}; S.marLog[k] = S.tick;
    const al = allied(S, gf.id, gm.id);
    if (!al && (S.hostility[k] || 0) < 0.5) S.alliances.push({ a: gf.id, b: gm.id, since: S.tick, kin: true });
    const firstM = !S.firstMarriage; S.firstMarriage = true;
    log(S, 'marriage', `${firstM ? 'Первый в мире брачный союз' : 'Брачный союз'}: ${f.name} из «${gf.name}» выходит за ${m.name} из «${gm.name}»`, (gf.cx + gm.cx) / 2, (gf.cy + gm.cy) / 2, gm.hue, { why: sent([`${royal(f) && f.role !== 'leader' && (f.mother === (LF && LF.id) || f.father === (LF && LF.id)) ? `${f.name} — дочь вождя ${LF.name}` : royal(m) && m.role !== 'leader' ? `${m.name} — сын вождя ${LM ? LM.name : ''}` : 'жених или невеста из правящей семьи'}`, 'родство между правящими домами гасит вражду: вожди теперь доверяют друг другу больше', al ? 'союз деревень скреплён кровью' : 'деревни заключают союз', `всего браков между ними: ${S.kinTies[k]}`]), who: [f.id, m.id], gs: [gf.id, gm.id], first: firstM });
  }
}
function growUp(S, k, mo, fa, g) {
  const p = mo || fa;
  const a = spawn(S, 'child', { parent: p, mother: mo, father: fa, g, x: k.x, y: k.y });
  a.sex = k.sex; a.bornT = k.t;
  const par = [S._a.get(k.mo0 || k.mo), S._a.get(k.fa)].filter(Boolean);
  a.bio = [[k.t, 'born', `Рождается${g ? ` в «${g.name}»` : ' в пути'}${mo || fa ? `, ${a.sex === 'f' ? 'дочь' : 'сын'} ${[mo, fa].filter(Boolean).map(x => x.name).join(' и ')}` : ''}`]]; a.drama = 1;
  if (!mo && !fa) bio(S, a, 'orphan', 'Растёт сиротой: родителей уже нет в живых');
  if (k.plagueOrphan) bio(S, a, 'orphan', 'Родители умерли в мор');
  for (const o of S.agents) if (o !== a && ((a.mother && o.mother === a.mother) || (a.father && o.father === a.father))) { a.trust[o.id] = 0.4; o.trust[a.id] = 0.4; }
}
function plagueMonth(S) {
  const sick = S.groups.filter(g => g.sick > 0);
  if (!sick.length) return;
  for (const g of sick) {
    let dead = 0;
    for (const id of g.members.slice()) { const m = S._a.get(id); if (!m) continue; if (rnd(S) < 0.04 * (m.age > 50 ? 1.8 : 1) * (m.energy < 0.4 ? 1.4 : 1)) { removeAgent(S, m, 'plague'); dead++; } }
    for (const n of S.agents) if (!n.group && Math.hypot(n.x - g.cx, n.y - g.cy) < 160 && rnd(S) < 0.03) { removeAgent(S, n, 'plague'); dead++; }
    g.plDead = (g.plDead || 0) + dead; S.plague.dead += dead;
    g.sick--;
    if (g.dead) continue;
    for (const o of S.groups) {
      if (o === g || o.sick > 0 || !o.home || !g.home || (o.immune || 0) > S.tick) continue;
      const d = Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y), link = S.routes[key(o.id, g.id)] || (g.state && g.state === o.state) || allied(S, g.id, o.id);
      if ((d < 260 || link) && rnd(S) < (link ? 0.3 : 0.18) * (d < 260 ? 1 : 0.7)) { o.sick = 3 + Math.floor(rnd(S) * 4); o.plStart = S.tick; o.plPop = o.members.length; o.plDead = 0; S.plague.hit.push(o.id); }
    }
    if (g.sick <= 0) {
      g.immune = S.tick + 360 * 18; g.scarce = S.tick + 360 * 8;
      const share = g.plDead / Math.max(1, g.plPop);
      if (share >= 0.12 && g.members.length) {
        for (const id of g.members) bio(S, S._a.get(id), 'plague', `Переживает мор: в «${g.name}» умерли ${g.plDead} из ${g.plPop}`);
        for (const id of g.members) { const m = S._a.get(id); if (m && m.debt) { m.debt *= 0.4; if (m.bond && m.debt < 8) m.bond = false; } }
        log(S, 'plagueEnd', `Мор отступает от «${g.name}»: умерли ${g.plDead} из ${g.plPop}`, g.home.x, g.home.y, g.hue, { why: sent([`выжившим не хватает рук: поля стоят, а каждый работник теперь на счету`, 'простые люди требуют больших долей, и вождю приходится уступать', g.members.some(id => (S._a.get(id) || {}).debt) ? 'долги полегчали: многих кредиторов не стало' : '']), gs: [g.id] });
      }
    }
  }
  if (!S.groups.some(g => g.sick > 0)) {
    const p = S.plague;
    if (p.dead >= 6) log(S, 'plague', `Мор закончился: за ${yrs(Math.max(1, Math.round((S.tick - p.t) / 360)))} он прошёл через ${p.hit.length} ${pl(p.hit.length, 'деревню', 'деревни', 'деревень')} и унёс ${p.dead} ${pl(p.dead, 'жизнь', 'жизни', 'жизней')}`, undefined, undefined, 0, { why: 'Зараза шла по торговым дорогам и от деревни к соседке. Где умерли многие, выжившие стали дороже: доля вождя падает, долги прощаются.' });
    S.plague = null;
  }
}
function plagueYear(S) {
  if (S.plague) return;
  const pop = popOf(S), nr = Object.keys(S.routes).length;
  const p = 0.008 + 0.035 * clamp((pop - 160) / 320, 0, 1) + 0.01 * Math.min(1, nr / 10);
  if (rnd(S) > p) return;
  const vs = S.groups.filter(g => g.home && g.members.length >= 6 && (g.immune || 0) < S.tick);
  if (!vs.length) return;
  let tot = 0; const w = vs.map(g => { const v = (g.members.length + (g.trades || 0) * 0.2) * (1 + 2 * (g.dirty || 0)); tot += v; return v; });
  let r = rnd(S) * tot, g = vs[0]; for (let i = 0; i < vs.length; i++) { r -= w[i]; if (r <= 0) { g = vs[i]; break; } }
  g.sick = 4 + Math.floor(rnd(S) * 4); g.plStart = S.tick; g.plPop = g.members.length; g.plDead = 0;
  S.plague = { t: S.tick, dead: 0, hit: [g.id], from: g.id };
  S.stats.plagues = (S.stats.plagues || 0) + 1;
  log(S, 'plague', `Мор в «${g.name}»`, g.home.x, g.home.y, 0, { why: sent([`в мире ${pop} ${pl(pop, 'человек', 'человека', 'человек')}: чем теснее живут, тем легче заразе`, nr ? `${nr} ${pl(nr, 'торговая дорога', 'торговые дороги', 'торговых дорог')} разнесут её дальше` : '', `«${g.name}» — ${g.members.length} ${pl(g.members.length, 'человек', 'человека', 'человек')}${g.trades ? ` и ${g.trades} ${pl(g.trades, 'сделка', 'сделки', 'сделок')}` : ''}`]), gs: [g.id] });
}
function roomYear(S) {
  if (!S.own) return;
  for (const g of S.groups) {
    if (!g.home) continue;
    const hx = Math.floor(g.home.x / CS), hy = Math.floor(g.home.y / CS); let free = 0;
    for (let dy = -15; dy <= 15; dy++) for (let dx = -15; dx <= 15; dx++) {
      const x = hx + dx, y = hy + dy; if (x < 0 || y < 0 || x >= N || y >= N || dx * dx + dy * dy > 225) continue;
      const c = y * N + x; if (S.ter[c] === 'w' || S.ter[c] === 'h' || S.ter[c] === 's' || S.own[c] || S.occ[c]) continue; free++;
    }
    g.room = clamp((free - 40) / 160, 0, 1);
    let ps = 0, pn = 0; for (const o of S.groups) if (o !== g && o.home && Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y) < 400) { ps += o.pay * o.members.length; pn += o.members.length; }
    g.nbPay = pn ? ps / pn : g.pay;
  }
}
function imNote(S, g) {
  if (!g.imFrom) return;
  const e = S.events[0];
  if (e) { e.text += ` по примеру «${g.imFrom}»`; e.why = (e.why || '') + ` Это подражание, а не изобретение: «${g.imFrom}» рядом, многолюднее или богаче, и в «${g.name}» хотят жить так же.`; }
  g.imFrom = null;
}
function imitP(S, g, has, linkOnly) {
  if (!g.home) return { p: 0, from: null };
  let p = 0, from = null, fv = 0, cn = 0, cy = 0;
  for (const o of S.groups) {
    if (o === g || !o.home || o.dead) continue;
    const d = Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y), link = S.routes[key(o.id, g.id)] || allied(S, o.id, g.id) || g.lord === o.id || (S.kinTies || {})[key(o.id, g.id)];
    if ((d > 380 || linkOnly) && !link) continue;
    cn++;
    if (!has(o)) continue;
    cy++;
    const pr = Math.sqrt(Math.max(0.2, o.members.length / Math.max(1, g.members.length))) * Math.sqrt(Math.max(0.2, (o.pay + 0.5) / (g.pay + 0.5)));
    const v = Math.min(1.6, pr) * (link ? 1.5 : 0.7);
    p += v; if (v > fv) { fv = v; from = o; }
  }
  const conform = cn ? cy / cn : 0;
  return { p: 0.012 * p * (0.6 + conform), from };
}

function step(S) {
  S.tick++;
  if (!S.wear) navInit(S);
  if (!S.springs) springsInit(S);
  { const d = S.tick % 360, fr = d >= 12 && d < 78; if (fr !== S.frozen) { S.frozen = fr; S.navV++; } }
  const P = S.params;
  const reg = 0.38 * (1.25 - P.scarcity) * (S.tick < S.drought ? 0.3 : 1) * (seasonOf(S.tick) === 0 ? 0.45 : 1.15);
  const regF = 0.38 * (1.25 - P.scarcity) * 1.9;
  for (const n of S.nodes) n.amt = Math.min(n.cap, n.amt + (n.kind === 'fish' ? regF : reg * 1.25));
  for (const g of S.groups) {
    let sx = 0, sy = 0;
    for (const id of g.members) { const m = S._a.get(id); sx += m.x; sy += m.y; }
    g.cx = sx / g.members.length; g.cy = sy / g.members.length;
    if (g.home) { g.cx = g.home.x; g.cy = g.home.y; }
  }
  move(S);
  deliver(S);
  caravans(S);
  wars(S);
  if (S.tick % 6 === 0) patrol(S);
  produce(S);
  lifecycle(S);
  if (S.tick % 30 === 0) monthly(S);
  inflow(S);
}

function nodeOf(S, id) { for (const n of S.nodes) if (n.id === id) return n; return null; }

function move(S) {
  const A = S.agents;
  for (const a of A) {
    let tx, ty;
    const gH = a.group && S._g.get(a.group);
    const wp = a.war ? warTarget(S, a) : null;
    const cp = !wp && a.car ? carTarget(S, a) : null;
    if (wp) { tx = wp.x + ((a.id * 7) % 15 - 7); ty = wp.y + ((a.id * 11) % 15 - 7); }
    else if (cp) { tx = cp.x + ((a.id * 7) % 9 - 4); ty = cp.y + ((a.id * 11) % 9 - 4); }
    else if (gH && gH.home) {
      const g = gH, j = ((a.id * 37) % 13) - 6, j2 = ((a.id * 53) % 11) - 5;
      let p = null;
      if (a.haul && a.load) p = storeOf(g, a.lk);
      else if (a.job === 'farm' && g.fields.length) p = g.fields[(a.slot || 0) % g.fields.length];
      else if (a.job === 'wood' && g.woodCell !== null) p = { x: (g.woodCell % 50) * 20 + 10, y: Math.floor(g.woodCell / 50) * 20 + 10 };
      else if (a.job === 'build' && g.site) p = g.site;
      else if (a.job === 'stone' && g.stoneCell !== null) p = { x: (g.stoneCell % 50) * 20 + 10, y: Math.floor(g.stoneCell / 50) * 20 + 10 };
      else if (a.job === 'craft') p = g.workshop || g.home;
      else if (a.job === 'pray' && g.shrine) p = g.shrine;
      else if (a.job === 'fish' && g.landing) p = { x: g.landing.x + ((a.id * 7) % 9) - 4, y: g.landing.y + ((a.id * 3) % 9) - 4 };
      else if (a.job === 'herd' && g.pasture) p = { x: g.pasture.x + Math.cos(S.tick / 90 + a.id) * 22, y: g.pasture.y + Math.sin(S.tick / 90 + a.id) * 22 };
      else if (a.job === 'water' && g.wsrc) { const tgt = a.wc ? g.home : g.wsrc; if (Math.hypot(a.x - tgt.x, a.y - tgt.y) < 14) a.wc = !a.wc; p = a.wc ? g.home : g.wsrc; }
      else if (a.job === 'guard') {
        const bc = g.bcells || [];
        if (bc.length && a.id % 3 !== 0) { const c = bc[(a.id * 7 + Math.floor(S.tick / 160)) % bc.length]; p = { x: (c % 50) * 20 + 10, y: Math.floor(c / 50) * 20 + 10 }; }
        else { const ang = a.id * 1.7 + S.tick / 140, r = g.walls ? wallR(g) : 34; p = { x: g.home.x + Math.cos(ang) * r, y: g.home.y + Math.sin(ang) * r }; }
      }
      else if (a.job === 'gather') p = nodeOf(S, g.target);
      if (!p || a.role === 'leader' || a.job === 'lead') { const ang = a.id * 2.39996, r = a.role === 'leader' ? 4 : 10 + (a.id % 4) * 6; p = { x: g.home.x + Math.cos(ang) * r, y: g.home.y + Math.sin(ang) * r }; }
      tx = p.x + j * (a.job === 'gather' ? 3 : 1.2); ty = p.y + j2 * (a.job === 'gather' ? 3 : 1.2);
    } else if (a.group) {
      const g = S._g.get(a.group);
      if (a.role === 'leader') {
        const n = nodeOf(S, g.target);
        const ga = g.id * 2.39996;
        tx = n ? n.x + Math.cos(ga) * 40 : g.cx; ty = n ? n.y + Math.sin(ga) * 40 : g.cy;
        tx += Math.sin(S.tick / 47 + a.id) * 12; ty += Math.cos(S.tick / 53 + a.id) * 12;
      } else {
        const b = S._a.get(a.boss) || S._a.get(g.leader);
        const ang = (a.id * 2.39996) % (Math.PI * 2) + Math.sin(S.tick / 90 + a.id) * 0.4;
        const r = 26 + (a.id % 3) * 9;
        tx = b.x + Math.cos(ang) * r; ty = b.y + Math.sin(ang) * r;
      }
    } else {
      let n = nodeOf(S, a.tnode);
      if (!n || n.amt < 4 || (S.tick + a.id) % 90 === 0) {
        let bv = -1;
        for (const q of S.nodes) { const v = (q.amt + 2) / (1 + Math.hypot(q.x - a.x, q.y - a.y) / 110) * (0.7 + rnd(S) * 0.6) * (S.own && S.own[cellAt(q.x, q.y)] ? 0.4 : 1); if (v > bv) { bv = v; n = q; } }
        a.tnode = n ? n.id : null;
      }
      tx = n ? n.x + Math.cos(a.id) * 22 : a.x; ty = n ? n.y + Math.sin(a.id) * 22 : a.y;
    }
    if (S.ter[cellAt(a.x, a.y)] === 's' || (S.ter[cellAt(a.x, a.y)] === 'w' && !passCost(S, cellAt(a.x, a.y)))) toLand(S, a);
    const ca = cellAt(a.x, a.y), ct = cellAt(tx, ty); let onPath = false;
    if (ca !== ct) {
      const far = Math.abs(ca % N - ct % N) + Math.abs(((ca / N) | 0) - ((ct / N) | 0)) > 2;
      const bk = ca * 2500 + ct; if (a.bkK !== bk || a.bkV !== S.navV) { a.bkK = bk; a.bkV = S.navV; a.bkR = !far && blocked(S, a.x, a.y, tx, ty); }
      if (far || a.bkR) { const wp = navStep(S, a, ca, ct); if (wp) { tx = wp.x; ty = wp.y; a.stuck = 0; onPath = far; } else { tx = a.x; ty = a.y; a.stuck = (a.stuck || 0) + 1; } }
    }
    const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy) || 1, pc = passCost(S, ca) || 3;
    const sp = Math.min(d, 2.4 * (0.5 + a.energy) * (a.car ? 1.6 : 1) / Math.pow(Math.max(0.5, pc), 0.4));
    let nx = a.x + dx / d * sp + gauss(S) * 0.5, ny = a.y + dy / d * sp + gauss(S) * 0.5;
    const nc = cellAt(nx, ny);
    if (nc !== ca && !passCost(S, nc)) { nx = a.x; ny = a.y; }
    a.x = nx; a.y = ny;
    if (sp > 1.1) S.wear[nc] += a.car ? 7 : a.war ? 3 : onPath ? 2.5 : 1;
    if (nc !== a.lc) {
      if (S.ter[nc] === 'w' && !S.bridge[nc]) {
        const gg = a.group && S._g.get(a.group); if (gg) gg.cross = (gg.cross || 0) + 1;
        // a ford is dangerous in the spring flood and with a load on the back; thin ice at the start and end of winter
        const dy = S.tick % 360, flood = dy >= 90 && dy < 150, risk = S.frozen ? (dy < 20 || dy >= 70 ? 0.002 : 0.0004) : flood ? 0.008 : 0.00025;
        if (rnd(S) < risk * (a.car ? 3 : 1) * (a.age > 55 ? 1.5 : 1)) (S._drown || (S._drown = [])).push(a);
      }
      a.lc = nc;
    }
  }
  if (S._drown && S._drown.length) { for (const a of S._drown) drown(S, a); S._drown = []; }
  const X = A.slice().sort((p, q) => p.x - q.x);
  for (let i = 0; i < X.length; i++) {
    const a = X[i];
    for (let j = i + 1; j < X.length; j++) {
      const b = X[j], dx = b.x - a.x, dy = b.y - a.y;
      if (dx > 55) break;
      if (dy > 55 || dy < -55) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 < 81) { const d = Math.sqrt(d2) || 1, f = (9 - d) * 0.25 / d; a.x -= dx * f; a.y -= dy * f; b.x += dx * f; b.y += dy * f; }
      if (d2 < 3025 && rnd(S) < 0.02) interact(S, a, b);
    }
  }
  for (const a of A) { a.x = clamp(a.x, 6, 994); a.y = clamp(a.y, 6, 994); }
}

function bump(a, b, d) { a.trust[b.id] = clamp((a.trust[b.id] || 0) + d, -1, 1); }
function allied(S, x, y) { return S.alliances.some(al => (al.a === x && al.b === y) || (al.a === y && al.b === x)); }

function interact(S, a, b) {
  if (!S._a.has(a.id) || !S._a.has(b.id)) return;
  const ga = a.group, gb = b.group;
  if (a.trust[b.id] === undefined) a.trust[b.id] = 0.25 * (b.rep || 0);
  if (b.trust[a.id] === undefined) b.trust[a.id] = 0.25 * (a.rep || 0);
  if (ga && ga === gb) { const Lid = S._g.get(ga).leader; if (Lid !== a.id && Lid !== b.id) { const ta = a.trust[Lid] || 0, tb = b.trust[Lid] || 0, w = 0.05; if ((a.trust[b.id] || 0) > 0.1) a.trust[Lid] = ta + (tb - ta) * w; if ((b.trust[a.id] || 0) > 0.1) b.trust[Lid] = tb + (ta - tb) * w; } }
  if (ga && ga === gb) {
    const d = 0.025 * (a.coop + b.coop) / 2 - 0.012 * (a.res + b.res) / 2;
    bump(a, b, d); bump(b, a, d);
    const g = S._g.get(ga);
    for (const [x, y] of [[a, b], [b, a]]) {
      if (x.id !== g.leader && y.id !== g.leader && x.ambition > 0.6 && y.res > 0.15) {
        y.trust[g.leader] = clamp((y.trust[g.leader] || 0) - 0.035 * x.ambition * (0.3 + y.res), -1, 1);
        x.intr = (x.intr || 0) + 1;
        bump(y, x, 0.03 * x.ambition);
      }
      if (y.id === g.leader && x.res < 0.2) bump(x, y, 0.01);
    }
  } else if (!ga && !gb) {
    const d = 0.08 * (a.coop + b.coop) / 2 - 0.012; bump(a, b, d); bump(b, a, d);
    if ((a.trust[b.id] || 0) > 0.22 && (b.trust[a.id] || 0) > 0.22 && rnd(S) < 0.05) {
      const sc = m => m.ambition * 0.7 + m.skill * 0.3 + m.status * 0.05;
      const L = sc(a) >= sc(b) ? a : b, o = L === a ? b : a;
      const g = createGroup(S, L, [o]);
      log(S, 'found', `${L.name} и ${o.name} основывают «${g.name}»`, L.x, L.y, g.hue, { why: `Доверие между ними выросло выше порога, а вместе они добывают больше, чем поодиночке. Лидером становится ${L.name}: у него больше амбиций.`, who: [L.id, o.id], gs: [g.id] });
    }
  } else if (!ga || !gb) {
    const s = ga ? b : a, m = ga ? a : b, g = S._g.get(m.group), L = S._a.get(g.leader);
    bump(s, m, 0.035 * s.coop + 0.008); bump(m, s, 0.02 * m.coop);
    const open = 0.18 + 0.5 * L.coop - 0.004 * g.members.length;
    if ((s.trust[m.id] || 0) > (s.wealth < 1 ? 0.12 : 0.22) && rnd(S) < open * (s.wealth < 1 ? 0.9 : 0.5)) { join(S, s, g, m.id); s.trust[g.leader] = Math.max(s.trust[g.leader] || 0, 0.1); }
  } else {
    const h = S.hostility[key(ga, gb)] || 0, al = allied(S, ga, gb);
    const d = al ? 0.02 : h > 0.4 ? -0.03 * h : 0.012 * (a.coop + b.coop) / 2 - 0.004;
    bump(a, b, d); bump(b, a, d);
    const gA = S._g.get(ga), gB = S._g.get(gb);
    for (const [x, y, gx, gy] of [[a, b, gA, gB], [b, a, gB, gA]]) {
      if (x.res > 0.45 && x.id !== gx.leader && (x.trust[y.id] || 0) > 0.25 && gy.pay > gx.pay * 1.2 && rnd(S) < 0.1) { join(S, x, gy, y.id); gy.poached = (gy.poached || 0) + 1; break; }
    }
  }
}

function produce(S) {
  const P = S.params, claims = new Map(), season = seasonOf(S.tick);
  const add = (n, c) => { if (!claims.has(n.id)) claims.set(n.id, { n, list: [] }); claims.get(n.id).list.push(c); };
  for (const g of S.groups) {
    const k = g.members.length, syn = (1 + P.synergy * 4 * (1 - Math.exp(-(k - 1) / 6))) / (1 + g.entropy);
    const n = nodeOf(S, g.target), L = S._a.get(g.leader);
    if (!g.home) {
      if (!n || !L || Math.hypot(L.x - n.x, L.y - n.y) > 90) continue;
      let E = 0;
      for (const id of g.members) { const m = S._a.get(id), e = m.skill * m.energy; m.eff += e; E += e; m.energy -= 0.0012 * (1 + g.entropy * 0.7); }
      add(n, { g, pot: 0.14 * E * syn });
      continue;
    }
    let gpot = 0, workers = 0;
    g._gath = [];
    const tm = 1 + 0.5 * Math.min(1, g.tools / Math.max(1, k * 0.6));
    for (const id of g.members) {
      const m = S._a.get(id), e = jobSkill(m, m.job) * m.energy * tm;
      let worked = false;
      if (m.haul) continue;
      if (m.job === 'gather') { if (n && Math.hypot(m.x - n.x, m.y - n.y) < 70) { const pt = 0.12 * e * syn * HAUL; gpot += pt; g._gath.push([m, pt]); worked = true; } }
      else if (m.job === 'farm') {
        const f = g.fields[(m.slot || 0) % Math.max(1, g.fields.length)];
        if (f && season !== 0 && Math.hypot(m.x - f.x, m.y - f.y) < 30) {
          const v = 0.34 * e * syn * f.fert * (S.tick < S.drought ? 0.4 : 1) * (1.2 - 0.5 * P.scarcity) * HAUL;
          const ow = f.owner && S._a.get(f.owner);
          if (g.land === 'private' && ow && ow.group === g.id) { if (ow === m) { m.wealth += v * 0.5; load(m, 'food', v * 0.5); } else { ow.wealth += v * 0.35; m.wealth += v * 0.15; load(m, 'food', v * 0.5); m.hired = S.tick; } }
          else load(m, 'food', v);
          worked = true;
        }
      } else if (m.job === 'wood') {
        const c = g.woodCell;
        if (c !== null && S.wood[c] > 1 && Math.hypot(m.x - ((c % 50) * 20 + 10), m.y - (Math.floor(c / 50) * 20 + 10)) < 30) { const v = 0.1 * e * syn * HAUL; S.wood[c] -= v; load(m, 'wood', v); worked = true; }
      } else if (m.job === 'build') {
        const st = g.site;
        if (st && Math.hypot(m.x - st.x, m.y - st.y) < 26) { st.prog += e * syn; worked = true; if (st.prog >= st.need) finishSite(S, g); }
      } else if (m.job === 'stone') {
        const c = g.stoneCell;
        if (c !== null && Math.hypot(m.x - ((c % 50) * 20 + 10), m.y - (Math.floor(c / 50) * 20 + 10)) < 30) { load(m, 'stone', 0.07 * e * syn * HAUL); worked = true; }
      } else if (m.job === 'craft') {
        const w = g.workshop || g.home;
        if (w && Math.hypot(m.x - w.x, m.y - w.y) < 26) {
          const n0 = g.members.length, want = g.workshop && g.tools < n0 * 0.6 && g.wood >= 1 && g.stone >= 1 ? 'tools' : (g.pots || 0) < n0 * 0.5 ? 'pots' : (g.goats || 0) >= 4 && (g.cloth || 0) < n0 * 0.6 ? 'cloth' : g.workshop && g.wood >= 1 && g.stone >= 1 && g.tools < n0 * 1.2 ? 'tools' : null;
          if (want) {
            g.craftProg = (g.craftProg || 0) + e * syn; worked = true; m.craftKind = want;
            if (g.craftProg >= 25) {
              g.craftProg -= 25; m.made = (m.made || 0) + 2;
              if (want === 'tools') { g.wood -= 1; g.stone -= 1; g.tools += 2; }
              else if (want === 'pots') g.pots = (g.pots || 0) + 3;
              else { g.cloth = (g.cloth || 0) + 2; }
            }
          }
        }
      }
      if (worked) {
        m.eff += e; m.energy -= 0.0012 * (1 + g.entropy * 0.7); workers++;
        const before = m.xp[m.job] || 0; m.xp[m.job] = before + 0.0009;
        if (before < 1 && m.xp[m.job] >= 1) { m.master = m.job; bio(S, m, 'master', `Становится мастером: ${TITLE[m.job]}${m.teacherName ? `, как ${m.sex === 'f' ? 'её' : 'его'} учитель ${m.teacherName}` : ''}`); if (!S.masters) S.masters = {}; if (!S.masters[m.job]) { S.masters[m.job] = 1; log(S, 'tech', `${m.name} становится первым в мире: ${TITLE[m.job]}`, m.x, m.y, g.hue, { why: `Три года одной и той же работы. Опыт поднимает выработку на 60%, поэтому лидер ставит мастера на его дело в первую очередь. Так рождается специализация.`, who: [m.id], gs: [g.id] }); } }
      }
    }
    if (g.tools > 0) g.tools = Math.max(0, g.tools - workers * 0.0014);
    if (gpot > 0 && n) add(n, { g, pot: gpot });
  }
  for (const a of S.agents) {
    if (a.group) continue;
    const n = nodeOf(S, a.tnode); if (!n || Math.hypot(a.x - n.x, a.y - n.y) > 75) continue;
    const e = a.skill * a.energy; a.eff += e; a.energy -= 0.0012;
    add(n, { a, pot: 0.13 * e });
  }
  for (const { n, list } of claims.values()) {
    const tot = list.reduce((s, c) => s + c.pot, 0), f = tot > n.amt ? n.amt / tot : 1;
    n.amt -= tot * f;
    const gs = list.filter(c => c.g);
    for (const c of list) {
      const v = c.pot * f;
      if (c.g) {
        if (c.g.home && c.g._gath && c.g._gath.length) { const tot2 = c.g._gath.reduce((s2, x) => s2 + x[1], 0) || 1; for (const [m, pt] of c.g._gath) load(m, 'food', v * pt / tot2); }
        else c.g.treasury += v;
        if (gs.length > 1) { c.g.rivals = c.g.rivals || {}; for (const o of gs) if (o !== c) c.g.rivals[o.g.id] = (c.g.rivals[o.g.id] || 0) + (1.2 - f); }
      }
      else c.a.wealth += v;
    }
  }
}

function lifecycle(S) {
  const dead = [], winter = seasonOf(S.tick) === 0;
  for (const a of S.agents) {
    a.age += 1 / 360;
    a.wealth -= a.age < 18 ? 0.025 : 0.033;
    if (a.wealth < -1.5) a.wealth = -1.5; // hunger is what one lacks now, not a debt that grows without end
    if (a.wealth < 0) a.energy -= 0.0008; else a.energy += 0.003 * (1.05 - a.energy);
    const gq = a.group && S._g.get(a.group); if (gq && gq.home) { if (gq.thirst) a.energy -= 0.0016; else if (gq.wShort > 1) a.energy -= 0.0012; }
    if (winter) { if (a.shel && a.group) a.energy += 0.0004; else a.energy -= 0.0008; }
    a.energy = clamp(a.energy, 0, 1);
    if (a.age > a.life) dead.push([a, 'death']);
    else if (a.energy < 0.03) dead.push([a, 'burnout']);
    else if (rnd(S) < (0.004 + 0.0013 * Math.exp((a.age - 25) / 11)) / 360 * (a.energy < 0.3 ? 1.5 : 1) * (winter ? (a.group && ((S._g.get(a.group) || {}).cloth || 0) >= ((S._g.get(a.group) || {}).members || []).length * 0.5 ? 1.05 : 1.25) : 0.9) * (1 + 1.6 * ((a.group && (S._g.get(a.group) || {}).dirty) || 0))) dead.push([a, 'sick']);
  }
  for (const [a, why] of dead) removeAgent(S, a, why);
}

function removeAgent(S, a, why) {
  if (!S._a.has(a.id)) return;
  S.stats[why] = (S.stats[why] || 0) + 1;
  if (why === 'emigr') legend(S, a, 'emigr');
  if (why !== 'move' && why !== 'emigr') {
    const DW = { sick: 'Умирает от болезни', death: 'Умирает от старости', burnout: 'Умирает от истощения и голода', war: 'Гибнет в бою', plague: 'Умирает от мора', drown: 'Тонет при переправе', killed: a.sex === 'f' ? 'Убита' : 'Убит' };
    if (why !== 'killed') bio(S, a, why === 'drown' ? 'drowned' : 'death', `${DW[why] || 'Умирает'}${a.age ? `, ${Math.floor(a.age)} ${pl(Math.floor(a.age), 'год', 'года', 'лет')}` : ''}`);
    const sp0 = a.spouse && S._a.get(a.spouse); if (sp0) bio(S, sp0, 'spouseDied', `${a.sex === 'f' ? 'Умирает жена' : 'Умирает муж'} ${a.name}${why === 'war' ? ', в бою' : why === 'plague' ? ', от мора' : why === 'killed' ? ', убит' : ''}`);
    legend(S, a, why);
    const kids = S.agents.filter(o => o !== a && (o.mother === a.id || o.father === a.id)), sp = a.spouse && S._a.get(a.spouse);
    const w = Math.max(0, a.wealth), g = S._g.get(a.group);
    if (kids.length) { for (const k of kids) { k.wealth += w * (sp ? 0.7 : 1) / kids.length; if (w / kids.length > 12) bio(S, k, 'inherit', `Наследует от ${a.sex === 'f' ? 'матери' : 'отца'} ${a.name} запас ${Math.round(w * (sp ? 0.7 : 1) / kids.length)}`); } if (sp) sp.wealth += w * 0.3; }
    else if (sp) sp.wealth += w; else if (g) g.treasury += w * 0.5;
    if (sp) sp.spouse = null;
    const heir = kids.filter(k => k.group === a.group).sort((x, y) => y.age - x.age)[0];
    for (const o of S.agents) if (o.patron === a.id) o.patron = heir && rnd(S) < 0.6 ? heir.id : null;
  }
  if (a.group) leave(S, a, why);
  S.agents = S.agents.filter(x => x !== a); S._a.delete(a.id);
}

function inflow(S) {
  if (S.isle) return; // on the island newcomers arrive only by boat
  const P = S.params, pop = S.agents.length;
  const p = P.inflow * 2.5 / 360 * (popOf(S) > 450 ? 0.2 : 1);
  if (rnd(S) >= p) return;
  if (false) {
    let tot = 0; const w = S.groups.map(g => { const v = Math.max(0.1, g.pay) * g.members.length * (1 + Math.min(2, g.treasury / (g.members.length * 12 + 1))) * (g.home ? 1.3 : 1); tot += v; return v; });
    let r = rnd(S) * tot, g = S.groups[0];
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { g = S.groups[i]; break; } }
    const parent = S._a.get(g.members[Math.floor(rnd(S) * g.members.length)]);
    if (parent) spawn(S, 'child', { parent });
  } else spawn(S, 'out');
}

function monthly(S) {
  const P = S.params, decay = 0.01 + 0.07 * (1 - P.memory);
  for (const a of S.agents) {
    for (const k in a.trust) { const v = a.trust[k] * (1 - decay); if ((v < 0.02 && v > -0.02) || !S._a.has(+k)) delete a.trust[k]; else a.trust[k] = v; }
    a.status *= 0.97; a.intr = (a.intr || 0) * 0.85;
    if (a.wealth > 10) { const gg = a.group && S._g.get(a.group); if (!gg || !gg.coin) a.wealth -= (a.wealth - 10) * 0.02; }
    if (a.wealth > 30) { const sp = (a.wealth - 30) * 0.03, gg = a.group && S._g.get(a.group); a.wealth -= sp; if (gg) gg.treasury += sp * 0.5; }
    if (!a.group) { a.status += a.eff * 0.03; a.eff = 0; }
  }
  // the hungry scrape by: roots, shellfish, birds; and food flows from the rich
  const seas = seasonOf(S.tick), dry = S.tick < (S.drought || 0), hungryAll = S.agents.filter(a => a.wealth < 1);
  const crowdAt = {}; for (const a of hungryAll) { const k = (Math.floor(a.x / 100)) + ':' + Math.floor(a.y / 100); crowdAt[k] = (crowdAt[k] || 0) + 1; }
  for (const a of hungryAll) {
    const c = cellAt(a.x, a.y), t = S.ter[c], ci = c % N, cj = (c / N) | 0; let shore = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) { const x = ci + dx, y = cj + dy; if (x >= 0 && y >= 0 && x < N && y < N) { const q = S.ter[y * N + x]; if (q === 's' || q === 'b') shore = true; } }
    let f = shore ? 1.2 : t === 'f' ? 0.95 : t === 'r' || t === 'w' ? 0.85 : t === 'h' ? 0.5 : 0.75;
    f *= (seas === 0 ? (shore ? 0.8 : 0.45) : 1) * (dry ? 0.5 : 1) * 1.25 / (1 + (crowdAt[(Math.floor(a.x / 100)) + ':' + Math.floor(a.y / 100)] || 1) / 20);
    a.wealth += f; S.stats.foraged = (S.stats.foraged || 0) + f;
    if (a.wealth > 0.5) continue;
    // alms or theft at a rich village nearby
    let rich = null, rd = 170;
    for (const g of S.groups) { if (!g.home || g.id === a.group || g.treasury < g.members.length * 6) continue; const d = Math.hypot(g.home.x - a.x, g.home.y - a.y); if (d < rd) { rd = d; rich = g; } }
    if (!rich) continue;
    const L = S._a.get(rich.leader);
    if (L && rnd(S) < 0.25 + 0.6 * L.coop + 0.3 * ((a.rep || 0))) { rich.treasury -= 1.5; a.wealth += 1.5; bump(a, L, 0.08); L.rep = clamp((L.rep || 0) + 0.01, -1, 1); S.stats.alms = (S.stats.alms || 0) + 1; }
    else if (a.coop < 0.45 && rnd(S) < 0.35) {
      rich.treasury -= 2; a.wealth += 2; S.stats.theft = (S.stats.theft || 0) + 1;
      if (rnd(S) < 0.3) { a.rep = clamp((a.rep || 0) - 0.2, -1, 1); if (a.group) { const k = key(a.group, rich.id); S.hostility[k] = Math.min(2, (S.hostility[k] || 0) + 0.08); } if (!a.bioTheft || S.tick - a.bioTheft > 3600) { a.bioTheft = S.tick; bio(S, a, 'theft', `Голодая, крадёт зерно из амбара «${rich.name}» и попадается`); } }
    }
  }
  for (const a of S.agents) {
    if (a.wealth < 0.5) {
      const sp = a.spouse && S._a.get(a.spouse); if (sp && sp.wealth > 2) { const d = Math.min(sp.wealth - 1, 2 - a.wealth); sp.wealth -= d; a.wealth += d; }
      else for (const o of [S._a.get(a.mother), S._a.get(a.father)]) if (o && o.group === a.group && o.wealth > 4) { const d = Math.min(o.wealth - 2, 2); o.wealth -= d; a.wealth += d; break; }
      const g = a.group && S._g.get(a.group); if (a.wealth < 0 && g && g.treasury > 1) { const d = Math.min(g.treasury * 0.5, 1.5 - a.wealth); g.treasury -= d; a.wealth += d; }
    }
  }
  for (const a of S.agents) {
    if (a.wealth > 1 || a.age < 15) continue;
    const g0 = a.group && S._g.get(a.group);
    if (g0 && (g0.members.length > 4 || a.role === 'leader' || g0.treasury > g0.members.length * 2)) continue;
    let best = null, bv = -1e9;
    for (const g of S.groups) { if (!g.home || g.dead || g === g0 || g.members.length < (g0 ? 5 : 3)) continue; const d = Math.hypot(g.home.x - a.x, g.home.y - a.y); if (d > (g0 ? 380 : 600)) continue; const v = g.treasury / Math.max(1, g.members.length) - d / 60 + (a.exiledFrom === g.id ? -50 : 0); if (v > bv) { bv = v; best = g; } }
    if (!best || !reach(S, a.x, a.y, best.home.x, best.home.y)) continue;
    const L = S._a.get(best.leader); if (!L) continue;
    if (rnd(S) < (0.35 * (0.5 + L.coop) + Math.min(0.4, best.treasury / Math.max(1, best.members.length) / 25)) * ((a.rep || 0) > -0.3 ? 1 : g0 ? 0.2 : 0.45) + (g0 ? 0 : 0.15)) { join(S, a, best, best.leader); bio(S, a, 'move', `Голодая, нанимается работать за еду в «${best.name}»`); }
  }
  for (const a of S.agents) { a.rep = (a.rep || 0) * 0.98; a.ref = Math.max((a.ref || 3) * 0.985, a.wealth); if (a.age > 55 && a.group) a.status += 0.05; }
  seaMonth(S);
  waterMonth(S);
  families(S);
  plagueMonth(S);
  fatesMonth(S);
  for (let c = 0; c < S.wood.length; c++) if (S.ter[c] === 'f' && S.wood[c] < 60) S.wood[c] = Math.min(60, S.wood[c] + 0.35);
  if (S.ruins) S.ruins = S.ruins.filter(r => S.tick - r.t < 360 * 25);
  for (const g of S.groups.slice()) { if (!g.dead) groupMonth(S, g); }
  aidMonth(S);
  relations(S);
  tradeMonth(S);
  warMonth(S);
  marketWatch(S);
  sample(S);
  if (S.tick % 360 === 0) yearly(S);
}

// a hungry village asks its neighbours for grain; kin ties (parents and children living there) and friendly leaders make help likely
function aidMonth(S) {
  const needy = S.groups.filter(g => g.home && !g.dead && g.treasury < g.members.length * 1.2 && g.members.filter(id => { const m = S._a.get(id); return m && m.wealth < 0.3; }).length >= Math.max(2, g.members.length * 0.25));
  if (!needy.length) return;
  const tie = {};
  for (const a of S.agents) { if (!a.group) continue; for (const pid of [a.mother, a.father]) { const p = pid && S._a.get(pid); if (p && p.group && p.group !== a.group) { const k = key(a.group, p.group); tie[k] = (tie[k] || 0) + 1; } } }
  for (const g of needy) {
    const LG = S._a.get(g.leader), n = g.members.length; if (!LG) continue;
    let best = null, bv = 0;
    for (const o of S.groups) {
      if (o === g || !o.home || o.dead || o.treasury < o.members.length * 4) continue;
      const k = key(g.id, o.id), h = S.hostility[k] || 0, d = Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y);
      if (h > 0.6 || d > 420 || S.wars.some(w => (w.att === o.id && w.def === g.id) || (w.att === g.id && w.def === o.id))) continue;
      const LO = S._a.get(o.leader); if (!LO) continue;
      const t = tie[k] || 0, friend = allied(S, g.id, o.id) || (g.state && g.state === o.state) || g.lord === o.id || o.lord === g.id;
      const p = clamp(0.25 + 0.35 * LO.coop + 0.12 * Math.min(4, t) + (friend ? 0.25 : 0) + 0.3 * ((LO.trust[LG.id] || 0)) - 0.4 * h, 0, 0.9);
      const v = p * (o.treasury / o.members.length) / (1 + d / 250);
      if (v > bv) { bv = v; best = { o, p, t, friend, LO, d }; }
    }
    if (!best || rnd(S) > best.p || !reach(S, best.o.home.x, best.o.home.y, g.home.x, g.home.y)) continue;
    const { o, t, friend, LO } = best, amt = Math.min((o.treasury - o.members.length * 3) * 0.4, n * 2);
    if (amt < 1) continue;
    o.treasury -= amt; g.treasury += amt; S.stats.aid = (S.stats.aid || 0) + 1; S.stats.aidFood = (S.stats.aidFood || 0) + amt;
    const k = key(g.id, o.id); S.hostility[k] = Math.max(0, (S.hostility[k] || 0) - 0.15);
    bump(LG, LO, 0.15); LO.rep = clamp((LO.rep || 0) + 0.03, -1, 1); LO.status += 0.3;
    g.aidFrom = g.aidFrom || {};
    if (!g.aidFrom[o.id] || S.tick - g.aidFrom[o.id] > 360 * 5) log(S, 'aid', `«${o.name}» посылает зерно голодающей «${g.name}»: ${qty(amt, 'food')}`, g.home.x, g.home.y, o.hue, { why: sent([t ? `у ${t} ${pl(t, 'жителя', 'жителей', 'жителей')} «${g.name}» родители или дети живут в «${o.name}»` : '', friend ? 'деревни в союзе' : '', LO.coop > 0.6 ? `${LO.name} щедр${LO.sex === 'f' ? 'а' : ''} и не бросает соседей` : '', `в «${o.name}» запасено ${Math.round(o.treasury + amt)} еды на ${o.members.length} ${pl(o.members.length, 'едока', 'едоков', 'едоков')}`, 'такую помощь помнят долго']), who: [LO.id, LG.id], gs: [o.id, g.id] });
    g.aidFrom[o.id] = S.tick;
  }
}
function groupMonth(S, g) {
  const P = S.params, L = S._a.get(g.leader);
  if (!L) return;
  const mem = g.members.map(id => S._a.get(id)).filter(m => m !== L);
  const n = mem.length + 1;
  // distribution
  if (g.lord) tribute(S, g);
  if (g.dead) return;
  g.treasury *= g.granary ? 0.997 : 0.985;
  const fcap = n * (g.granary ? 22 : 10) * ((g.pots || 0) >= n * 0.5 ? 1.3 : 1); if (g.treasury > fcap) g.treasury -= (g.treasury - fcap) * 0.25;
  if (g.pots) g.pots *= 0.985; if (g.cloth) g.cloth *= 0.97; if (g.tools > n * 2) g.tools *= 0.97;
  const wcap = 20 + n * 4; if (g.wood > wcap) g.wood -= (g.wood - wcap) * 0.1;
  const scap = 12 + n * 2; if (g.stone > scap) g.stone -= (g.stone - scap) * 0.1;
  const pool = Math.min(g.treasury * 0.85, n * 1.6); g.treasury -= pool;
  const lt = pool * g.take; L.wealth += lt; L.status += 0.5 + lt * 0.05;
  const R = pool - lt;
  let sE = 0, sS = 0; for (const m of mem) { sE += m.eff; sS += m.status; }
  sE = sE || 1; sS = sS || 1;
  const egal = R / Math.max(1, mem.length), nepo = mem.filter(m => kin(m, L)).length >= 2;
  if (g.take > 0.22) L.rep = clamp((L.rep || 0) - 0.012 * (g.take - 0.2) * 10, -1, 1);
  const floor = Math.min(egal, 1.15), R2 = R - floor * mem.length;
  g.pay = egal;
  for (const m of mem) {
    const got = floor + g.norm * R2 / Math.max(1, mem.length) + (1 - g.norm) * R2 * m.status / sS;
    const exp = m.norm * egal + (1 - m.norm) * R * m.eff / sE;
    m.wealth += got;
    let unfair = clamp((exp - got) / (exp + 0.4), 0, 1) + Math.max(0, g.take - 0.14) * (0.5 + m.norm);
    if (nepo && !kin(m, L) && g.norm < 0.55) unfair += 0.06;
    if (m.wealth < (m.ref || 3) - 6) unfair += 0.12;
    if (g.nbPay && g.nbPay > g.pay * 1.4) unfair += 0.08 * (0.5 + m.norm);
    if (g.scarce > S.tick) unfair += 0.08;
    if (kin(m, L) && g.norm < 0.55) { m.wealth += 0.25 * (1 - g.norm); g.treasury -= 0.25 * (1 - g.norm); }
    if (m.wealth < 0) unfair += 0.25;
    if (g.faith) unfair *= 0.7;
    if (g.gov === 'assembly') unfair *= 0.85;
    if (g.land === 'private' && m.hired && S.tick - m.hired < 60 && !g.fields.some(f => f.owner === m.id)) unfair += 0.06;
    if (g.code) unfair *= (g.code === 'egal') === (m.norm > 0.5) ? 0.75 : 1.15;
    m.res = clamp(m.res * 0.8 + unfair * 0.5, 0, 1);
    m.trust[L.id] = clamp((m.trust[L.id] || 0) + 0.06 * (0.22 - unfair) * (0.5 + g.legit), -1, 1);
    if (mem.length >= 4 && m.eff < 0.3 * sE / mem.length && m.age < 55) m.rep = clamp((m.rep || 0) - 0.02, -1, 1);
    else if (m.eff > 1.6 * sE / mem.length) m.rep = clamp((m.rep || 0) + 0.01, -1, 1);
    m.status += m.eff * 0.03; m.eff = 0;
    if (m.role === 'lt') m.status += 0.15;
    if (m.job === 'pray') m.status += 0.25;
    if (m.master) m.status += m.master === 'craft' ? 0.3 : 0.12;
  }
  L.eff = 0;
  const hungry = mem.filter(m => m.wealth < 0).length, season = seasonOf(S.tick), yr = Math.floor(S.tick / 360);
  if (g.home && season === 0 && hungry >= 2 && g.famY !== yr) {
    g.famY = yr; g.trauma++; S.stats.famines = (S.stats.famines || 0) + 1;
    const cold = Math.max(0, n - g.houses.length * 4);
    log(S, 'famine', `Голодная зима в «${g.name}»: ${hungry} из ${n} голодают`, g.home.x, g.home.y, g.hue, { why: sent([`полей ${g.fields.length} на ${n} едоков`, `зимой поля не родят, а запас к зиме — ${Math.max(0, g.treasury + pool).toFixed(0)} при нужде около ${n * 3}`, cold ? `${cold} ${one(cold) ? 'зимует' : 'зимуют'} без крыши и теряют силы` : '', g.take > 0.18 ? `лидер забирает себе ${P0(g.take)}` : '', S.tick < S.drought ? 'идёт засуха' : '']), who: mem.filter(m => m.wealth < 0).map(m => m.id), gs: [g.id] });
  }
  if (L.wealth > 20) {
    const top = mem.filter(m => m.boss === L.id), gift = (L.wealth - 20) * 0.1;
    if (top.length) { L.wealth -= gift; for (const m of top) { m.wealth += gift / top.length; bump(m, L, 0.03); } }
  }
  // retainers: a rich leader keeps armed clients
  if (L.wealth > 18 && n >= 6) {
    const want = Math.min(Math.ceil(n * (0.12 + 0.2 * (1 - (g.room === undefined ? 1 : g.room)))), Math.floor((L.wealth - 12) / 5)), cur = mem.filter(m => m.patron === L.id);
    if (cur.length < want) { const c = mem.filter(m => m.patron !== L.id && !kin(m, L) && m.res < 0.5).sort((a, b) => b.skill - a.skill)[0]; if (c) { c.patron = L.id; bump(c, L, 0.2); bio(S, c, 'retainer', `Поступает в дружину вождя ${L.name}`); } }
    for (const m of cur) { const pay = 0.6; if (L.wealth > pay + 8) { L.wealth -= pay; m.wealth += pay; bump(m, L, 0.02); } else if (rnd(S) < 0.2) m.patron = null; }
  }
  // patrons and clients: the rich feed the hungry and collect obligation
  if (seasonOf(S.tick) === 0 || g.treasury < n * 2) {
    const rich = mem.filter(m => m.wealth > 20 && m.coop > 0.25).sort((a, b) => b.wealth - a.wealth);
    if (rich.length) for (const m of mem) {
      if (m.wealth > 0.5 || m.patron) continue;
      const pt = rich.find(r => r !== m && r.wealth > 14); if (!pt) break;
      pt.wealth -= 3; m.wealth += 3; m.patron = pt.id; bump(m, pt, 0.25); bio(S, m, 'client', `В голод ${pt.name} кормит ${m.sex === 'f' ? 'её' : 'его'} семью: теперь ${m.sex === 'f' ? 'она' : 'он'} клиент ${pt.name}`); pt.status += 0.15; pt.rep = clamp((pt.rep || 0) + 0.04, -1, 1);
      S.stats.clients = (S.stats.clients || 0) + 1;
    }
  }
  for (const m of mem) if (m.patron && m.patron !== L.id) { const pt = S._a.get(m.patron); if (!pt || pt.group !== g.id) { m.patron = null; continue; } if (m.wealth > 3) { const d = m.wealth * 0.05; m.wealth -= d; pt.wealth += d; } }
  if (g.home) homeEconomy(S, g, mem);
  if (g.home && n <= 5 && g.treasury < n * 1.5 && mem.filter(m => m.wealth < 0).length >= Math.min(2, n - 1)) g.hungryM = (g.hungryM || 0) + 1; else if (g.hungryM) g.hungryM = Math.max(0, g.hungryM - 1);
  const dry0 = g.home && n <= 8 && (g.thirst || 0) >= 4;
  if (g.home && (dry0 || (n <= 5 && (g.hungryM || 0) >= 5 && S.tick - g.founded > 720))) {
    let best = null, bv = -1e9;
    for (const o of S.groups) { if (o === g || !o.home || o.dead) continue; const d = Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y), h = S.hostility[key(o.id, g.id)] || 0; if (d > 450 || h > 0.6 || (dry0 && o.thirst) || !reach(S, g.home.x, g.home.y, o.home.x, o.home.y)) continue; const v = o.members.length * 0.3 + o.treasury / Math.max(1, o.members.length) - d / 40 - h * 10 + ((S.kinTies || {})[key(o.id, g.id)] ? 4 : 0); if (v > bv) { bv = v; best = o; } }
    if (best) {
      const all = g.members.map(id => S._a.get(id)).filter(Boolean), nm = g.name;
      log(S, 'abandon', `Жители «${nm}» бросают ${dry0 ? 'деревню без воды' : 'голодную деревню'} и уходят в «${best.name}»`, g.home.x, g.home.y, g.hue, { why: sent(dry0 ? [`в «${nm}» ${g.thirst} ${pl(g.thirst, 'месяц', 'месяца', 'месяцев')} нет воды поблизости`, 'носить воду издалека больше нет сил', `у «${best.name}» вода есть, туда и уходят`] : [`в «${nm}» осталось ${all.length} ${pl(all.length, 'человек', 'человека', 'человек')}, запасов нет`, 'маленькой деревне не прокормиться: некому одновременно пахать, строить и рубить лес', `«${best.name}» рядом, ${best.members.length} ${pl(best.members.length, 'человек', 'человека', 'человек')} и есть еда`]), gs: [g.id, best.id] });
      for (const m of all) { join(S, m, best, best.leader); m.x = best.home.x + gauss(S) * 15; m.y = best.home.y + gauss(S) * 15; }
      if (!g.dead) dissolve(S, g, true);
      return;
    }
  }
  restructure(S, g);
  if (!g.home && (n >= 6 || (n >= 4 && S.tick - g.founded > 720) || (n >= 3 && S.tick - g.founded > 1440))) settle(S, g);
  jobs(S, g);
  // entropy
  let res = 0, fact = 0; for (const m of mem) { res += m.res; if ((m.trust[L.id] || 0) < 0) fact++; }
  const avgRes = mem.length ? res / mem.length : 0, factF = mem.length ? fact / mem.length : 0;
  g.bureau += 0.0025 * n * (g.depth - 1) * (g.code ? 0.6 : 1);
  g.entropy = clamp(0.22 * (g.depth - 1) + 0.01 * n + 0.7 * avgRes + 0.5 * factF + 0.03 * g.bureau + (g.gov === 'assembly' ? 0.08 : 0), 0, 4);
  g.res = avgRes; g.fact = factF;
  // norms drift, leader appetite
  g.norm += (L.norm - g.norm) * 0.05;
  let want = 0.06 + 0.32 * L.ambition * (1 - 0.6 * L.norm) + (g.legit < 0.4 ? 0.05 : 0);
  const retShare = mem.filter(m => m.patron === L.id).length / Math.max(1, mem.length), room = g.room === undefined ? 1 : g.room;
  want += 0.3 * (1 - room) * L.ambition + 0.45 * retShare * L.ambition + (g.dynasty ? 0.04 : 0);
  if (g.scarce > S.tick) want -= 0.08;
  if (g.gov === 'assembly') want = Math.min(want, 0.1);
  g.take = clamp(g.take + (want - g.take) * 0.1, 0.03, 0.6);
  // reform
  if (g.entropy > 0.9 && g.cool <= S.tick && L.energy > 0.4 && n >= 6 && rnd(S) < 0.08 + 0.25 * L.ambition * L.skill) {
    const why = sent([`энтропия дошла до ${g.entropy.toFixed(2)}`, `${g.depth} уровня управления`, `бюрократия копилась ${yrs(Math.max(1, Math.round((S.tick - g.founded) / 360)))}`, 'реформа срезает её, но злит тех, кто не доверяет лидеру']);
    g.bureau *= 0.3; g.cool = S.tick + 720; L.energy -= 0.25; S.stats.reforms++; g.reforms++;
    let gone = 0;
    for (const m of mem) if ((m.trust[L.id] || 0) < 0 && rnd(S) < 0.4) { leave(S, m, 'move'); gone++; }
    log(S, 'reform', `${L.name} проводит реформу в «${g.name}»: бюрократия срезана${gone ? (one(gone) ? `, ${gone} несогласный уходит` : `, ${gone} несогласных уходят`) : ''}`, L.x, L.y, g.hue, { why, who: [L.id], gs: [g.id] });
    if (g.dead) return;
  }
  // coups and schisms
  if (n >= 4) {
    const cur = g.members.map(id => S._a.get(id)).filter(m => m !== L);
    let ch = null, cv = -1;
    for (const m of cur) { const v = m.status * (0.3 + m.ambition) * (0.5 + m.energy); if (v > cv) { cv = v; ch = m; } }
    if (ch && ch.ambition > 0.4) {
      const sup = cur.filter(m => m !== ch && m.patron !== L.id && ((m.trust[ch.id] || 0) - (m.trust[L.id] || 0) + 0.6 * m.res - 0.3 + (kin(m, ch) || m.patron === ch.id ? 0.5 : 0) - (kin(m, L) ? 0.5 : 0)) > 0);
      const frac = sup.length / Math.max(1, cur.length - 1), rets = cur.filter(m => m.patron === L.id).length / Math.max(1, cur.length);
      if (frac > (g.gov === 'assembly' ? 0.6 : 0.5) + 0.45 * rets && n >= 4 && S.tick > (g.coupCool || 0) && rnd(S) < (0.14 * ch.ambition + 0.03) * (g.gov === 'assembly' ? 0.5 : 1) / (1 + Math.min(2, (S.tick - (g.since || 0)) / 3600))) { coup(S, g, L, ch, sup, cur, grievances(S, g, L, ch, sup, n) + ` Его поддерживает ${P0(frac)} группы.`); return; }
      if (frac > 0.2 && sup.length >= 3 && sup.reduce((s, m) => s + m.res, 0) / sup.length > 0.32 && n >= 8 && rnd(S) < (0.1 * ch.ambition + 0.02) * (0.3 + 0.7 * room)) {
        const why = grievances(S, g, L, ch, sup, n) + ` Для переворота поддержки мало (${P0(frac)}), поэтому недовольные уходят сами.`;
        if (sup.length < 5 && g.home) {
          let dest = null, dv = -1e9;
          for (const o of S.groups) { if (o === g || !o.home || o.dead) continue; const d = Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y), h0 = S.hostility[key(o.id, g.id)] || 0; if (d > 420) continue; const v = o.pay * 3 + o.treasury / Math.max(1, o.members.length) - d / 50 + h0 * 4; if (v > dv) { dv = v; dest = o; } }
          if (dest && g.home && reach(S, g.home.x, g.home.y, dest.home.x, dest.home.y)) {
            const who = [ch, ...sup];
            for (const m of who) { join(S, m, dest, dest.leader); m.x = dest.home.x + gauss(S) * 15; m.y = dest.home.y + gauss(S) * 15; }
            bump(ch, L, -0.4); S.stats.emigr = (S.stats.emigr || 0) + 1;
            log(S, 'exodus', `${ch.name} и ${sup.length} ${pl(sup.length, 'недовольный', 'недовольных', 'недовольных')} уходят из «${g.name}» в «${dest.name}»`, g.home.x, g.home.y, g.hue, { why: why + ` Своей деревни им не поднять: их слишком мало, поэтому они просятся к соседям.`, who: who.map(m => m.id), gs: [g.id, dest.id] });
            return;
          }
        }
        const ng = createGroup(S, ch, sup, g.id);
        S.hostility[key(g.id, ng.id)] = 0.6; bump(ch, L, -0.5); bump(L, ch, -0.5); S.stats.schisms++;
        log(S, 'schism', `Раскол в «${g.name}»: ${ch.name} уводит ${sup.length} ${one(sup.length) ? 'человека' : 'человек'} и основывает «${ng.name}»`, ch.x, ch.y, ng.hue, { why, who: [ch.id, L.id, ...sup.map(m => m.id)], gs: [g.id, ng.id] });
        return;
      }
    }
  }
  // individual exits
  let exits = 0; const gone = [];
  for (const m of g.members.map(id => S._a.get(id))) {
    if (m.id === g.leader) continue;
    if (m.res > 0.7 && (m.trust[g.leader] || 0) < -0.15 && rnd(S) < 0.25 * (0.25 + 0.75 * room)) {
      gone.push(m.id); leave(S, m, 'move'); exits++; if (g.dead) return;
      const sp = m.spouse && S._a.get(m.spouse); if (sp && sp.group === g.id && sp.id !== g.leader && rnd(S) < 0.75) { leave(S, sp, 'move'); exits++; sp.x = m.x; sp.y = m.y; if (g.dead) return; }
    } else if ((m.rep || 0) < -0.45 && L.coop > 0.35 && rnd(S) < 0.15) { bio(S, m, 'exiled', `${m.sex === 'f' ? 'Изгнана' : 'Изгнан'} из «${g.name}»: дурная слава`); m.exiledFrom = g.id; leave(S, m, 'move'); m.x += 40; S.stats.exiles = (S.stats.exiles || 0) + 1; if (g.dead) return; }
  }
  if (exits >= 3) log(S, 'exodus', `Из «${g.name}» разом уходят ${exits} недовольных`, g.cx, g.cy, g.hue, { why: `У каждого обида выше 70% и доверие к лидеру ниже нуля. Но лидера среди них нет, поэтому они расходятся поодиночке. Доля ${L.name} в добыче: ${P0(g.take)}.`, who: gone, gs: [g.id] });
  if (g.shrine) g.treasury *= 0.99;
  if (g.faith && g.legit < 0.9) g.legit += 0.01;
  const L2 = S._a.get(g.leader);
  institutions(S, g, L2);
  money(S, g, L2);
  if (L2 && !g.dynasty && g.gov !== 'assembly' && g.home && S.tick - (g.since || 0) > 360 * 12 && g.legit > 0.55 && g.members.length >= 8 && rnd(S) < 0.05) {
    g.dynasty = true; g.dynName = L2.name; g.dynGen = 1; g.gov = 'monarch';
    log(S, 'law', `«${g.name}» вводит наследование: после ${L2.name} власть перейдёт его детям`, g.home.x, g.home.y, g.hue, { why: sent([`${L2.name} правит ${yrs(Math.round((S.tick - g.since) / 360))}, и группа привыкла к нему`, `легитимность ${P0(g.legit)}`, 'закон избавляет от кризисов преемственности, но наследник может оказаться слабым']), who: [L2.id], gs: [g.id] });
  }
  let imK;
  if (L2 && !g.code && g.home && g.members.length >= 12 && g.entropy > 0.75 && (g.reforms >= 1 || S.tick - g.founded > 360 * 15) && (imK = imitP(S, g, o => !!o.code), rnd(S) < 0.015 + imK.p)) {
    g.code = g.norm > 0.5 ? 'egal' : 'rank';
    log(S, 'law', `«${g.name}» записывает свод правил: ${g.code === 'egal' ? 'всем равные доли' : 'доли по статусу'}`, g.home.x, g.home.y, g.hue, { why: sent([`в группе ${g.members.length} человек и ${g.depth} уровня управления`, `энтропия ${g.entropy.toFixed(2)}: спорить о каждом решении стало слишком дорого`, 'писаное правило замедляет бюрократию', g.code === 'egal' ? 'кто хочет делить по заслугам, будет недоволен' : 'кто ждёт равенства, будет недоволен']), who: [L2.id], gs: [g.id] });
  }
  if (S.tick % 90 === 0 || !g.target) pickTarget(S, g);
}

function coup(S, g, L, ch, sup, cur, why) {
  if (g.dynasty) { why += ` Вместе с ${L.name} свергнута династия ${g.dynName}.`; g.dynasty = false; g.dynName = null; g.gov = 'chief'; }
  if (g.gov === 'assembly') { why += ' Вече разогнано: теперь решает один человек.'; g.gov = 'chief'; }
  g.coupCount = (g.coupCount || 0) + 1;
  g.priestRule = false;
  for (const o of S.agents) if ((o.mother === L.id || o.father === L.id) && o.group === g.id && o.age >= 15 && (!o.feud || o.feud.done)) { o.feud = { g: g.id, gname: g.name, L: ch.id, Lname: ch.name, t: S.tick, v: L.name, rel: L.sex === 'f' ? 'мать' : 'отца', personal: true }; bio(S, o, 'feud', `${ch.name} свергает ${L.sex === 'f' ? 'мать' : 'отца'} ${L.name}. ${o.name} затаивает обиду`); }
  bio(S, ch, 'coup', `Поднимает переворот и свергает ${L.name}`); bio(S, L, 'deposed', `${L.sex === 'f' ? 'Свергнута' : 'Свергнут'}: власть в «${g.name}» берёт ${ch.name}`); ch.bioL = g.id; bio(S, ch, 'leader', `Становится вождём «${g.name}»`);
  setLeader(S, g, ch); g.gen++; g.coupCool = S.tick + 1800; g.legit = clamp(sup.length / Math.max(1, cur.length), 0.2, 1); S.stats.coups++;
  bump(L, ch, -0.7); bump(ch, L, -0.3);
  ch.rep = clamp((ch.rep || 0) + ((L.rep || 0) < -0.25 ? 0.15 : -0.12), -1, 1);
  for (const m of sup) { m.res *= 0.4; bump(m, ch, 0.2); }
  const loyal = cur.filter(m => m !== ch && (m.trust[L.id] || 0) > (m.trust[ch.id] || 0));
  for (const m of loyal) bump(m, ch, -0.2);
  if (L.ambition > 0.55 && loyal.length >= 4 && rnd(S) < 0.6) {
    const ng = createGroup(S, L, loyal, g.id);
    S.hostility[key(g.id, ng.id)] = 0.9;
    log(S, 'coup', `Переворот в «${g.name}»: ${ch.name} свергает ${L.name}. Свергнутый уводит ${loyal.length} ${one(loyal.length) ? 'верного' : 'верных'} и основывает «${ng.name}»`, ch.x, ch.y, g.hue, { why, who: [ch.id, L.id, ...sup.map(m => m.id)], gs: [g.id, ng.id] });
  } else log(S, 'coup', `Переворот в «${g.name}»: ${ch.name} свергает ${L.name}`, ch.x, ch.y, g.hue, { why, who: [ch.id, L.id, ...sup.map(m => m.id)], gs: [g.id] });
}

function grievances(S, g, L, ch, sup, n) {
  const r = [];
  if (g.take > 0.18) r.push(`${L.name} забирает себе ${P0(g.take)} добычи`);
  const an = avg(sup, m => m.norm);
  if (g.norm < 0.45 && an > 0.55) r.push('добычу делят по статусу, а недовольные ждут поровну');
  else if (g.norm > 0.6 && an < 0.4) r.push('добычу делят поровну, а самые работящие считают это несправедливым');
  const hungry = sup.filter(m => m.wealth < 0).length;
  if (hungry) r.push(`${hungry} из недовольных ${one(hungry) ? 'голодает' : 'голодают'}`);
  const cold = sup.filter(m => !m.shel).length;
  if (g.home && cold) r.push(`${cold} из них живут без крыши, а дома достались статусным`);
  if (g.entropy > 0.9) r.push(`группа разрослась до ${n} человек и ${g.depth} уровней, на согласования уходит много сил`);
  if (g.legit < 0.45) r.push('у лидера слабый мандат');
  r.push(`обида у недовольных в среднем ${P0(avg(sup, m => m.res))}`);
  if ((ch.intr || 0) > 2) r.push(`${ch.name} давно нашёптывает недовольным`);
  if (g.land === 'private') { const landless = sup.filter(m => !g.fields.some(f => f.owner === m.id)).length; if (landless) r.push(`${landless} из недовольных — батраки на чужих полях`); }
  if ((ch.trades || 0) >= 2) r.push(`${ch.name} разбогател на торговле (${ch.trades} ${pl(ch.trades, 'караван', 'каравана', 'караванов')})${ch.wealth > L.wealth ? ' и богаче самого лидера' : ''}`);
  r.push(`амбиции ${ch.name}: ${P0(ch.ambition)}`);
  return sent(r);
}

function power(S, g) {
  let p = 0; for (const id of g.members) { const m = S._a.get(id); p += m.skill * (0.3 + m.energy); }
  return p / (1 + g.entropy * 0.5);
}

function relations(S) {
  const P = S.params, G = S.groups, decay = 0.03 + 0.1 * (1 - P.memory);
  for (let i = 0; i < G.length; i++) for (let j = i + 1; j < G.length; j++) {
    const A = G[i], B = G[j];
    if (A.dead || B.dead) continue;
    const LA = S._a.get(A.leader), LB = S._a.get(B.leader); if (!LA || !LB) continue;
    const k = key(A.id, B.id), d = Math.hypot(A.cx - B.cx, A.cy - B.cy);
    let h = S.hostility[k] || 0;
    const al = S.alliances.find(x => (x.a === A.id && x.b === B.id) || (x.a === B.id && x.b === A.id));
    if (d < 380) { const dt = 0.07 * ((LA.coop + LB.coop) / 2 - 0.3) - 0.05 * h + (al ? 0.02 : 0); bump(LA, LB, dt); bump(LB, LA, dt); }
    const mutual = ((LA.trust[LB.id] || 0) + (LB.trust[LA.id] || 0)) / 2;
    const rv = ((A.rivals || {})[B.id] || 0) + ((B.rivals || {})[A.id] || 0);
    const contest = Math.min(1.5, rv / 30) + (A.target === B.target ? 0.3 : 0) + (d < 160 ? 0.15 : 0);
    if (A.state && A.state === B.state) h *= 0.5;
    if (!al) h += contest * (0.03 + 0.12 * P.scarcity) * (0.5 + (LA.ambition + LB.ambition) / 2) * (0.7 + cdist(A, B)) - 0.08 * Math.max(0, mutual) - 0.02 * Math.min(3, (S.kinTies || {})[k] || 0);
    h -= h * decay; if (al) h *= 0.6;
    h = clamp(h, 0, 2);
    if (A.home && B.home) {
      const pa = A.treasury / Math.max(1, A.members.length), pb = B.treasury / Math.max(1, B.members.length);
      if (!al && d < 450) {
        const [poor, rich, Lp] = pa < pb ? [A, B, LA] : [B, A, LB], pp = Math.min(pa, pb), pr = Math.max(pa, pb);
        if (pp < 3 && pr > 10) h += 0.05 * Lp.ambition * (1 + P.scarcity);
        if (poor.famY === Math.floor(S.tick / 360)) h += 0.05;
        if (A.lord === B.id || B.lord === A.id) h += 0.03;
        const bl = (S.borders || {})[k] || 0;
        if (bl) h += Math.min(1, bl / 15) * (0.015 + 0.05 * P.scarcity) * (A.faith && A.faith === B.faith ? 0.5 : 1);
        if (A.faith && B.faith) { if (A.faith === B.faith) { h *= 0.96; bump(LA, LB, 0.01); bump(LB, LA, 0.01); } else h += 0.02; }
      }
    } else if (h > 1 && rnd(S) < 0.12) { conflict(S, A, B); h = 0.3; }
    if (A.dead || B.dead) continue;
    if (h < 0.01) delete S.hostility[k]; else S.hostility[k] = h;
    if (!al && mutual > 0.2 && h < 0.3 && d < 450 && rnd(S) < 0.12) {
      S.alliances.push({ a: A.id, b: B.id, since: S.tick });
      log(S, 'alliance', `«${A.name}» и «${B.name}» заключают союз`, (A.cx + B.cx) / 2, (A.cy + B.cy) / 2, A.hue, { why: `Лидеры ${LA.name} и ${LB.name} доверяют друг другу (${P0(mutual)}), а вражды между группами почти нет. Союзники не воюют и помогают друг другу в стычках.`, who: [LA.id, LB.id], gs: [A.id, B.id] });
    } else if (al && (mutual < -0.05 || h > 0.7)) {
      S.alliances = S.alliances.filter(x => x !== al);
      log(S, 'break', `Союз «${A.name}» и «${B.name}» распадается`, (A.cx + B.cx) / 2, (A.cy + B.cy) / 2, A.hue, { why: mutual < -0.05 ? `Доверие между лидерами ${LA.name} и ${LB.name} ушло в минус.` : 'Группы снова делят один источник, и вражда пересилила дружбу.', who: [LA.id, LB.id], gs: [A.id, B.id] });
    } else if (al && S.tick - al.since > 720) {
      const [big, sm] = A.members.length >= B.members.length ? [A, B] : [B, A];
      const sL = S._a.get(sm.leader), bL = S._a.get(big.leader);
      if (big.members.length >= sm.members.length * 2 && (sL.trust[bL.id] || 0) > 0.3 && rnd(S) < 0.06) merge(S, big, sm);
    }
  }
  for (const g of G) { g.rivals = {}; g.press = 0; }
}

function conflict(S, A, B) {
  const ally = g => S.alliances.filter(x => x.a === g.id || x.b === g.id).map(x => S._g.get(x.a === g.id ? x.b : x.a)).filter(Boolean);
  const aA = ally(A), aB = ally(B);
  const pA = power(S, A) + aA.reduce((s, g) => s + power(S, g) * 0.3, 0);
  const pB = power(S, B) + aB.reduce((s, g) => s + power(S, g) * 0.3, 0);
  const winA = rnd(S) < pA * pA / (pA * pA + pB * pB);
  const node0 = nodeOf(S, A.target === B.target ? A.target : null);
  const LA0 = S._a.get(A.leader), LB0 = S._a.get(B.leader), mut0 = ((LA0.trust[LB0.id] || 0) + (LB0.trust[LA0.id] || 0)) / 2;
  const W = winA ? A : B, Lg = winA ? B : A, wAl = winA ? aA : aB;
  const loot = Lg.treasury * 0.5; W.treasury += loot; Lg.treasury -= loot;
  const lt = (Lg.tools || 0) * 0.3; W.tools = (W.tools || 0) + lt; Lg.tools = (Lg.tools || 0) - lt;
  Lg.avoid[Lg.target] = S.tick + 360;
  const WL = S._a.get(W.leader), LL = S._a.get(Lg.leader);
  bump(WL, LL, -0.3); bump(LL, WL, -0.35);
  for (const g of wAl) { const al = S._a.get(g.leader); if (al) bump(al, LL, -0.15); }
  let def = 0;
  for (const m of Lg.members.map(id => S._a.get(id))) {
    if (!m) continue;
    m.energy = Math.max(0.05, m.energy - 0.12);
    if (m.id !== Lg.leader) { bump(m, LL, -0.08); if ((m.trust[LL.id] || 0) < 0.05 && rnd(S) < 0.25) { join(S, m, W, W.leader); def++; } }
  }
  S.stats.conflicts++;
  pickTarget(S, Lg.dead ? W : Lg);
  const n = nodeOf(S, W.target) || { x: (A.cx + B.cx) / 2, y: (A.cy + B.cy) / 2 };
  const pw = winA ? pA : pB, pl = winA ? pB : pA;
  const why = sent([node0 ? 'обе группы кормятся у одного источника' : 'группы соседствуют и перехватывают друг у друга добычу', node0 && node0.amt / node0.cap < 0.35 ? 'источник почти исчерпан' : '', S.params.scarcity > 0.6 ? 'ресурсов в мире мало' : '', mut0 < -0.2 ? 'лидеры давно не доверяют друг другу' : '', pw >= pl ? `победитель сильнее в ${(pw / Math.max(0.1, pl)).toFixed(1)} раза` : 'победил более слабый: в стычке решает и случай', wAl.length ? 'победителям помогли союзники' : '']);
  log(S, 'conflict', `Стычка за источник: «${W.name}» берёт верх над «${Lg.name}»${def ? (one(def) ? `, ${def} проигравший переходит к победителям` : `, ${def} проигравших переходят к победителям`) : ''}${wAl.length ? ' при поддержке союзников' : ''}`, n.x, n.y, W.hue, { why, who: [WL.id, LL.id], gs: [W.id, Lg.id], big: W.members.length + Lg.members.length >= 8 });
}

function merge(S, big, sm) {
  const sL = S._a.get(sm.leader), bL0 = S._a.get(big.leader);
  const al0 = S.alliances.find(x => (x.a === big.id && x.b === sm.id) || (x.a === sm.id && x.b === big.id));
  const why = `Союз длился ${yrs(Math.round((S.tick - (al0 ? al0.since : S.tick)) / 360))}. «${big.name}» как минимум вдвое больше, а ${sL.name} доверяет ${bL0.name} (${P0(sL.trust[bL0.id] || 0)}). Малой группе выгоднее влиться, чем стоять отдельно.`;
  if (S.arch && S.arch[sm.id]) S.arch[sm.id].into = big.id;
  if (S.own) for (let c = 0; c < S.own.length; c++) if (S.own[c] === sm.id) S.own[c] = big.id;
  for (const id of sm.members) {
    const m = S._a.get(id); m.group = big.id; m.role = 'member';
    if (m.id === sL.id) m.boss = big.leader;
    big.members.push(id);
  }
  big.treasury += sm.treasury; sm.treasury = 0; sm.members = [];
  big.wood += sm.wood || 0; big.stone += sm.stone || 0; big.tools += sm.tools || 0; sm.wood = sm.stone = sm.tools = 0;
  dissolve(S, sm, true); restructure(S, big); S.stats.merges++;
  log(S, 'merge', `«${sm.name}» входит в состав «${big.name}». Теперь там ${big.members.length} человек`, big.cx, big.cy, big.hue, { why, who: [bL0.id, sL.id], gs: [big.id, sm.id] });
}

const shortName = g => g.name.split(' ').slice(1).join(' ') || g.name;
function rootOf(S, g) { let r = g, k = 0; while (r.lord && k++ < 8) { const l = S._g.get(r.lord); if (!l || !l.home) break; r = l; } return r; }
function protection(S) {
  for (const g of S.groups) {
    if (!g.home || g.lord || g.members.length > 8 || (g.threat || 0) < 0.3 || S.groups.some(o => o.lord === g.id)) continue;
    const L = S._a.get(g.leader); if (!L) continue;
    let best = null, bv = 0;
    for (const o of S.groups) {
      if (o === g || !o.home || o.lord || o.members.length < g.members.length * 2) continue;
      const d = Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y); if (d > 380) continue;
      const LO = S._a.get(o.leader); if (!LO) continue;
      const tr = (L.trust[LO.id] || 0) + (S.routes[key(g.id, o.id)] ? 0.2 : 0) + (o.faith && o.faith === g.faith ? 0.2 : 0) - (S.hostility[key(g.id, o.id)] || 0);
      const v = tr * o.members.length / (1 + d / 200);
      if (tr > 0.15 && v > bv) { bv = v; best = o; }
    }
    if (!best || rnd(S) > 0.35) continue;
    g.lord = best.id; g.tribRate = 0.06;
    const LO = S._a.get(best.leader);
    log(S, 'state', `«${g.name}» просит покровительства «${best.name}» и становится её вассалом`, g.home.x, g.home.y, best.hue, { why: sent([`маленькой деревне (${g.members.length} чел.) угрожают соседи: угроза ${P0(Math.min(1, g.threat))}`, `«${best.name}» сильнее вдвое и ей доверяют${S.routes[key(g.id, best.id)] ? ': они давно торгуют' : ''}${best.faith && best.faith === g.faith ? ', и вера у них одна' : ''}`, 'за защиту вассал платит половину обычной дани', LO ? `покровитель — ${LO.name}` : '']), gs: [g.id, best.id] });
  }
}
function states(S) {
  protection(S);
  const vill = S.groups.filter(g => g.home);
  const uf = new Map(); const find = x => { while (uf.get(x) !== x) { uf.set(x, uf.get(uf.get(x))); x = uf.get(x); } return x; };
  for (const g of vill) uf.set(g.id, g.id);
  for (const g of vill) { const r = rootOf(S, g); if (r !== g) uf.set(find(g.id), find(r.id)); }
  const confed = new Set();
  for (const al of S.alliances) {
    const A = S._g.get(al.a), B = S._g.get(al.b);
    if (!A || !B || !A.home || !B.home || S.tick - al.since < 360 * 5) continue;
    const ra = find(A.id), rb = find(B.id); if (ra !== rb) { uf.set(ra, rb); confed.add(rb); confed.add(ra); }
  }
  const sets = new Map();
  for (const g of vill) { const r = find(g.id); if (!sets.has(r)) sets.set(r, []); sets.get(r).push(g); }
  const old = S.states || [], next = [];
  S.sarch = S.sarch || {};
  for (const mem of sets.values()) {
    const pop = mem.reduce((s2, g) => s2 + g.members.length, 0), terr = mem.reduce((s2, g) => s2 + (g.terr || 0), 0);
    const roots = mem.filter(g => !g.lord || !mem.some(o => o.id === g.lord));
    const cap = roots.sort((a, b) => b.members.length - a.members.length)[0] || mem[0];
    const vass = mem.filter(g => g.lord).length;
    let type = null;
    if (mem.length >= 2) type = vass && cap.dynasty ? 'Королевство' : vass && mem.length - vass <= 1 ? 'Держава' : 'Конфедерация';
    else if (cap.members.length >= ((old.find(o => o.cap === cap.id && o.type === 'Город-государство')) ? 30 : 40) && (cap.terr || 0) >= 70) type = 'Город-государство';
    if (!type) continue;
    const prev = old.find(o => o.cap === cap.id) || old.find(o => o.members.filter(id => mem.some(g => g.id === id)).length > o.members.length / 2);
    const faiths = new Set(mem.map(g => g.faith).filter(Boolean)), f1 = faiths.size === 1 && mem.every(g => g.faith) ? S.faiths[[...faiths][0]] : null;
    const L = S._a.get(cap.leader);
    const name = prev && prev.type === type && prev.cap === cap.id ? prev.name : type === 'Королевство' ? `Королевство ${cap.dynName || (L ? L.name : shortName(cap))}` : type === 'Держава' ? `Держава ${shortName(cap)}` : type === 'Город-государство' ? `Город ${shortName(cap)}` : f1 ? `Союз ${f1.name.replace('культ ', 'культа ')}` : `Союз ${shortName(cap)}`;
    const st = { id: prev ? prev.id : 's' + (S.nextId++), name, type, cap: cap.id, members: mem.map(g => g.id), pop, terr, founded: prev ? prev.founded : S.tick, hue: cap.hue };
    next.push(st);
    if (!prev) {
      log(S, 'state', `Рождается государство: «${name}», ${mem.length > 1 ? `${mem.length} ${pl(mem.length, 'деревня', 'деревни', 'деревень')}, ` : ''}${pop} чел.`, cap.home.x, cap.home.y, cap.hue, { first: !S.firstState, why: sent([type === 'Королевство' || type === 'Держава' ? `«${cap.name}» держит ${vass} ${pl(vass, 'данника', 'данников', 'данников')}: власть стоит на завоевании и дани` : type === 'Конфедерация' ? `деревни дольше восьми лет в союзе${f1 ? ` и молятся одному богу: ${f1.name}` : ''}, они защищают друг друга и не воюют между собой` : `«${cap.name}» разрослась до ${cap.members.length} человек и ${cap.terr} клеток земли`, `столица — «${cap.name}»`, L ? `правит ${L.name}` : '']), gs: mem.map(g => g.id), who: L ? [L.id] : [] });
      S.firstState = true; S.stats.states = (S.stats.states || 0) + 1;
    } else {
      const added = mem.filter(g => !prev.members.includes(g.id));
      if (added.length) log(S, 'state', `«${name}» прирастает: ${added.map(g => `«${g.name}»`).join(', ')}`, added[0].home.x, added[0].home.y, cap.hue, { why: added.some(g => g.lord) ? 'Новые земли добыты войной и обложены данью.' : 'Новые члены вступили в союз после долгой дружбы.', gs: [cap.id, ...added.map(g => g.id)] });
      if (prev.type !== type) log(S, 'state', `«${prev.name}» становится «${name}»`, cap.home.x, cap.home.y, cap.hue, { why: type === 'Королевство' ? 'Правящий род столицы ввёл наследование: держава превращается в королевство.' : type === 'Конфедерация' ? 'Данники вырвались на свободу, но союз остался.' : 'Устройство государства изменилось.', gs: [cap.id] });
    }
    S.sarch[st.id] = { name: st.name, type, founded: st.founded, end: null, peak: Math.max(pop, (S.sarch[st.id] || {}).peak || 0) };
  }
  for (const o of old) if (!next.some(n => n.id === o.id)) {
    const cap = S._g.get(o.cap), yrs0 = Math.round((S.tick - o.founded) / 360);
    if (S.sarch[o.id]) S.sarch[o.id].end = S.tick;
    log(S, 'state', `«${o.name}» распадается спустя ${yrs(Math.max(1, yrs0))}`, cap && cap.home ? cap.home.x : undefined, cap && cap.home ? cap.home.y : undefined, o.hue, { why: sent([!cap ? 'столица исчезла' : cap.lord ? 'столица сама попала под чужую власть' : o.type === 'Город-государство' ? `город обезлюдел: в «${cap.name}» осталось ${cap.members.length} человек` : 'данники восстали или союз распался', `на пике в нём жило ${(S.sarch[o.id] || {}).peak || o.pop} человек`]), gs: o.members.filter(id => S._g.has(id)) });
  }
  S.states = next;
  for (const g of S.groups) g.state = null;
  for (const st of next) for (const id of st.members) { const g = S._g.get(id); if (g) g.state = st.id; }
}
function regime(S, g) {
  const n = g.members.length, mem = g.members.map(id => S._a.get(id)).filter(Boolean), L = S._a.get(g.leader);
  if (!g.home) return { type: 'Кочевая ватага', c: 0.3, b: 0.5, gi: 0, vass: 0 };
  const gi = gini(mem.map(m => m.wealth));
  const c = clamp(0.3 * clamp((g.take - 0.05) / 0.3, 0, 1) + 0.2 * clamp((g.depth - 1) / 3, 0, 1) + 0.25 * gi + 0.15 * (1 - g.norm) + (g.dynasty ? 0.15 : 0) + (g.priestRule ? 0.05 : 0), 0, 1);
  const vass = S.groups.filter(o => o.lord === g.id).length;
  const guards = mem.filter(m => m.job === 'guard' || m.war).length / Math.max(1, n);
  const crafters = mem.filter(m => m.job === 'craft' || m.job === 'trade' || m.car).length / Math.max(1, n);
  const comm = clamp(Math.min(1, (g.trades || 0) / 25) * 0.6 + (g.workshop ? 0.15 : 0) + crafters * 1.5, 0, 1);
  const force = clamp((g.warsWon || 0) * 0.2 + vass * 0.3 + guards * 1.8 + (g.walls ? 0.1 : 0), 0, 1);
  const b = clamp(0.5 + 0.5 * (comm - force), 0, 1);
  const rich = mem.slice().sort((x, y) => y.wealth - x.wealth)[0];
  const merchantRule = !!(rich && L && rich !== L && (rich.trades || 0) >= 3 && rich.wealth > L.wealth * 1.3);
  let type;
  if (n < 5) type = 'Хутор';
  else if (g.priestRule) type = 'Теократия';
  else if (vass >= 1 && b < 0.55) type = 'Держава данников';
  else if (g.gov === 'assembly') type = b > 0.62 ? 'Торговая республика' : 'Вечевая республика';
  else if (g.land === 'private' && (landTop(g) || {}).share > 0.35) type = (g.dynasty || c > 0.55) ? 'Феодальное княжество' : 'Земельная знать';
  else if (g.dynasty) type = c > 0.55 ? 'Наследственное княжество' : 'Родовая община';
  else if (b > 0.62) type = c > 0.5 || merchantRule ? 'Купеческая олигархия' : 'Вольная торговая община';
  else if (b < 0.38) type = c > 0.5 ? 'Военная деспотия' : 'Воинское братство';
  else type = c > 0.6 ? 'Вождество' : c < 0.33 ? 'Община равных' : 'Земледельческая община';
  const why = sent([
    `власть ${c > 0.6 ? 'сосредоточена наверху' : c < 0.35 ? 'размыта' : 'распределена умеренно'}: лидер берёт ${P0(g.take)}, уровней ${g.depth}, неравенство ${gi.toFixed(2)}${g.norm < 0.4 ? ', делят по статусу' : g.norm > 0.6 ? ', делят поровну' : ''}`,
    `опора ${b > 0.62 ? 'на торговлю и ремесло' : b < 0.38 ? 'на силу' : 'смешанная'}: ${g.trades || 0} ${pl(g.trades || 0, 'сделка', 'сделки', 'сделок')}${g.workshop ? ', мастерская' : ''}${g.warsWon ? `, побед ${g.warsWon}` : ''}${vass ? `, данников ${vass}` : ''}${guards > 0.1 ? `, в страже ${P0(guards)}` : ''}`,
    g.coin ? 'в ходу монета' : '', (() => { const b = g.members.filter(id => { const m = S._a.get(id); return m && m.bond; }).length; return b ? `в кабале ${b} ${pl(b, 'человек', 'человека', 'человек')}` : ''; })(),
    g.gov === 'assembly' ? 'решения принимает вече' : '', g.land === 'private' ? `поля в частной собственности${landTop(g) ? `, у крупнейшего хозяина ${P0(landTop(g).share)} земли` : ''}` : '',
    g.dynasty ? `правит династия ${g.dynName}` : '', g.priestRule ? 'правит бывший жрец' : '', merchantRule ? `богатейший — купец ${rich.name}, он богаче лидера` : ''
  ]);
  return { type, c, b, gi, vass, merchantRule, why };
}
function yearly(S) {
  droughtYear(S);
  roadsYear(S);
  for (const g of S.groups) { g.cross12 = g.cross || 0; g.cross = 0; }
  roomYear(S);
  plagueYear(S);
  territories(S);
  states(S);
  for (const g of S.groups) {
    if (!g.home) continue;
    const r = regime(S, g);
    g.rhist = g.rhist || []; const lp = g.rhist[g.rhist.length - 1]; g.rhist.push(lp ? [+(lp[0] * 0.6 + r.c * 0.4).toFixed(3), +(lp[1] * 0.6 + r.b * 0.4).toFixed(3)] : [+r.c.toFixed(3), +r.b.toFixed(3)]); if (g.rhist.length > 30) g.rhist.shift();
    if (g.members.length < 6) { g.rcand = null; continue; }
    if (!g.rtype) { g.rtype = r.type; continue; }
    if (r.type === g.rtype) { g.rcand = null; continue; }
    if (g.rcand !== r.type) { g.rcand = r.type; continue; }
    const from = g.rtype; g.rtype = r.type; g.rcand = null;
    log(S, 'regime', `«${g.name}» меняет строй: ${from.toLowerCase()} → ${r.type.toLowerCase()}`, g.home.x, g.home.y, g.hue, { why: r.why, gs: [g.id], who: [g.leader] });
  }
  if (S.tick % 3600 === 0) era(S);
}
function era(S) {
  const t1 = S.tick, t0 = t1 - 3600, st = S.stats, p = S.eraStats || {};
  const nG = Math.max(1, S.groups.length / 7), pe = S.eraEvc || {}, d = k => ((st[k] || 0) - (p[k] || 0)) / nG, c = ty => ((S.evc || {})[ty] || 0) - (pe[ty] || 0);
  const th = [['Эпоха войн', d('wars') * 3 + d('conquests') * 4 + d('revolts') * 3 + d('raids')], ['Эпоха торговли', d('trades') / 10 + c('route') * 1.2], ['Мор', c('plague') * 5], ['Смута', d('coups') * 2 + d('schisms') * 1.2 + c('crisis') * 2 / nG], ['Время строителей', Math.min(14, (c('settle') + c('tech') + c('milestone') * 0.3) / nG) * (t0 === 0 ? 1.5 : 0.8)], ['Время веры и законов', (c('faith') * 3 + c('law') * 3) / Math.sqrt(nG)], ['Голодные годы', c('famine') * 3 / nG]];
  th.sort((a, b) => b[1] - a[1]);
  const theme = th[0][1] >= 3 ? th[0][0] : 'Тихие годы';
  const big = S.groups.slice().sort((a, b) => b.members.length - a.members.length)[0];
  const fallen = Object.values(S.arch || {}).filter(a => a.end && a.end > t0 && a.end <= t1 && a.end - a.founded > 1800).map(a => `«${a.name}»`).slice(0, 3);
  const pop0 = S.eraPop || 60, pop1 = S.agents.length, nf = new Set(S.groups.map(g => g.faith).filter(Boolean)).size;
  const y0 = Math.round(t0 / 360), y1 = Math.round(t1 / 360) - 1;
  log(S, 'era', `Годы ${y0}–${y1}: ${theme.toLowerCase()}`, undefined, undefined, 0, { why: sent([
    `население ${pop0} → ${pop1}`,
    `сделок ${d('trades')}, походов ${d('wars')}, переворотов ${d('coups')}, расколов ${d('schisms')}${c('famine') ? `, голодных зим ${c('famine')}` : ''}`,
    big ? `сильнейшая — «${big.name}» (${big.members.length} чел., ${regime(S, big).type.toLowerCase()})` : '',
    fallen.length ? `сошли со сцены: ${fallen.join(', ')}` : '',
    nf ? `вер в мире: ${nf}` : '', S.groups.some(g => g.dynasty) ? `династий: ${S.groups.filter(g => g.dynasty).length}` : ''
  ]), gs: big ? [big.id] : [] });
  S.eraStats = Object.assign({}, st); S.eraPop = pop1; S.eraEvc = Object.assign({}, S.evc || {});
}
function gini(vals) {
  const v = vals.map(x => Math.max(0, x)).sort((a, b) => a - b), n = v.length;
  const s = v.reduce((a, b) => a + b, 0); if (!n || !s) return 0;
  let c = 0; v.forEach((x, i) => c += (i + 1) * x);
  return (2 * c) / (n * s) - (n + 1) / n;
}

function sample(S) {
  const h = S.hist, gs = S.groups;
  let ew = 0, en = 0; for (const g of gs) { ew += g.entropy * g.members.length; en += g.members.length; }
  h.pop.push(popOf(S)); h.groups.push(gs.length); h.entropy.push(en ? ew / en : 0);
  h.gini.push(gini(S.agents.map(a => a.wealth)));
  if (!h.gs) { h.gs = []; h.solo = []; }
  if (!h.pf) { h.pf = []; h.pw = []; h.ps = []; h.pt = []; }
  const pr = S.price || { food: 1, wood: 1.5, stone: 2.5, tools: 6 };
  h.pf.push(+pr.food.toFixed(3)); h.pw.push(+pr.wood.toFixed(3)); h.ps.push(+pr.stone.toFixed(3)); h.pt.push(+pr.tools.toFixed(3));
  h.gs.push(gs.flatMap(g => [g.id, g.members.length])); h.solo.push(S.agents.filter(a => !a.group).length); h.big.push(gs.reduce((m, g) => Math.max(m, g.members.length), 0));
  for (const k in h) if (h[k].length > 720) h[k].shift();
}

function shock(S, kind) {
  const big = S.groups.slice().sort((a, b) => b.members.length - a.members.length);
  if (kind === 'drought') { S.drought = S.tick + 360; log(S, 'shock', 'Засуха: источники восстанавливаются втрое медленнее целый год', undefined, undefined, 0, { why: 'Это ваш шок. Смотрите, кто первым начнёт голодать, где вырастет обида и где вспыхнет вражда за оставшееся.' }); }
  if (kind === 'land') {
    let x = 500, y = 500, t = 0;
    do { x = 80 + rnd(S) * 840; y = 80 + rnd(S) * 840; } while (t++ < 200 && S.nodes.some(n => Math.hypot(n.x - x, n.y - y) < 150));
    S.nodes.push({ id: S.nextId++, x, y, amt: 90, cap: 90 });
    if (S.nodes.length > 14) S.nodes.shift();
    log(S, 'shock', 'Открыт новый богатый источник', x, y, 45, { why: 'Новый ресурс меняет баланс сил: кто дотянется до него первым, тот усилится.' });
  }
  if (kind === 'strangers') {
    const avgNorm = S.agents.reduce((s, a) => s + a.norm, 0) / Math.max(1, S.agents.length);
    const side = rnd(S) < 0.5 ? 0 : 1, ids = [];
    for (let i = 0; i < 15; i++) ids.push(spawn(S, 'out', { side, culture: () => ({ norm: clamp(1 - avgNorm + gauss(S) * 0.15, 0, 1), ambition: clamp(0.75 + gauss(S) * 0.2, 0, 1), coop: clamp(0.55 + gauss(S) * 0.2, 0, 1), wealth: 6 }) }));
    for (const a of ids) for (const b of ids) if (a !== b) a.trust[b.id] = 0.4;
    log(S, 'shock', `С ${side === 0 ? 'востока' : 'запада'} приходят 15 чужаков со своими нормами`, side === 0 ? 960 : 40, 500, 0, { why: 'Их нормы распределения противоположны местному большинству, амбиции высоки, и они доверяют друг другу. Скорее всего, они сплотятся в свою группу и начнут спорить за ресурсы.', who: ids.map(a => a.id) });
  }
  if (kind === 'decap' && big[0]) removeAgent(S, S._a.get(big[0].leader), 'vanish');
  if (kind === 'rumor' && big[1]) {
    const A = big[0], B = big[1], LA = S._a.get(A.leader), LB = S._a.get(B.leader);
    bump(LA, LB, -0.6); bump(LB, LA, -0.6);
    S.hostility[key(A.id, B.id)] = (S.hostility[key(A.id, B.id)] || 0) + 0.8;
    log(S, 'shock', `Слух: «${A.name}» будто бы готовит удар по «${B.name}»`, (A.cx + B.cx) / 2, (A.cy + B.cy) / 2, 0, { why: `Доверие между лидерами ${LA.name} и ${LB.name} резко упало, вражда выросла. Дальше всё решит их характер.`, who: [LA.id, LB.id], gs: [A.id, B.id] });
  }
}

function serialize(S) { return JSON.stringify(S, (k, v) => k[0] === '_' ? undefined : v); }
function restore(str) { const S = JSON.parse(str); index(S); return S; }

return { newWorld, step, shock, serialize, restore, date, key, gini, regime, landTop, popOf, kin, kidsOf, groupName };

})();
if (typeof module !== 'undefined') module.exports = SIM;
