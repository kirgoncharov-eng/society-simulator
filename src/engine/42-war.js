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
  return able.filter(m => m !== L || n < 8).slice(0, Math.max(3, Math.min(Math.round(n * 0.45), 4 + Math.round(n * 0.25))));
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
  // in the fight: the guard and those closest to the gate; the rest hide or run to the fields
  const near = B.members.map(id => S._a.get(id)).filter(m => m && !m.car && !m.war && Math.hypot(m.x - B.home.x, m.y - B.home.y) < 160);
  const defenders = near.filter(m => m.job === 'guard').concat(near.filter(m => m.job !== 'guard').sort((p, q) => Math.hypot(p.x - B.home.x, p.y - B.home.y) - Math.hypot(q.x - B.home.x, q.y - B.home.y)).slice(0, 8));
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
