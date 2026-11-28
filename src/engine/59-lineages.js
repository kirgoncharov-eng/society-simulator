/* ---------- lineages: a line from a founder, its head, and how lines take sides (П1, see docs/POLITICS.md) ---------- */
// a.lin: the lineage, the id of its founder (whoever landed or came from outside); children take the father's line,
// or the mother's when the father is unknown. S.lins[id] = { n: founder's name, t: tick }.
// The name follows old clan names: Ардар → Ардаричи (genitive Ардаричей). Sahlins 1963, Kirch 1984: rank and office
// run in lines; power held by one line for several leaders becomes hereditary.
function newLin(S, a) { a.lin = a.id; (S.lins || (S.lins = {}))[a.id] = { n: a.name, t: S.tick }; return a.lin; }
// a saved world from before lineages: whoever has none starts a line of their own (their children will follow it)
function linOf(S, a) { if (!a) return null; if (!a.lin) { const fa = a.father && S._a.get(a.father), mo = a.mother && S._a.get(a.mother); const p = (fa && fa.lin) || (mo && mo.lin); if (p) a.lin = p; else newLin(S, a); } return a.lin; }
function clanName(S, lin, gen) {
  const f = (S.lins && S.lins[lin] && S.lins[lin].n) || '?';
  const base = /[аяоеиыуюэ]$/.test(f) ? f.slice(0, -1) : f;
  return base + (gen ? 'ичей' : 'ичи');
}
// adults of a line in a village, its share of the village, and its head: the eldest man, else the eldest adult
function linMembers(S, g, lin) { const out = []; for (const id of g.members) { const m = S._a.get(id); if (m && m.age >= 15 && linOf(S, m) === lin) out.push(m); } return out; }
function linShare(S, g, lin) { let n = 0, k = 0; for (const id of g.members) { const m = S._a.get(id); if (!m || m.age < 15) continue; n++; if (linOf(S, m) === lin) k++; } return n ? k / n : 0; }
function linHead(S, g, lin) {
  const ms = linMembers(S, g, lin).filter(m => m.age >= 25); if (!ms.length) return null;
  const men = ms.filter(m => m.sex === 'm');
  return (men.length ? men : ms).sort((a, b) => b.age - a.age)[0];
}
// the sides people take, by line: [[lin, count], ...] largest first
function sidesOf(S, people) { const c = new Map(); for (const p of people) { const l = linOf(S, p); c.set(l, (c.get(l) || 0) + 1); } return [...c.entries()].sort((a, b) => b[1] - a[1]); }
// «Ардаричи (5) и Миличи (3)»: the lines with two or more on that side; the rest as a count
function sidesTxt(S, people, max = 2) {
  const s = sidesOf(S, people), big = s.filter(x => x[1] >= 2).slice(0, max);
  if (!big.length) return people.length <= 3 ? people.map(p => p.name).join(', ') : `${people.length} ${pl(people.length, 'человек', 'человека', 'человек')} из разных родов`;
  const rest = people.length - big.reduce((t, x) => t + x[1], 0);
  return big.map(([l, n]) => `${clanName(S, l)} (${n})`).join(' и ') + (rest > 0 ? `, ещё ${rest} из других родов` : '');
}
// how a voter leans to a candidate for being of the same line, or of the spouse's line
function linPull(S, m, c) {
  const l = linOf(S, c); if (linOf(S, m) === l) return 0.3;
  const sp = m.spouse && S._a.get(m.spouse); return sp && linOf(S, sp) === l ? 0.15 : 0;
}
// after a leader is chosen: count how long the office has stayed in one line; when it stays for a second leader running
// and the line is a real force in the village, the office becomes hereditary in that line (the big man's line turns chiefly)
function linSuccession(S, g, W, old, ev) {
  const same = old && linOf(S, old) === linOf(S, W), prev = old && g.linId === linOf(S, old) ? (g.linN || 1) : 1;
  g.linN = same ? prev + 1 : 1; g.linId = linOf(S, W);
  if (g.dynasty || g.gov === 'assembly' || g.linN < 2 || g.members.length < 6) return;
  const share = linShare(S, g, g.linId);
  const son = old && (W.father === old.id || W.mother === old.id);
  const mound = ancestorMound(S, g, g.linId);
  if (!(linStrong(S, g, g.linId) || son || mound) || rnd(S) > 0.5) return;
  g.dynasty = true; g.dynName = clanName(S, g.linId, true); g.dynLin = g.linId; g.dynGen = 1; if (g.gov !== 'assembly') g.gov = 'monarch';
  S.stats.linDynasty = (S.stats.linDynasty || 0) + 1;
  if (!g.home) return;
  const rivals = rivalHeads(S, g, g.dynLin);
  enact(S, g, { kind: 'hered', author: W, backers: linMembers(S, g, g.dynLin), against: rivals, cause: ev || null, propose: 'за наследование стоит', extra: { sides: 1 },
    text: `Власть в «${g.name}» закрепляется за родом ${g.dynName}: ${W.name} — ${g.linN}-й вождь из этого рода подряд`,
    authorLine: `Власть закрепляется за родом ${g.dynName}: после ${fem(W, 'него', 'неё')} она перейдёт по наследству`, lostLine: p => `Род ${clanName(S, linOf(S, p), true)} теряет надежду на власть в «${g.name}»: она закреплена за ${g.dynName}`, grudge: 'власть закреплена за чужим родом',
    why: [son ? `${W.name} — ${fem(W, 'сын', 'дочь')} ${nameCase(old, 'genitive')}, и деревня выбрала ${fem(W, 'его', 'её')} вслед за ${fem(old, 'отцом', 'матерью')}` : `${old.name} и ${W.name} — оба из рода ${g.dynName}`, g.linId === g.foundLin ? `это род первопоселенцев, основавших «${g.name}»: ${P0(share)} взрослых деревни` : `род — ${P0(share)} взрослых деревни, и за его главой идут`, 'теперь вождя не выбирают: после него власть перейдёт к его детям, а нет детей — к старшему в роду'] });
}
// a line can hold the office by right when it is a fifth of the village, or a tenth if it is the line of the first-comers
// who founded the village (precedence in Austronesian societies: Fox & Sather 1996, Vischer 2009)
function linStrong(S, g, lin) { const s = linShare(S, g, lin); return s >= 0.2 || (lin === g.foundLin && s >= 0.1); }
// the heir under hereditary rule: a grown child first, else the eldest grown member of the ruling line in the village
function linHeir(S, g, old) {
  const mem = g.members.map(id => S._a.get(id)).filter(Boolean);
  const kids = mem.filter(m => (m.father === old.id || m.mother === old.id || m.parent === old.id) && m.age >= 15).sort((a, b) => b.age - a.age);
  if (kids.length) return { W: kids[0], how: 'child' };
  const lin = g.dynLin || linOf(S, old);
  const line = mem.filter(m => m !== old && m.age >= 18 && linOf(S, m) === lin).sort((a, b) => b.age - a.age);
  return line.length ? { W: line[0], how: 'line' } : null;
}
