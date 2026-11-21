/* ---------- laws with authors (П2, see docs/POLITICS.md) ---------- */
// Every change in how a village is run has an author, backers, opponents and a cause. The backers and opponents are
// chosen by interest: who gains and who loses by the law. enact() writes it all into one event; the author and up to
// three opponents get chronicle lines; the losers turn rivals of the author. Boehm 1993: a coalition of the rank and file
// keeps the ambitious in check; Blanton & Fargher 2008: a ruler who lives on his own people has to deal with them.
const LAW_CAUSE = {
  assembly: ['coup', 'crisis', 'battle', 'conquest', 'famine', 'revolt', 'schism', 'exodus', 'debt'],
  dissolve: ['battle', 'conquest', 'famine', 'exodus', 'raid'],
  hered: ['succession', 'coup', 'crisis', 'found', 'colony'],
  land: ['famine', 'debt', 'land', 'case', 'law'],
  code: ['reform', 'schism', 'exodus', 'crisis', 'case', 'coup', 'quit', 'exile'],
  jubilee: ['debt', 'revolt', 'famine'],
  custom: ['case', 'revenge']
};
// the event a law answers to: the latest in this village of the kinds that law is about, within ten years; failing that,
// the event that brought the present ruler to power
// the event that brought the present ruler to power. Quiet records in the archive count too (a reform nobody left over,
// a quarrel with the leader). Returns [id, via] where via is 'reason' or 'power'.
function lawCause(S, g, kind) {
  const types = LAW_CAUSE[kind] || [];
  for (const e of S.events) { if (S.tick - e.t > 360 * 10) break; if (e.gs && e.gs.includes(g.id) && types.includes(e.type)) return [e.id, 'reason']; }
  let best = null;
  for (const id in S.evArch || {}) { const e = S.evArch[id]; if (e.quiet && S.tick - e.t <= 360 * 10 && e.gs && e.gs.includes(g.id) && types.includes(e.type) && (!best || e.t > best.t)) best = e; }
  if (best) return [best.id, 'reason'];
  return g.powerEv && eventById(S, g.powerEv) ? [g.powerEv, 'power'] : [null, null];
}
// remember the event that brought a ruler to power: a law later may point to it
function powerEvent(S, g, id) { if (g && id) g.powerEv = cite(S, id); }
const adultsOf = (S, g) => g.members.map(id => S._a.get(id)).filter(m => m && m.age >= 18);
const topBy = (arr, f, n) => arr.slice().sort((a, b) => f(b) - f(a)).slice(0, n);
// the heads of the lines with two or more adults in the village
function lineHeads(S, g) { const out = []; for (const [l, n] of sidesOf(S, adultsOf(S, g))) { if (n < 2) continue; const h = linHead(S, g, l); if (h) out.push(h); } return out; }
const nameLine = (S, p) => `${p.name} (${clanName(S, linOf(S, p))})`;
// o: { type, kind, text, author, backers, against, why: [..], authorLine, lostLine(p), grudge, x, y, extra, cause }
function enact(S, g, o) {
  const A = o.author, against = (o.against || []).filter(p => p && p !== A).slice(0, 3), backers = (o.backers || []).filter(p => p && p !== A);
  const [cause, via] = o.cause !== undefined ? [o.cause, o.cause ? 'reason' : null] : lawCause(S, g, o.kind);
  const why = sent((o.why || []).concat([
    `${o.propose || 'предлагает'} ${nameLine(S, A)}`,
    backers.length ? `за — ${sidesTxt(S, backers)}` : '',
    against.length ? `против — ${against.map(p => nameLine(S, p)).join(', ')}` : 'открыто против никто не выступает'
  ]));
  const ev = log(S, o.type || 'law', o.text, o.x !== undefined ? o.x : g.home.x, o.y !== undefined ? o.y : g.home.y, g.hue, Object.assign({ why, who: [A.id, ...against.map(p => p.id)], gs: [g.id], causes: cause ? [cause] : undefined, author: A.id, against: against.map(p => p.id), law: o.kind, via }, o.extra || {}));
  if (o.authorLine) bio(S, A, 'law', o.authorLine, ev.id);
  for (const p of against) { bio(S, p, 'lawLost', o.lostLine(p), ev.id); bond(S, p, A, 'rival', o.grudge || `${fem(A, 'провёл', 'провела')} закон против меня`, 0.4, false, ev.id); }
  S.stats['law_' + o.kind] = (S.stats['law_' + o.kind] || 0) + 1;
  return ev;
}
// does the ruler live off his own people (their shares) or off others (tribute, his own war band)? Blanton & Fargher:
// the first has to bargain and accepts a council; the second can do without one
function livesOffOthers(S, g, L) {
  const ret = g.members.filter(id => { const m = S._a.get(id); return m && L && m.patron === L.id; }).length / Math.max(1, g.members.length);
  return S.groups.some(o => o.lord === g.id) || ret > 0.2;
}
// who would call an assembly: a respected head of another line who values fairness; else the most respected such person
function assemblyAuthor(S, g, L) {
  const lin = L && linOf(S, L), heads = lineHeads(S, g).filter(h => h !== L && linOf(S, h) !== lin && h.norm > 0.45);
  const pool = heads.length ? heads : adultsOf(S, g).filter(m => m !== L && m.norm > 0.45);
  return topBy(pool, m => m.status * (0.5 + m.coop), 1)[0] || null;
}
// the heads of other lines who lose the hope of the office when it is fixed in one line: the strong ones first
function rivalHeads(S, g, lin) {
  const hs = lineHeads(S, g).filter(h => linOf(S, h) !== lin);
  const strong = hs.filter(h => linShare(S, g, linOf(S, h)) >= 0.1);
  return topBy(strong.length ? strong : hs, h => h.status, 2);
}
