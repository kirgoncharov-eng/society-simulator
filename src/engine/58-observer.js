/* ---------- the observer (Н2): what matters to the whole island, and the story of the one you follow ---------- */
// Rites and border skirmishes of other people's villages fill the common feed: a harvest feast every few years in every
// village, the wedding of every leader's nephew. They stay in the chronicle, but the common feed shows them only when they
// matter to the island: a leader marries or is buried, blood is shed on the border or two feuding villages clash, or the
// thing happens for the first time in the world. A minor event still shows in the story of anyone it concerns.
const MINOR_CHECK = new Set(['rite', 'border', 'conflict']);
function minorEvent(S, ev) {
  const seen = S.firstSeen || (S.firstSeen = {}), kind = ev.type + ':' + (ev.rite || '');
  if (!seen[kind]) { seen[kind] = ev.id; return false; }
  const g = ev.gs && S._g.get(ev.gs[0]), L = g && g.leader;
  if (ev.type === 'rite') {
    // a leader's funeral: power passes to someone else
    if (ev.rite === 'funeral') return false;
    // a wedding: only the leader's own (the groom and the bride come first in who), not the kin's
    if (ev.rite === 'wedding') return !(L && ev.who && ev.who.slice(0, 2).includes(L));
    // a harvest feast: only a leader's first feast at his own cost in a village of fifteen or more, a show of power
    if (ev.rite === 'feast') {
      const h = ev.host && S._a.get(ev.host);
      if (!h || h.feastEv) return true;
      h.feastEv = ev.id;
      return !g || g.members.length < 15;
    }
    return true;
  }
  if (ev.type === 'border') {
    if (ev.kill || !ev.pair) return !ev.kill;
    const first = S.borderSeen || (S.borderSeen = {});
    if (!first[ev.pair]) { first[ev.pair] = ev.id; return false; }
    return (S.hostility[ev.pair] || 0) < 0.8;
  }
  if (ev.type === 'conflict') return !ev.big;
  return false;
}

// the family of a person: spouse, parents, children and brothers and sisters, the living and the dead
function personOf(S, id) { return S._a.get(id) || (S.legends || []).find(l => l.id === id) || (S.shades && S.shades[id]) || null; }
function familyOf(S, a) {
  const fam = new Map([[a.id, 'self']]);
  const put = (id, rel) => { if (id && !fam.has(id)) fam.set(id, rel); };
  put(a.spouse, 'spouse'); put(a.mother, 'parent'); put(a.father, 'parent');
  const dead = [...(S.legends || []), ...Object.values(S.shades || {})];
  for (const o of [...S.agents, ...dead]) {
    if (o.id === a.id) continue;
    if (o.mother === a.id || o.father === a.id) put(o.id, 'child');
    else if ((a.mother && o.mother === a.mother) || (a.father && o.father === a.father)) put(o.id, 'sibling');
  }
  return fam;
}
const linIdOf = (S, id) => { const o = S._a.get(id); return o ? o.lin : (S.shades && S.shades[id] && S.shades[id].linId) || null; };
// why an event belongs to someone's story: 'self', 'family', 'line' (another member of the lineage) or 'village'
function storyWhy(S, ev, a, fam, lin) {
  const ids = [...(ev.who || []), ...(ev.author ? [ev.author] : []), ...(ev.against || [])];
  let line = false;
  for (const id of ids) {
    if (id === a.id) return 'self';
    if (fam.has(id)) return 'family';
    if (lin && !line && linIdOf(S, id) === lin) line = true;
  }
  if (line) return 'line';
  if (!ev.quiet && !ev.minor && a.group && ev.gs && ev.gs.includes(a.group)) return 'village';
  return null;
}
// the story of one person: their events, their family's, their lineage's and the main events of their village, newest
// first, from the feed and the archive. Returns [{ ev, why }]
function storyOf(S, id, limit = 80) {
  const a = personOf(S, id); if (!a) return [];
  const fam = familyOf(S, a), lin = a.lin || a.linId || null, out = [], seen = new Set();
  const take = ev => { if (seen.has(ev.id)) return; seen.add(ev.id); const why = storyWhy(S, ev, a, fam, lin); if (why) out.push({ ev, why, rel: why === 'family' ? relOf(ev, fam) : undefined }); };
  for (const ev of S.events) take(ev);
  for (const k in S.evArch || {}) take(S.evArch[k]);
  out.sort((x, y) => y.ev.id - x.ev.id);
  return out.slice(0, limit);
}
// the closest relative among the participants: spouse, then children, parents, brothers and sisters; [relation, id]
const REL_RANK = { spouse: 0, child: 1, parent: 2, sibling: 3 };
function relOf(ev, fam) {
  let best = null;
  for (const id of [...(ev.who || []), ...(ev.author ? [ev.author] : []), ...(ev.against || [])]) { const r = fam.get(id); if (r && r !== 'self' && (!best || REL_RANK[r] < REL_RANK[best[0]])) best = [r, id]; }
  return best || undefined;
}

