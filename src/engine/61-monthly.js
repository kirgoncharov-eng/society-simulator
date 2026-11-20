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
    if (L && rnd(S) < 0.25 + 0.6 * L.coop + 0.3 * ((a.rep || 0))) {
      if (a.wealth < 0) rememberGrain(S, a, L, note(S, 'aid', `${L.name} из «${rich.name}» даёт зерно голодному ${a.name}`, a.x, a.y, rich.hue, { who: [L.id, a.id], gs: [rich.id] }).id);
      rich.treasury -= 1.5; a.wealth += 1.5; bump(a, L, 0.08); L.rep = clamp((L.rep || 0) + 0.01, -1, 1); S.stats.alms = (S.stats.alms || 0) + 1;
    }
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
    if (a.wealth > 1 || a.age < 15 || a.war) continue;
    const g0 = a.group && S._g.get(a.group);
    if (g0 && (a.role === 'leader' || g0.treasury > g0.members.length * (g0.members.length > 4 ? 1.2 : 2) || (g0.members.length > 4 && a.wealth > -0.4))) continue;
    let best = null, bv = -1e9, usual = null, usualScore = -1e9, memory = null;
    for (const g of S.groups) {
      if (!g.home || g.dead || g === g0 || g.members.length < (g0 ? 5 : 3)) continue;
      const d = Math.hypot(g.home.x - a.x, g.home.y - a.y);
      if (d > (g0 ? 380 : 600)) continue;
      const fh = g.treasury / Math.max(1, g.members.length);
      if (g0 && fh < 2) continue;
      if (exiledBy(S, a, g.id)) continue; // a village that cast you out does not hire you back
      const base = fh - d / 60;
      if (base > usualScore) { usualScore = base; usual = g; }
      const canFeedNewcomer = g.treasury >= (g.members.length + 1) * 3;
      const remembered = canFeedNewcomer ? rememberedGrain(S, a, g.id, 180) : null;
      const score = base + (remembered ? 3 : 0);
      if (score > bv) { bv = score; best = g; memory = remembered; }
    }
    if (!best || !reach(S, a.x, a.y, best.home.x, best.home.y)) continue;
    const L = S._a.get(best.leader); if (!L) continue;
    const chance = (0.35 * (0.5 + L.coop) + Math.min(0.4, best.treasury / Math.max(1, best.members.length) / 25)) * ((a.rep || 0) > -0.3 ? 1 : g0 ? 0.2 : 0.45) + (g0 ? 0 : 0.15);
    const helper = memory?.helper;
    const welcome = helper === L && !exiledBy(S, a, best.id) ? 0.15 : 0;
    const sponsor = helper && helper !== L && !exiledBy(S, a, best.id) && helper.coop >= 0.35 && (L.trust[helper.id] || 0) >= 0.1;
    const roll = rnd(S);
    if (roll >= chance + welcome + (sponsor ? 0.18 : 0)) continue;
    const sp = a.spouse && S._a.get(a.spouse);
    join(S, a, best, best.leader);
    if (memory && (best !== usual || roll >= chance)) {
      const first = !S.stats.aidMemoryMoves;
      S.stats.aidMemoryMoves = (S.stats.aidMemoryMoves || 0) + 1;
      const sponsorDecided = sponsor && roll >= chance;
      if (sponsorDecided) {
        S.stats.aidSponsoredMoves = (S.stats.aidSponsoredMoves || 0) + 1;
        bio(S, helper, 'sponsor', `Ручается перед вождём ${L.name} за переселенца ${a.name}`);
      }
      const why = `${a.name} помнит, как ${helper.name} ${helper.sex === 'f' ? 'помогла' : 'помог'} с зерном. ${sponsorDecided ? `${helper.name} ${helper.sex === 'f' ? 'поручилась' : 'поручился'} перед вождём ${L.name}, и в деревне дали работу за еду.` : 'Теперь в деревне предлагают работу за еду.'}`;
      const src = memory.memory && memory.memory.ev;
      bio(S, a, 'move', `Уходит в «${best.name}», к тем, кто однажды помог зерном`, src);
      log(S, 'aid', `${a.name} находит приют в «${best.name}»`, best.home.x, best.home.y, best.hue, {
        first, why, who: sponsorDecided ? [a.id, helper.id, L.id] : [a.id, helper.id], gs: [best.id], causes: src ? [src] : undefined,
      });
    } else {
      bio(S, a, 'move', `Голодая, нанимается работать за еду в «${best.name}»`);
    }
    if (sp && g0 && sp.group === g0.id && sp.role !== 'leader' && !sp.war && !g0.dead) {
      join(S, sp, best, best.leader);
      bio(S, sp, 'move', `Уходит с ${sp.sex === 'f' ? 'мужем' : 'женой'} в «${best.name}» за куском хлеба`);
    }
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
  hamletsMonth(S);
  bondsMonth(S);
  householdsMonth(S);
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
    let best = null, bv = 0, usualDonor = null, usualScore = 0;
    for (const o of S.groups) {
      if (o === g || !o.home || o.dead || o.treasury < o.members.length * 4) continue;
      const k = key(g.id, o.id), h = S.hostility[k] || 0, d = Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y);
      if (h > 0.6 || d > 420 || S.wars.some(w => (w.att === o.id && w.def === g.id) || (w.att === g.id && w.def === o.id))) continue;
      const LO = S._a.get(o.leader); if (!LO) continue;
      const t = tie[k] || 0, friend = allied(S, g.id, o.id) || (g.state && g.state === o.state) || g.lord === o.id || o.lord === g.id;
      const willingness = 0.25 + 0.35 * LO.coop + 0.12 * Math.min(4, t) + (friend ? 0.25 : 0) + 0.3 * (LO.trust[LG.id] || 0) - 0.4 * h;
      const baseP = clamp(willingness, 0, 0.9);
      const weight = (o.treasury / o.members.length) / (1 + d / 250);
      const baseScore = baseP * weight;
      if (baseScore > usualScore) { usualScore = baseScore; usualDonor = o; }
      const obligation = grainObligation(S, o, LO, g);
      const bonus = obligation ? (obligation.witness === LO ? 0.22 : 0.10) : 0;
      const p = clamp(willingness + bonus, 0, 0.9);
      const v = p * weight;
      if (v > bv) { bv = v; best = { o, p, baseP, t, friend, LO, obligation }; }
    }
    if (!best) continue;
    const roll = rnd(S);
    if (roll > best.p || !reach(S, best.o.home.x, best.o.home.y, g.home.x, g.home.y)) continue;
    const { o, t, friend, LO, obligation } = best, amt = Math.min((o.treasury - o.members.length * 3) * 0.4, n * 2);
    if (amt < 1) continue;
    o.treasury -= amt; g.treasury += amt; S.stats.aid = (S.stats.aid || 0) + 1; S.stats.aidFood = (S.stats.aidFood || 0) + amt;
    const k = key(g.id, o.id); S.hostility[k] = Math.max(0, (S.hostility[k] || 0) - 0.15);
    bump(LG, LO, 0.15); bond(S, LG, LO, 'debt', `${fem(LO, 'прислал', 'прислала')} зерно голодной «${g.name}»`, 0.6); LO.rep = clamp((LO.rep || 0) + 0.03, -1, 1); LO.status += 0.3;
    g.aidFrom = g.aidFrom || {};
    if (obligation) {
      repayGrain(S, o, obligation);
      const first = !S.stats.aidReturned;
      S.stats.aidReturned = (S.stats.aidReturned || 0) + 1;
      if (o !== usualDonor || roll > best.baseP) S.stats.aidMemoryChanged = (S.stats.aidMemoryChanged || 0) + 1;
      const { witness, helper, memory } = obligation;
      const ago = yrs(Math.floor((S.tick - memory.tick) / 360));
      log(S, 'aid', `«${o.name}» возвращает помощь «${g.name}»: ${qty(amt, 'food')}`, g.home.x, g.home.y, o.hue, {
        first,
        why: `${witness.name} помнит, как ${ago} назад ${helper.name} ${helper.sex === 'f' ? 'прислала' : 'прислал'} зерно в разгар голода. Теперь деревня делится в ответ.`,
        who: [...new Set([witness.id, helper.id, LO.id, LG.id])], gs: [o.id, g.id], causes: memory.ev ? [memory.ev] : undefined,
      });
    } else {
      const shown = !g.aidFrom[o.id] || S.tick - g.aidFrom[o.id] > 360 * 5;
      const aidEv = (shown ? log : note)(S, 'aid', `«${o.name}» посылает зерно голодающей «${g.name}»: ${qty(amt, 'food')}`, g.home.x, g.home.y, o.hue, { why: sent([t ? `у ${t} ${pl(t, 'жителя', 'жителей', 'жителей')} «${g.name}» родители или дети живут в «${o.name}»` : '', friend ? 'деревни в союзе' : '', LO.coop > 0.6 ? `${LO.name} щедр${LO.sex === 'f' ? 'а' : ''} и не бросает соседей` : '', `в «${o.name}» запасено ${Math.round(o.treasury + amt)} еды на ${o.members.length} ${pl(o.members.length, 'едока', 'едоков', 'едоков')}`, 'такую помощь помнят долго']), who: [LO.id, LG.id], gs: [o.id, g.id] });
      for (const id of g.members) {
        const a = S._a.get(id);
        if (id === g.leader || a.wealth < 0.3) rememberGrain(S, a, LO, aidEv.id);
      }
    }
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
    if (cur.length < want) { const c = mem.filter(m => m.patron !== L.id && !kin(m, L) && m.res < 0.5).sort((a, b) => b.skill - a.skill)[0]; if (c) { c.patron = L.id; bump(c, L, 0.2); if (c.lastPatron !== L.id) bio(S, c, 'retainer', `Поступает в дружину вождя ${L.name}`); c.lastPatron = L.id; } }
    for (const m of cur) { const pay = 0.6; if (L.wealth > pay + 8) { L.wealth -= pay; m.wealth += pay; bump(m, L, 0.02); } else if (rnd(S) < 0.2) m.patron = null; }
  }
  // patrons and clients: the rich feed the hungry and collect obligation
  if (seasonOf(S.tick) === 0 || g.treasury < n * 2) {
    const rich = mem.filter(m => m.wealth > 20 && m.coop > 0.25).sort((a, b) => b.wealth - a.wealth);
    if (rich.length) for (const m of mem) {
      if (m.wealth > 0.5 || m.patron) continue;
      const pt = rich.find(r => r !== m && r.wealth > 14); if (!pt) break;
      pt.wealth -= 3; m.wealth += 3; m.patron = pt.id; bump(m, pt, 0.25); bond(S, m, pt, 'debt', `${fem(pt, 'кормил', 'кормила')} семью в голод`, 0.5); bio(S, m, 'client', `В голод ${pt.name} кормит ${m.sex === 'f' ? 'её' : 'его'} семью: теперь ${m.sex === 'f' ? 'она' : 'он'} клиент ${pt.name}`); pt.status += 0.15; pt.rep = clamp((pt.rep || 0) + 0.04, -1, 1);
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
  if (!g.home && (n >= 6 || (n >= 5 && S.tick - g.founded > 720))) settle(S, g);
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
      if (ch.ambition > 0.6 && !bondOf(L, ch) && rnd(S) < 0.08) { const why = `${fem(ch, 'метит', 'метит')} на место вождя «${g.name}»`; bond(S, L, ch, 'rival', why, 0.5); bond(S, ch, L, 'rival', `${fem(L, 'держится', 'держится')} за власть в «${g.name}»`, 0.5); }
      const sup = cur.filter(m => m !== ch && m.patron !== L.id && ((m.trust[ch.id] || 0) - (m.trust[L.id] || 0) + 0.6 * m.res - 0.3 + (kin(m, ch) || m.patron === ch.id ? 0.5 : 0) - (kin(m, L) ? 0.5 : 0) + bondW(m, ch) - bondW(m, L)) > 0);
      const frac = sup.length / Math.max(1, cur.length - 1), rets = cur.filter(m => m.patron === L.id).length / Math.max(1, cur.length);
      if (frac > (g.gov === 'assembly' ? 0.6 : 0.5) + 0.45 * rets && n >= 4 && S.tick > (g.coupCool || 0) && rnd(S) < (0.14 * ch.ambition + 0.03) * (g.gov === 'assembly' ? 0.5 : 1) / (1 + Math.min(2, (S.tick - (g.since || 0)) / 3600))) { coup(S, g, L, ch, sup, cur, grievances(S, g, L, ch, sup, n) + ` Его поддерживает ${P0(frac)} группы.`); return; }
      if (frac > 0.2 && sup.length >= 3 && sup.reduce((s, m) => s + m.res, 0) / sup.length > 0.32 && n >= 8 && rnd(S) < (0.1 * ch.ambition + 0.02) * (0.3 + 0.7 * room) * fissionP(S, g)) {
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
        S.hostility[key(g.id, ng.id)] = 0.6; bump(ch, L, -0.5); bump(L, ch, -0.5); bond(S, L, ch, 'enemy', `${fem(ch, 'расколол', 'расколола')} «${g.name}» и ${fem(ch, 'увёл', 'увела')} людей`, 0.6); S.stats.schisms++;
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
      bio(S, m, 'quit', `Уходит из «${g.name}»: не ладит с вождём ${L.name}`); bond(S, m, L, 'rival', `не поладили в «${g.name}»`, 0.4); (m.quit = m.quit || {})[g.id] = S.tick;
      gone.push(m.id); leave(S, m, 'move'); exits++; if (g.dead) return;
      const sp = m.spouse && S._a.get(m.spouse); if (sp && sp.group === g.id && sp.id !== g.leader && rnd(S) < 0.75) { bio(S, sp, 'quit', `Уходит из «${g.name}» вслед за ${sp.sex === 'f' ? 'мужем' : 'женой'}`); (sp.quit = sp.quit || {})[g.id] = S.tick; leave(S, sp, 'move'); exits++; if (g.dead) return; }
    } else if ((m.rep || 0) < -0.45 && L.coop > 0.35 && S.tick - (m.joined || 0) > 360 && bondW(L, m) < 0.2 && rnd(S) < 0.15) { bond(S, m, L, 'enemy', `${fem(L, 'изгнал', 'изгнала')} меня из «${g.name}»`, 0.5); bio(S, m, 'exiled', `${m.sex === 'f' ? 'Изгнана' : 'Изгнан'} из «${g.name}»: дурная слава`); m.exiledFrom = g.id; (m.exiled = m.exiled || {})[g.id] = S.tick; leave(S, m, 'move'); m.x += 40; S.stats.exiles = (S.stats.exiles || 0) + 1; if (g.dead) return; }
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
  bond(S, L, ch, 'enemy', `${fem(ch, 'сверг', 'свергла')} меня с места вождя «${g.name}»`, 0.9);
  for (const o of S.agents) if ((o.mother === L.id || o.father === L.id) && o.group === g.id && o.age >= 15) bond(S, o, ch, 'enemy', `${fem(ch, 'сверг', 'свергла')} ${fem(L, 'отца', 'мать')}`, 0.6);
  for (const m of sup) if (bondW(m, L) > 0.15 || bondW(L, m) > 0.15) bond(S, L, m, 'enemy', `${fem(m, 'поддержал', 'поддержала')} переворот против меня`, 0.6);
  bio(S, ch, 'coup', `Поднимает переворот и свергает ${L.name}`); bio(S, L, 'deposed', `${L.sex === 'f' ? 'Свергнута' : 'Свергнут'}: власть в «${g.name}» берёт ${ch.name}`); ch.bioL = g.id; bio(S, ch, 'leader', `Становится вождём «${g.name}»`);
  setLeader(S, g, ch); g.gen++; g.coupCool = S.tick + 1800; g.legit = clamp(sup.length / Math.max(1, cur.length), 0.2, 1); S.stats.coups++;
  bump(L, ch, -0.7); bump(ch, L, -0.3);
  ch.rep = clamp((ch.rep || 0) + ((L.rep || 0) < -0.25 ? 0.15 : -0.12), -1, 1);
  for (const m of sup) { m.res *= 0.4; bump(m, ch, 0.2); }
  const loyal = cur.filter(m => m !== ch && (m.trust[L.id] || 0) > (m.trust[ch.id] || 0));
  for (const m of loyal) bump(m, ch, -0.2);
  if (L.ambition > 0.55 && loyal.length >= 4 && rnd(S) < 0.6 * Math.min(1, 0.3 + fissionP(S, g))) {
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

