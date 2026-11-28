/* ---------- cultures and peoples (К3, see docs/CULTURE.md) ---------- */
// A village has a culture: how it buries its dead, which day it keeps, how it names its children, the sign it wears, what it
// will not eat, what it prides itself on. A daughter village carries its mother's culture away; after a split it changes a
// trait or two on purpose ("we are not like them"). Neighbours borrow from each other through marriages, trade, a common
// faith and the example of the strong, the more readily the more they already share (Axelrod 1997); enemies do not borrow,
// and their signs drift apart (Barth 1969, McElreath et al. 2003). Newcomers bring their own ways; when a third of a
// village comes from one place, the village starts to change. Villages that share most of their culture make a people:
// it names itself after the ancestor of its founding legend, its neighbours name it by its sign. Own people marry each other
// more, ally more readily, quarrel less; with strangers the enmity grows faster (moderately, by the author's decision).
// g.cult: { burial, day, names, color, pattern, taboo, pride, from: { trait: { how, from, t, ev } } }
// a.home0: { g, name, people } — the culture a person grew up in. S.peoples: [{ id, self, exo, villages, born, color }]
const CULT = {
  burial: { opts: ['cemetery', 'threshold', 'mound', 'pyre', 'sea'], name: 'Погребение', words: { cemetery: 'хоронят на общем кладбище', threshold: 'хоронят под порогом родного дома', mound: 'знатных хоронят в курганах', pyre: 'сжигают умерших на костре', sea: 'отпускают умерших в море на лодке' } },
  day: { opts: ['founding', 'fallen', 'harvest'], name: 'Памятный день', words: { founding: 'день основания деревни', fallen: 'день поминовения павших', harvest: 'праздник урожая' } },
  names: { opts: ['ancestors', 'new'], name: 'Имена', words: { ancestors: 'детей называют в честь предков', new: 'детям дают новые имена' } },
  color: { opts: ['ochre', 'blue', 'green', 'white', 'red', 'black'], name: 'Цвет', words: { ochre: 'охра', blue: 'синий', green: 'зелёный', white: 'белый', red: 'красный', black: 'чёрный' } },
  pattern: { opts: ['stripes', 'circles', 'zigzag', 'cross', 'dots'], name: 'Узор', words: { stripes: 'полосы', circles: 'круги', zigzag: 'зигзаг', cross: 'крест', dots: 'точки' } },
  taboo: { opts: ['none', 'goat'], name: 'Запрет', words: { none: 'запретов на пищу нет', goat: 'козлятину не едят' } },
  pride: { opts: ['honor', 'peace'], name: 'Чем гордятся', words: { honor: 'честью: за кровь платят кровью', peace: 'миром: за кровь берут выкуп' } }
};
const CULT_KEYS = Object.keys(CULT);
const COLOR_PEOPLE = { ochre: 'Охряные', blue: 'Синие', green: 'Зелёные', white: 'Белые', red: 'Красные', black: 'Чёрные' };
const PATTERN_PEOPLE = { stripes: 'Полосатые', circles: 'Кольчатые', zigzag: 'Зубчатые', cross: 'Крестовые', dots: 'Пятнистые' };
const COLOR_HEX = { ochre: '#c8913a', blue: '#3f6fb5', green: '#4c8f4a', white: '#e8e4d8', red: '#b8433a', black: '#2d2a28' };
const cultWord = (k, v) => (CULT[k] && CULT[k].words[v]) || '';
const pickH = (k, n) => CULT[k].opts[Math.floor(hash01(n) * CULT[k].opts.length) % CULT[k].opts.length];