/* ---------- how a village became what it is (Н3) ---------- */
// The village keeps its own chronicle: the ids of its turning points (laws, regime changes, coups, successions, splits,
// conquests, hungry winters, a leader's share) and once a year a short line of figures: people, the ruler and his line,
// the leader's share, who holds the fields by lineage, the regime. The archive keeps the marked events, so the history page
// can open a law from sixty years ago and its causes.
const VILLAGE_TURNS = new Set(['regime', 'law', 'land', 'gov', 'debt', 'coup', 'succession', 'schism', 'exodus', 'conquest', 'revolt', 'famine', 'tyranny', 'tax', 'reform', 'found', 'colony', 'merge', 'state', 'battle', 'abandon', 'crisis', 'faith', 'money']);
const VILLAGE_TURNS_MAX = 160;
// the village is the first in gs; a second village keeps only a war, a conquest, a merger or a vassal state
const VILLAGE_TURNS_BOTH = new Set(['battle', 'conquest', 'state', 'merge', 'revolt']);
function histMark(S, ev) {
  if (!VILLAGE_TURNS.has(ev.type) || !ev.gs || !S._g) return;
  let marked = false;
  ev.gs.forEach((id, i) => {
    if (i > 0 && !VILLAGE_TURNS_BOTH.has(ev.type)) return;
    const g = S._g.get(id); if (!g) return;
    const h = g.hev || (g.hev = []); if (h[h.length - 1] !== ev.id) h.push(ev.id); if (h.length > VILLAGE_TURNS_MAX) h.shift();
    marked = true;
  });
  // the village's own chronicle cites the event: it stays in the archive after it leaves the feed
  if (marked) (S.evArch || (S.evArch = {}))[ev.id] = ev;
}
// once a year: [year, people, ruler's name, ruler's line (genitive: «из Фааричей»), hereditary?, leader's share %, regime, rule, land, fields, holdings]
// holdings: [[line name, fields], ...] for private land, the three largest lines
function villageYear(S, g) {
  if (!g.home) return;
  const L = S._a.get(g.leader), by = {};
  if (g.land === 'private') for (const f of g.fields) { const o = f.owner && S._a.get(f.owner); const k = o && o.lin ? clanName(S, o.lin) : f.owner ? '?' : '—'; by[k] = (by[k] || 0) + 1; }
  const hold = Object.entries(by).filter(([k]) => k !== '—').sort((a, b) => b[1] - a[1]).slice(0, 3);
  (g.vrows || (g.vrows = [])).push([Math.floor(S.tick / 360), g.members.length, L ? L.name : '', L && L.lin ? clanName(S, L.lin, true) : '', g.dynasty ? 1 : 0, Math.round(g.take * 100), g.rtype || '', g.gov || '', g.land || 'common', g.fields.length, hold]);
}
// the history page of a village: its yearly lines and its turning points, oldest first, each with what caused it
function villageHistory(S, gid) {
  const g = S._g.get(gid); if (!g) return null;
  const turns = (g.hev || []).map(id => eventById(S, id)).filter(Boolean).sort((a, b) => a.id - b.id);
  // К1: what the village remembers, how strongly, who still saw it, what holds it; what it has forgotten
  const memories = (g.mem || []).slice().sort((a, b) => b.w - a.w).map(m => Object.assign({}, m, { living: witnesses(S, m), placeName: (placeById(S, m.place) || {}).name, memorial: g.memDay === m.id }));
  const forgotten = (g.memGone || []).map(m => Object.assign({}, m, { placeName: (placeById(S, m.place) || {}).name }));
  // К2: legends, each with the other villages' tellings of the same event
  const myths = (g.myths || []).map(y => Object.assign({}, y, { others: S.groups.filter(o => o !== g).flatMap(o => (o.myths || []).filter(x => x.ev === y.ev || (x.merged || []).some(e => e[0] === y.ev)).map(x => ({ village: o.name, text: x.text }))) }));
  return { id: g.id, name: g.name, founded: g.founded, founder: g.founder, rtype: g.rtype, rows: g.vrows || [], turns, memories, forgotten, myths };
}

