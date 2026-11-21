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
  S.agents.push(a); S._a.set(a.id, a); S._agentsById[a.id] = a;
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
    S.ruins.push({ name: g.name, t: S.tick, x: g.home.x, y: g.home.y, houses: g.houses.concat([g.workshop, g.granary].filter(Boolean)).map(({ x, y, angle, footprint, entrance, frontage, earth, built }) => ({ x, y, angle, footprint, entrance, frontage, earth, built })), fields: g.fields.map(f => ({ x: f.x, y: f.y })), plan: g.plan || null, fortifications: g.fortifications });
    if (g.fortifications?.length) S.wallV = (S.wallV || 0) + 1;
    if (S.ruins.length > 14) S.ruins.shift();
    for (const f of g.fields) delete S.occ[f.c];
    if (S.own) for (let c = 0; c < S.own.length; c++) if (S.own[c] === g.id) S.own[c] = 0;
    if (g.site && g.site.c !== undefined) delete S.occ[g.site.c];
  }
  const share = g.treasury / Math.max(1, g.members.length);
  for (const id of g.members) { const m = S._a.get(id); if (m) { m.group = null; m.boss = null; m.role = null; m.wealth += share; } }
  g.members = [];
  S.groups = S.groups.filter(x => x !== g); S._g.delete(g.id); S._groupsById[g.id] = undefined;
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
  S.groups.push(g); S._g.set(g.id, g); S._groupsById[g.id] = g; S.stats.founded++;
  S.arch = S.arch || {};
  S.arch[g.id] = { name: g.name, hue, founded: S.tick, end: null, parent: parent || null, into: null };
  // those who split off take their share of the stores, tools and goats (at most half)
  const P = parent && S._g.get(parent);
  if (P && P.members.length) {
    const fr = Math.min(0.5, (others.length + 1) / P.members.length);
    for (const k of ['treasury', 'tools', 'wood', 'stone']) { const v = (P[k] || 0) * fr; P[k] = (P[k] || 0) - v; g[k] = (g[k] || 0) + v; }
    if (P.goats > 3) { const k = Math.floor(P.goats * fr); P.goats -= k; g.goats = (g.goats || 0) + k; }
  }
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
    for (const c of cands) { const v = (c.id === m.id ? 0.4 : (m.trust[c.id] || 0)) + c.status * 0.01 + 0.25 * (c.rep || 0) + (kin(m, c) ? 0.3 : 0) + 0.5 * bondW(m, c); if (v > bv) { bv = v; best = c; } }
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
    if (sup.length >= 4 && rnd(S) < Math.min(1, 0.2 + fissionP(S, g))) {
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