// the first culture of a village with no mother: the landscape and the leader suggest it
function newCulture(S, g) {
  const L = S._a.get(g.leader), x = g.home ? g.home.x : g.cx, y = g.home ? g.home.y : g.cy, h = g.id * 97 + 13;
  const shore = terrainAt(S, x, y) === 'shore' || (g.landing && Math.hypot(g.landing.x - x, g.landing.y - y) < 120);
  const c = {
    burial: shore && hash01(h + 1) < 0.35 ? 'sea' : terrainAt(S, x, y) === 'hill' && hash01(h + 2) < 0.5 ? 'mound' : pickH('burial', h + 3),
    day: 'founding', names: pickH('names', h + 4), color: pickH('color', h + 5), pattern: pickH('pattern', h + 6),
    taboo: hash01(h + 7) < 0.25 ? 'goat' : 'none',
    pride: (g.customs || {}).blood === 'revenge' ? 'honor' : (g.customs || {}).blood === 'wergild' ? 'peace' : L && L.coop < 0.4 ? 'honor' : 'peace',
    from: {}
  };
  for (const k of CULT_KEYS) c.from[k] = { how: 'own', t: S.tick };
  return c;
}
function cultOf(S, g) { if (!g.cult) g.cult = newCulture(S, g); return g.cult; }
// a daughter village takes its mother's culture; a split changes the sign and one more trait, to be told apart
function inheritCulture(S, mother, child, how, ev) {
  if (!mother || !child) return;
  const m = cultOf(S, mother), c = Object.assign({}, m, { from: {} });
  for (const k of CULT_KEYS) c.from[k] = { how: 'mother', from: mother.name, t: S.tick, ev: ev && ev.id };
  if (how === 'schism') {
    const rest = CULT_KEYS.filter(k => k !== 'color'), i0 = Math.floor(hash01(child.id * 31) * rest.length) % rest.length;
    const changed = ['color', rest[i0], rest[(i0 + 2) % rest.length]];
    for (const k of changed) { const opts = CULT[k].opts.filter(v => v !== c[k]); c[k] = opts[Math.floor(hash01(child.id + k.length) * opts.length) % opts.length]; c.from[k] = { how: 'apart', from: mother.name, t: S.tick, ev: ev && ev.id }; }
  }
  child.cult = c; child.motherG = mother.id;
  if (how === 'schism') S.stats.cult_apart = (S.stats.cult_apart || 0) + 1;
}
// how much two villages share, 0..1
function cultSim(a, b) { if (!a || !b) return 0; let n = 0; for (const k of CULT_KEYS) if (a[k] === b[k]) n++; return n / CULT_KEYS.length; }
function changeTrait(S, g, k, v, how, from, ev) {
  const c = cultOf(S, g), old = c[k]; if (old === v) return;
  c[k] = v; c.from[k] = { how, from, t: S.tick, ev };
  S.stats.cultChanges = (S.stats.cultChanges || 0) + 1; S.stats['cult_' + how] = (S.stats['cult_' + how] || 0) + 1;
  const what = k === 'color' || k === 'pattern' ? `носят ${k === 'color' ? 'цвет' : 'узор'}: ${cultWord(k, v)}` : cultWord(k, v);
  const why = how === 'borrowed' ? `перенимают у «${from}»` : how === 'migrants' ? `так принято у пришлых из «${from}», а их в деревне уже треть` : how === 'enemy' ? `чтобы не походить на врагов из «${from}»` : 'новый обычай';
  note(S, 'culture', `В «${g.name}» теперь ${what}: ${why}`, g.home ? g.home.x : g.cx, g.home ? g.home.y : g.cy, g.hue, { gs: [g.id], causes: ev ? [ev] : undefined, trait: k });
}