/* ---------- the household (Н4): what the regime means at the level of one family ---------- */
// Five questions that tell regimes apart in daily life: whose field the family works, who takes a part of its harvest,
// who settles its disputes, whom it owes and who owes it, whose house it lives in. Everything is read from the world as it
// is: the field split (60-step.js), the leader's share and the tribute (61-monthly.js, 42-war.js), patrons and loans
// (61-monthly.js, 44-institutions.js), customs and the judge (55-customs.js), houses (54-households.js).
function householdView(S, id) {
  const a = S._a.get(id); if (!a) return null;
  const g = a.group && S._g.get(a.group), L = g && S._a.get(g.leader);
  const hm = housemates(S, a), people = hm ? [a, ...hm.with] : [a, ...(a.spouse && S._a.get(a.spouse) ? [S._a.get(a.spouse)] : [])];
  const inHouse = new Set(people.map(p => p.id));
  const house = hm ? { owner: hm.owner ? hm.owner.name : null, ownerId: hm.owner ? hm.owner.id : null, earth: !!hm.house.earth, built: hm.house.built, kids: hm.kids, ownHouse: !!(hm.owner && inHouse.has(hm.owner.id)) } : null;
  // whose field each worker of the house works, and how the harvest is split
  const work = people.filter(p => p.age >= 15).map(p => {
    const row = { id: p.id, name: p.name, job: p.job || null };
    if (p.job !== 'farm' || !g || !g.fields.length) return row;
    const f = g.fields[(p.slot || 0) % g.fields.length], ow = f.owner && S._a.get(f.owner);
    if (g.land !== 'private' || !ow || ow.group !== g.id) row.field = { kind: 'common' };
    else if (ow === p) row.field = { kind: 'own' };
    else if (inHouse.has(ow.id)) row.field = { kind: 'family', owner: ow.name };
    else row.field = { kind: 'hired', owner: ow.name, ownerId: ow.id, line: ow.lin ? clanName(S, ow.lin, true) : null };
    return row;
  });
  const owned = g && g.land === 'private' ? g.fields.filter(f => inHouse.has(f.owner)).length : 0;
  // who takes a part: the leader, a landlord, an overlord, a patron, a creditor
  const take = [];
  if (g && L) take.push(inHouse.has(L.id) ? { kind: 'leaderHouse', share: g.take } : { kind: 'leader', name: L.name, nid: L.id, share: g.take });
  for (const r of work) if (r.field && r.field.kind === 'hired') take.push({ kind: 'landlord', name: r.field.owner, nid: r.field.ownerId, worker: r.name });
  const lord = g && g.lord && S._g.get(g.lord);
  if (lord) take.push({ kind: 'tribute', name: lord.name, rate: Math.round(Math.min(g.tribRate || 0.02, 0.02) * 12 * 100) });
  for (const p of people) {
    const pt = p.patron && S._a.get(p.patron);
    if (pt && L && pt.id === L.id && !inHouse.has(pt.id)) take.push({ kind: 'retainer', name: p.name, patron: pt.name, nid: pt.id });
    else if (pt && !inHouse.has(pt.id)) take.push({ kind: 'client', name: p.name, patron: pt.name, nid: pt.id });
  }
  // debts both ways
  const owes = people.filter(p => p.debt > 0.5 && p.cred && !inHouse.has(p.cred)).map(p => { const c = S._a.get(p.cred); return { name: p.name, to: c ? c.name : '?', nid: c ? c.id : null, amount: Math.round(p.debt), rate: Math.round((p.rate || 0) * 100), bond: !!p.bond }; });
  const owed = S.agents.filter(o => o.debt > 0.5 && inHouse.has(o.cred) && !inHouse.has(o.id)).map(o => ({ name: o.name, to: (S._a.get(o.cred) || {}).name, amount: Math.round(o.debt), bond: !!o.bond }));
  const obliged = [];
  for (const p of people) for (const oid in p.bonds || {}) { const b = p.bonds[oid]; const o = S._a.get(+oid); if (b[0] === 'debt' && o && !inHouse.has(o.id)) obliged.push({ name: p.name, to: o.name, nid: o.id, why: b[3], ev: b[5] }); }
  // who settles a dispute: a custom, the assembly or the leader; in a blood feud the old people talk for blood money
  const customs = Object.entries((g && g.customs) || {}).map(([k, o]) => ({ kind: k, outcome: o, ev: g.customEv && g.customEv[k] }));
  const court = g ? { by: g.gov === 'assembly' ? 'assembly' : 'leader', leader: L ? L.name : null, nid: L ? L.id : null, customs, elders: g.members.filter(id => { const m = S._a.get(id); return m && m.age > 55; }).length } : null;
  return { name: a.name, village: g ? g.name : null, people: people.map(p => ({ id: p.id, name: p.name, age: Math.floor(p.age), sex: p.sex })), house, work, owned, fields: g ? g.fields.length : 0, land: g ? g.land || 'common' : null, take, owes, owed, obliged: obliged.slice(0, 4), court };
}
