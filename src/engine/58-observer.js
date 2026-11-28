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
  return { id: g.id, name: g.name, founded: g.founded, founder: g.founder, rtype: g.rtype, rows: g.vrows || [], turns };
}
