/* ---------- laws with authors (П2, see docs/POLITICS.md) ---------- */
// Every change in how a village is run has an author, backers, opponents and a cause. The backers and opponents are
// chosen by interest: who gains and who loses by the law. enact() writes it all into one event; the author and up to
// three opponents get chronicle lines; the losers turn rivals of the author. Boehm 1993: a coalition of the rank and file
// keeps the ambitious in check; Blanton & Fargher 2008: a ruler who lives on his own people has to deal with them.
const LAW_CAUSE = {
  assembly: ['tyranny', 'tax', 'coup', 'crisis', 'battle', 'conquest', 'famine', 'revolt', 'schism', 'exodus', 'debt'],
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
function powerEvent(S, g, id) { if (g && id) { g.powerEv = cite(S, id); instMark(S, g, id); } }
// a change in how the village is run (a law, a coup, a conquest, a revolt): the regime may shift with it (П4)
function instMark(S, g, id) { if (g && id) { g.instT = S.tick; g.instEv = cite(S, id); } }
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
  const ev = log(S, o.type || 'law', o.text, o.x !== undefined ? o.x : g.home.x, o.y !== undefined ? o.y : g.home.y, g.hue, Object.assign({ why, who: [A.id, ...against.map(p => p.id)], gs: [g.id], causes: cause ? [cause] : undefined, author: A.id, against: against.map(p => p.id), backers: backers.slice(0, 10).map(p => p.id), law: o.kind, via }, o.extra || {}));
  if (o.authorLine) bio(S, A, 'law', o.authorLine, ev.id);
  for (const p of against) { bio(S, p, 'lawLost', o.lostLine(p), ev.id); bond(S, p, A, 'rival', o.grudge || `${fem(A, 'провёл', 'провела')} закон против меня`, 0.4, false, ev.id); }
  S.stats['law_' + o.kind] = (S.stats['law_' + o.kind] || 0) + 1;
  instMark(S, g, ev.id);
  return ev;
}
// does the ruler live off his own people (their shares) or off others (tribute, his own war band)? Blanton & Fargher:
// the first has to bargain and accepts a council; the second can do without one
function livesOffOthers(S, g, L) {
  const ret = g.members.filter(id => { const m = S._a.get(id); return m && L && m.patron === L.id; }).length / Math.max(1, g.members.length);
  // tribute from the conquered or the protected counts; the token share of one's own daughter village does not (a ramage, not a prey)
  return S.groups.some(o => o.lord === g.id && (o.tribRate || 0) >= 0.012) || ret > 0.2;
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
/* ---------- power in daily life (П3): the right to bread, the leader's share, the memory of tyranny ---------- */
// Scott 1976: people rise not because much is taken but because the ruler breaks the right to subsistence. In a hungry
// winter the leader either opens his store or keeps taking his share; both go to the chronicle with the famine as the cause.
function breadTest(S, g, L, mem, famEv) {
  const hungry = mem.filter(m => m !== L && m.wealth < 0 && !kin(m, L));
  if (!hungry.length) return;
  const avgW = mem.reduce((s, m) => s + Math.max(0, m.wealth), 0) / Math.max(1, mem.length);
  if (L.wealth > 6 && (L.coop > 0.55 || g.gov === 'assembly')) {
    const give = Math.min(L.wealth * 0.5, hungry.length * 3); L.wealth -= give;
    for (const m of hungry) { m.wealth += give / hungry.length; bump(m, L, 0.15); }
    L.rep = clamp((L.rep || 0) + 0.1, -1, 1); g.legit = clamp(g.legit + 0.1, 0, 1); L.status += 1;
    const ev = log(S, 'aid', `Голодная зима в «${g.name}»: вождь ${L.name} открывает свой амбар`, g.home.x, g.home.y, g.hue, { why: sent([`голодают ${hungry.length} ${pl(hungry.length, 'человек', 'человека', 'человек')}`, `${L.name} ${fem(L, 'раздаёт', 'раздаёт')} ${qty(give, 'food')} из своего запаса`, 'щедрость в голод — то, за что вождя и терпят']), who: [L.id, ...hungry.slice(0, 4).map(m => m.id)], gs: [g.id], causes: famEv ? [famEv] : undefined });
    bio(S, L, 'feedAll', `В голод открывает свой амбар для «${g.name}»`, ev.id);
    for (const m of topBy(hungry, m => m.status, 3)) bio(S, m, 'fedByLeader', `В голод получает зерно из амбара вождя ${nameCase(L, 'genitive')}`, ev.id);
    S.stats.breadKept = (S.stats.breadKept || 0) + 1;
    return;
  }
  if (g.take < 0.15 || L.wealth < Math.max(6, avgW * 3)) return;
  const ev = log(S, 'tyranny', `Голодная зима в «${g.name}», а вождь ${L.name} не уменьшает свою долю: ${P0(g.take)} общего хлеба`, g.home.x, g.home.y, g.hue, { why: sent([`голодают ${hungry.length} ${pl(hungry.length, 'человек', 'человека', 'человек')}`, `у ${nameCase(L, 'genitive')} запас ${Math.round(L.wealth)} — в ${Math.round(L.wealth / Math.max(0.5, avgW))} ${pl(Math.round(L.wealth / Math.max(0.5, avgW)), 'раз', 'раза', 'раз')} больше, чем у обычной семьи`, 'вождь, который берёт хлеб у голодных, нарушает право на пропитание; такое не прощают']), who: [L.id, ...hungry.slice(0, 4).map(m => m.id)], gs: [g.id], causes: famEv ? [famEv] : undefined });
  g.tyr = { t: S.tick, ev: cite(S, ev.id), L: L.id, lin: linOf(S, L), name: L.name };
  memPower(S, g, { ev: ev.id, tone: 'grief', w: 0.9, what: `голодную зиму, когда ${L.name} ${fem(L, 'брал', 'брала')} хлеб у голодных`, hero: L.id, villain: true, lin: L.lin });
  L.rep = clamp((L.rep || 0) - 0.15, -1, 1); g.legit = clamp(g.legit - 0.15, 0.1, 1);
  for (const m of hungry) { m.res = clamp(m.res + 0.25, 0, 1); m.trust[L.id] = clamp((m.trust[L.id] || 0) - 0.15, -1, 1); }
  const heads = topBy(hungry, m => m.status + (m.spouse ? 2 : 0), 4);
  for (const m of heads) bio(S, m, 'tyranny', `Голодает, пока вождь ${L.name} берёт свою долю хлеба`, ev.id);
  if (heads[0]) bond(S, heads[0], L, 'enemy', 'брал хлеб у голодных', 0.6, false, ev.id);
  S.stats.breadBroken = (S.stats.breadBroken || 0) + 1;
}
// the leader's share felt by families: the first time a ruler takes a third of the common harvest, the heads of the other
// lines note it (once per ruler)
function shareFelt(S, g, L) {
  if (g.take < 0.33 || g.taxL === L.id || !g.home || g.members.length < 8) return;
  g.taxL = L.id;
  const heads = lineHeads(S, g).filter(h => h !== L && linOf(S, h) !== linOf(S, L));
  if (!heads.length) return;
  const ev = (g.members.length >= 15 ? log : note)(S, 'tax', `Вождь ${L.name} забирает уже ${P0(g.take)} общего урожая «${g.name}»`, g.home.x, g.home.y, g.hue, { why: sent([`с каждой семьи — треть и больше`, `главы родов недовольны: ${heads.slice(0, 3).map(h => h.name).join(', ')}`]), who: [L.id, ...heads.slice(0, 3).map(h => h.id)], gs: [g.id], causes: g.powerEv && eventById(S, g.powerEv) ? [g.powerEv] : undefined });
  // only the chronicle: the grievance itself already grows every month from the unfair share (no double count)
  for (const h of heads.slice(0, 5)) bio(S, h, 'tax', `Отдаёт вождю ${nameCase(L, 'dative')} ${P0(g.take)} урожая своей семьи`, ev.id);
}
// a tyrant's line is remembered: its candidates lose votes for thirty years
const tyrantLine = (S, g, c) => (g.tyr && S.tick - g.tyr.t < 360 * 30 && linOf(S, c) === g.tyr.lin) || !!mythVillain(S, g, linOf(S, c)); // К2: or while the legend of the tyrant is told
// Hirschman 1970: exit is costly, and more so each time: whoever has already left a village or two puts up with the next
// one longer (a house, fields and kin to lose again). The first exit is as before: it is the repeats that become rarer
function exitCost(S, a, g) { const quits = (a.kc && a.kc.quit) || 0; return (linGraves(g, a.lin) >= 3 ? 0.8 : 1) / (1 + 2 * quits); } // К1: leaving the graves of one's line is harder