/* ---------- a year of culture ---------- */
function cultureYear(S) {
  const vs = S.groups.filter(g => g.home && !g.dead);
  for (const g of vs) cultOf(S, g);
  for (const g of vs) {
    const c = g.cult;
    // neighbours: contact through marriages, trade and a common faith; enemies give nothing and push the sign apart
    for (const o of vs) {
      if (o === g) continue;
      const d = Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y); if (d > 350) continue;
      const k = key(g.id, o.id), h = S.hostility[k] || 0;
      if (h > 0.4) {
        if (c.color === o.cult.color && hash01(S.tick + g.id * 7 + o.id) < 0.3) { const opts = CULT.color.opts.filter(v => v !== o.cult.color); changeTrait(S, g, 'color', opts[Math.floor(hash01(g.id + S.tick) * opts.length) % opts.length], 'enemy', o.name); }
        continue;
      }
      const contact = Math.min(3, (S.kinTies || {})[k] || 0) * 0.5 + (S.routes[k] ? 1 : 0) + (o.faith && o.faith === g.faith ? 0.5 : 0) + (allied(S, g.id, o.id) ? 0.5 : 0);
      if (!contact) continue;
      const prestige = o.members.length > g.members.length * 1.3 ? 1.5 : 1;
      // Axelrod: those with nothing in common do not learn from each other; the more they share, the more they borrow
      const sim = cultSim(c, o.cult); if (sim < 2 / 7) continue;
      const p = 0.012 * contact * sim * prestige;
      for (const t of CULT_KEYS) if (c[t] !== o.cult[t] && hash01(S.tick * 13 + g.id * 31 + o.id * 7 + t.length * 101) < p) { changeTrait(S, g, t, o.cult[t], 'borrowed', o.name); break; }
    }
    // newcomers: when a third of the adults grew up in one other village, its ways start to take hold
    const by = {};
    for (const id of g.members) { const a = S._a.get(id); if (a && a.age >= 16 && a.home0 && a.home0.g !== g.id) by[a.home0.g] = (by[a.home0.g] || 0) + 1; }
    const adults = g.members.filter(id => { const a = S._a.get(id); return a && a.age >= 16; }).length;
    for (const oid in by) {
      if (by[oid] < adults / 3) continue;
      const src = S._g.get(+oid), sc = src && src.cult; if (!sc) continue;
      const t = CULT_KEYS.find(k => c[k] !== sc[k]); if (t && hash01(S.tick + g.id * 3) < 0.25) changeTrait(S, g, t, sc[t], 'migrants', src.name);
    }
    // innovation, rarely
    // the sign (colour, pattern) is not innovated: it changes by a split, against an enemy or by joining a people
    const inner = CULT_KEYS.filter(k => k !== 'color' && k !== 'pattern');
    if (hash01(S.tick * 7 + g.id * 131) < 0.01) { const t = inner[Math.floor(hash01(S.tick + g.id) * inner.length) % inner.length]; const opts = CULT[t].opts.filter(v => v !== c[t]); changeTrait(S, g, t, opts[Math.floor(hash01(g.id * S.tick) * opts.length) % opts.length], 'new'); }
  }
  peoplesYear(S, vs);
  mythsTravel(S, vs);
}

