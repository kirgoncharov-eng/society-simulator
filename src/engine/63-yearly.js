function yearly(S) {
  archiveGC(S);
  customsYear(S);
  droughtYear(S);
  roadsYear(S);
  for (const g of S.groups) { g.cross12 = g.cross || 0; g.cross = 0; }
  for (const a of S.agents) ageTemper(S, a);
  roomYear(S);
  plagueYear(S);
  territories(S);
  states(S);
  for (const g of S.groups) {
    if (!g.home) continue;
    const r = regime(S, g);
    g.rhist = g.rhist || []; const lp = g.rhist[g.rhist.length - 1]; g.rhist.push(lp ? [+(lp[0] * 0.6 + r.c * 0.4).toFixed(3), +(lp[1] * 0.6 + r.b * 0.4).toFixed(3)] : [+r.c.toFixed(3), +r.b.toFixed(3)]); if (g.rhist.length > 30) g.rhist.shift();
    if (g.members.length < 6) { g.rcand = null; continue; }
    if (!g.rtype) { g.rtype = r.type; g.rT = S.tick; g.rBase = regimeBase(g); continue; }
    if (r.type === g.rtype) { g.rcand = null; continue; }
    // the regime changes with history (П4): at once after a law, a coup, a conquest or a revolt; otherwise only when the
    // new order has held for ten years, so a few more trades in a good year do not relabel a village
    const base = regimeBase(g), cause = base !== g.rBase && g.instT && g.instT > (g.rT || 0) && g.instEv && eventById(S, g.instEv) ? g.instEv : null;
    if (!cause) { if (g.rcand !== r.type) { g.rcand = r.type; g.rcandT = S.tick; continue; } if (S.tick - g.rcandT < 360 * 10) continue; }
    const from = g.rtype; g.rtype = r.type; g.rcand = null; g.rT = S.tick; g.rBase = base;
    const rev = log(S, 'regime', `«${g.name}» меняет строй: ${from.toLowerCase()} → ${r.type.toLowerCase()}`, g.home.x, g.home.y, g.hue, { why: r.why + (cause ? '' : ' Перемена копилась десять лет.'), gs: [g.id], who: [g.leader], causes: cause ? [cause] : undefined, drift: !cause });
    (g.regimes || (g.regimes = [])).push([S.tick, r.type, rev.id]); if (g.regimes.length > 8) g.regimes.shift();
  }
  for (const g of S.groups) { villageYear(S, g); memoryYear(S, g); }
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
    S._nodesById = null;
    log(S, 'shock', 'Открыт новый богатый источник', x, y, 45, { why: 'Новый ресурс меняет баланс сил: кто дотянется до него первым, тот усилится.' });
  }
  if (kind === 'strangers') {
    const avgNorm = S.agents.reduce((s, a) => s + a.norm, 0) / Math.max(1, S.agents.length);
    const side = rnd(S) < 0.5 ? 0 : 1, ids = [];
    for (let i = 0; i < 15; i++) ids.push(spawn(S, 'out', { side, culture: () => ({ norm: clamp(1 - avgNorm + gauss(S) * 0.15, 0, 1), ambition: clamp(0.75 + gauss(S) * 0.2, 0, 1), coop: clamp(0.55 + gauss(S) * 0.2, 0, 1), wealth: 6 }) }));
    for (const a of ids) for (const b of ids) if (a !== b) a.trust[b.id] = 0.4;
    log(S, 'shock', `С ${side === 0 ? 'востока' : 'запада'} приходят 15 чужаков со своими нормами`, side === 0 ? 960 : 40, 500, 0, { why: 'Их понятие справедливости противоположно здешнему, они рвутся к власти и держатся друг друга. Скорее всего, они сплотятся в свою общину и начнут спорить за землю и добычу.', who: ids.map(a => a.id) });
  }
  if (kind === 'decap' && big[0]) removeAgent(S, S._a.get(big[0].leader), 'vanish');
  if (kind === 'rumor' && big[1]) {
    const A = big[0], B = big[1], LA = S._a.get(A.leader), LB = S._a.get(B.leader);
    bump(LA, LB, -0.6); bump(LB, LA, -0.6);
    S.hostility[key(A.id, B.id)] = (S.hostility[key(A.id, B.id)] || 0) + 0.8;
    log(S, 'shock', `Слух: «${A.name}» будто бы готовит удар по «${B.name}»`, (A.cx + B.cx) / 2, (A.cy + B.cy) / 2, 0, { why: `Вожди ${LA.name} и ${LB.name} резко перестали доверять друг другу, вражда выросла. Дальше всё решит их характер.`, who: [LA.id, LB.id], gs: [A.id, B.id] });
  }
}

function serialize(S) { return JSON.stringify(S, (k, v) => k[0] === '_' ? undefined : v); }
function restore(str) {
  const S = JSON.parse(str); index(S);
  if (!Number.isInteger(S.minute) || S.minute < 0 || S.minute >= DAY_MINUTES) S.minute = 0;
  for (const g of S.groups) {
    if (!g.home) continue;
    if (g.plan && !g.plan.street) g.plan.street = streetFor(S, g);
    if (g.wallPlan) {
      const { segments, gates, built } = g.wallPlan;
      if (segments.length) (g.fortifications ||= []).push({ id: 'old:' + g.id, kind: 'palisade', segments, gates, built, height: 5.5 });
      delete g.wallPlan;
    }
    if (g.site?.kind === 'walls') {
      g.wood += g.site.wood || 0;
      g.site = null;
    }
    g.walls = !!g.fortifications?.length;
  }
  return S;
}

return { MODEL, witnesses, CASE_LABEL, householdView, villageHistory, storyOf, familyOf, storyWhy, personOf, dayWords, TRAITS, VILLAGE, word, statusLvl, repLvl, trustWord, hostWord, stepsWord, resWhy, GOAL_NAME, GOAL_OUT, nameCase, clanName, linMembers, linHead, linShare, sidesOf, topFates, dramaMeasure, turnKind, bondLabel, eventById, housemates, DAY_MINUTES, CELL_METRES, daylightHours, prepareDay, advanceMinutes, eventTime, routinePosition, newWorld, step, shock, serialize, restore, date, key, gini, regime, landTop, popOf, kin, kidsOf, groupName };