/* ---------- peoples ---------- */
// villages with the same sign (colour and pattern) and at least five of the seven traits in common are of one people; a people keeps its identity while most of its
// villages stay together
function peoplesYear(S, vs) {
  const parent = new Map(vs.map(g => [g.id, g.id])), find = x => { while (parent.get(x) !== x) x = parent.get(x); return x; };
  // Barth: a people knows its own by the sign — the same colour and pattern — and by most of the other customs
  const same = (a, b) => a.color === b.color && a.pattern === b.pattern && cultSim(a, b) >= 4 / 7 - 1e-9;
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) if (same(vs[i].cult, vs[j].cult)) parent.set(find(vs[i].id), find(vs[j].id));
  const groups = new Map(); for (const g of vs) { const r = find(g.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(g); }
  const old = S.peoples || [], next = [], used = new Set();
  for (const gs of groups.values()) {
    const pop = gs.reduce((s, g) => s + g.members.length, 0);
    // a people is two villages or more, or one big village (40 people and more) that keeps to itself
    if (gs.length < 2 && pop < 40) { for (const g of gs) g.people = null; continue; }
    const ids = gs.map(g => g.id);
    let best = null, bv = 0;
    for (const p of old) { if (used.has(p.id)) continue; const v = p.villages.filter(id => ids.includes(id)).length; if (v > bv) { bv = v; best = p; } }
    let p;
    if (best && bv * 2 >= Math.min(best.villages.length, ids.length)) { p = best; used.add(p.id); p.villages = ids; }
    else {
      // the self-name comes from the founder in the founding legend of the eldest village whose name no other people bears
      const taken = new Set(old.concat(next).map(q => q.self)), byAge = gs.slice().sort((a, b) => a.founded - b.founded);
      let eldest = byAge[0], origin = null, self = null;
      for (const v of byAge) {
        const o = (v.myths || []).find(y => y.kind === 'origin') || (v.mem || []).find(m => m.kind === 'origin');
        const hp = o && o.hero && personOf(S, o.hero), nm = `Дети ${hp ? nameCase(hp, 'genitive') : (o && o.heroName) || v.founder}`;
        if (!taken.has(nm)) { eldest = v; origin = o; self = nm; break; }
      }
      if (!self) self = `Люди «${eldest.name}»`;
      p = { id: (S.peopleId = (S.peopleId || 0) + 1), self, exo: COLOR_PEOPLE[eldest.cult.color], villages: ids, born: S.tick, color: eldest.cult.color };
      S.stats.peoplesBorn = (S.stats.peoplesBorn || 0) + 1;
      p.exo = exoName(gs, next);
      log(S, 'culture', `Складывается народ: ${p.self} — так они зовут себя, а соседи зовут их ${p.exo}. Это ${gs.map(g => `«${g.name}»`).join(', ')}`, eldest.home.x, eldest.home.y, eldest.hue, { why: sent([`у этих деревень общие обычаи: ${CULT_KEYS.filter(k => gs.every(g => g.cult[k] === eldest.cult[k])).map(k => cultWord(k, eldest.cult[k])).slice(0, 3).join(', ')}`, origin ? `и общее предание об основании: ${origin.heroName}` : '', 'свои узнают своих по цвету и узору']), gs: ids, causes: origin && origin.ev ? [origin.ev] : undefined });
    }
    // neighbours name a people by its colour; when another people already has that name, by its pattern
    const big = gs.slice().sort((a, b) => b.members.length - a.members.length)[0].cult;
    p.exo = exoName(gs, next); p.color = big.color; p.pattern = big.pattern;
    for (const g of gs) g.people = p.id;
    next.push(p);
  }
  for (const g of S.groups) if (!next.some(p => p.villages.includes(g.id))) g.people = null;
  S.peoples = next;
}
function exoName(gs, others) {
  const big = gs.slice().sort((a, b) => b.members.length - a.members.length)[0].cult, used = new Set(others.map(q => q.exo));
  return !used.has(COLOR_PEOPLE[big.color]) ? COLOR_PEOPLE[big.color] : !used.has(PATTERN_PEOPLE[big.pattern]) ? PATTERN_PEOPLE[big.pattern] : `${COLOR_PEOPLE[big.color]} ${PATTERN_PEOPLE[big.pattern].toLowerCase()}`;
}
const peopleOfG = (S, g) => g && g.people && (S.peoples || []).find(p => p.id === g.people);
// a person's people: the one they grew up in
function peopleOfA(S, a) { const g0 = a && a.home0 && S._g.get(a.home0.g); return (g0 && g0.people) || (a && a.home0 && a.home0.people) || null; }
// marriage: own people draw together, strangers apart (moderately)
function peopleBond(S, f, m) { const pf = peopleOfA(S, f), pm = peopleOfA(S, m); if (!pf || !pm) return 0; return pf === pm ? 0.3 : -0.15; }
// legends travel between villages of one people through marriages and trade (decided for К3)
function mythsTravel(S, vs) {
  for (const g of vs) {
    if (!g.people || !g.myths || !g.myths.length) continue;
    for (const o of vs) {
      if (o === g || o.people !== g.people || !((S.kinTies || {})[key(g.id, o.id)] || S.routes[key(g.id, o.id)])) continue;
      if (hash01(S.tick * 3 + g.id * 17 + o.id) > 0.15) continue;
      const y = g.myths.find(x => x.version !== 'old' && !(o.myths || []).some(z => z.ev === x.ev)); if (!y) continue;
      inheritMyths(S, { myths: [y], name: g.name }, o);
      S.stats.mythTravel = (S.stats.mythTravel || 0) + 1;
    }
  }
}
// the culture a person grows up in (set when they come of age or are born into the world)
function setHome0(S, a, g) { if (a && g) a.home0 = { g: g.id, name: g.name, people: g.people || null }; }
