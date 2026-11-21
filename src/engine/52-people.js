/* ---------- people: kin, families, children, plague, culture ---------- */
function kin(a, b) {
  if (!a || !b || a === b) return false;
  return a.spouse === b.id || a.mother === b.id || a.father === b.id || b.mother === a.id || b.father === a.id || (!!a.mother && a.mother === b.mother) || (!!a.father && a.father === b.father);
}
function popOf(S) { return S.agents.length + (S.kids ? S.kids.length : 0); }
function kidsOf(S, a) { let n = 0; for (const k of S.kids || []) if (k.mo === a.id || k.fa === a.id) n++; return n; }
function cdist(A, B) {
  return (A.faith && B.faith && A.faith !== B.faith ? 0.3 : 0) + ((A.gov || 'chief') !== (B.gov || 'chief') ? 0.2 : 0) + ((A.land || 'common') !== (B.land || 'common') ? 0.15 : 0) + (!!A.coin !== !!B.coin ? 0.1 : 0) + Math.abs(A.norm - B.norm) * 0.5;
}
function families(S) {
  S.kids = S.kids || [];
  const pop = popOf(S), crowd = pop > 650 ? 0.25 : pop > 520 ? 0.6 : 1;
  // marriages
  const singles = S.agents.filter(a => !a.spouse && a.age >= 17 && a.age < 52);
  const men = singles.filter(a => a.sex === 'm');
  for (const f of singles) {
    if (f.sex !== 'f' || f.spouse || rnd(S) > 0.14 || !men.length) continue;
    let best = null, bv = -9;
    for (let t = 0; t < 10; t++) {
      const m = men[Math.floor(rnd(S) * men.length)];
      if (m.spouse || Math.abs(m.age - f.age) > 14 || kin(m, f)) continue;
      const d = Math.hypot(m.x - f.x, m.y - f.y), gm = S._g.get(m.group), gf = S._g.get(f.group);
      if (m.group !== f.group && d > 320) continue;
      const v = (m.group && m.group === f.group ? 0.8 : 0) + (f.trust[m.id] || 0) + bondW(f, m) + Math.min(0, bondW(S._a.get(f.father), m), bondW(S._a.get(f.mother), m)) + 0.3 * (m.rep || 0) + 0.02 * m.status + matchPull(S, f, m) - d / 600 - (gm && gf && gm !== gf ? cdist(gm, gf) * 0.6 : 0);
      if (v > bv) { bv = v; best = m; }
    }
    if (!best || bv < -0.4) continue;
    const gf0 = S._g.get(f.group), gm0 = S._g.get(best.group), hh = gf0 && gm0 && gf0 !== gm0 ? (S.hostility[key(gf0.id, gm0.id)] || 0) : 0;
    if (hh > 0.55) { if (f.trust[best.id] !== undefined && (f.trust[best.id] || 0) > -0.1 && f.age < 32 && best.age < 36 && f.role !== 'leader' && best.role !== 'leader' && rnd(S) < 0.35) elope(S, f, best); continue; }
    marry(S, f, best);
  }
  // births
  for (const a of S.agents) {
    if (a.sex !== 'f' || !a.spouse || a.age < 17 || a.age > 42) continue;
    if (S.tick - (a.lastBirth || -1e9) < 450) continue;
    const h = S._a.get(a.spouse); if (!h) { a.spouse = null; continue; }
    const g = S._g.get(a.group), store = g ? g.treasury / Math.max(1, g.members.length) : 1;
    const fert = clamp((a.wealth + h.wealth * 0.5 + store) / 8, 0.04, 1.6) * (a.wealth < 0.5 && store < 1 ? 0.25 : 1) * (g && g.home ? 1 : 0.55) * crowd * (g && g.sick ? 0.4 : 1);
    if (rnd(S) < 0.034 * fert) { const sx = rnd(S) < 0.5 ? 'f' : 'm'; S.kids.push({ t: S.tick, mo: a.id, fa: h.id, g: a.group, sex: sx, x: a.x, y: a.y }); a.lastBirth = S.tick; S.stats.births = (S.stats.births || 0) + 1; const tx = sx === 'f' ? 'Рождается дочь' : 'Рождается сын'; bio(S, a, 'child', tx); bio(S, h, 'child', tx); }
  }
  // children: cost, mortality, growing up
  const keep = [];
  for (const k of S.kids) {
    const mo = S._a.get(k.mo), fa = S._a.get(k.fa);
    let carer = mo || fa;
    if (!carer && S.tick % 90 === 0) { const sib = S.agents.find(o => (k.mo && o.mother === k.mo) || (k.fa && o.father === k.fa)); if (sib) { k.mo = sib.id; k.fa = sib.spouse || null; carer = sib; } }
    if (carer) { k.g = carer.group; k.x = carer.x; k.y = carer.y; }
    const g = S._g.get(k.g);
    let hungry = false;
    if (g && g.home && g.treasury > g.members.length * 1.5) g.treasury -= 0.33;
    else if (carer && carer.wealth > 0.5) carer.wealth -= 0.33;
    else if (g && g.treasury > 1) g.treasury -= 0.33;
    else hungry = true;
    const age = (S.tick - k.t) / 360;
    let pd = (age < 1 ? 0.013 : age < 5 ? 0.0035 : 0.0006) * (1 + 1.2 * ((g && g.dirty) || 0)) + (g && g.thirst ? 0.03 : 0) + (hungry ? (age < 5 ? 0.012 : 0.005) : 0) + (!carer ? 0.006 : 0) + (g && g.sick ? 0.04 : 0) + (g && g.home ? 0 : 0.0015);
    if (rnd(S) < pd) { S.stats.childDeaths = (S.stats.childDeaths || 0) + 1; const tx = `Умирает ${k.sex === 'f' ? 'дочь' : 'сын'}${age < 1 ? ' во младенчестве' : `, ${Math.floor(age)} ${pl(Math.floor(age), 'год', 'года', 'лет')}`}${g && g.sick ? ', от мора' : hungry ? ', от голода' : ''}`; if (mo) bio(S, mo, 'childDied', tx); if (fa) bio(S, fa, 'childDied', tx); continue; }
    if (age >= 15) { growUp(S, k, mo, fa, g); continue; }
    keep.push(k);
  }
  S.kids = keep;
}
function marry(S, f, m) {
  f.spouse = m.id; m.spouse = f.id; bump(f, m, 0.5); bump(m, f, 0.5);
  // the wedding is an event: the couple's house, the spurned suitor's grudge and an alliance of villages point to it
  const wev = note(S, 'marriage', `Свадьба: ${f.name} и ${m.name}`, f.x, f.y, (S._g.get(m.group) || {}).hue || 0, { who: [f.id, m.id], gs: [f.group, m.group].filter(Boolean) }).id; f.marryEv = m.marryEv = cite(S, wev);
  weddingFeast(S, f, m, wev);
  matchWedding(S, f, m, wev);
  bio(S, f, 'marry', `Выходит замуж за ${m.name}${m.group && m.group !== f.group ? ` из «${groupName(S, m.group)}»` : ''}`, wev); bio(S, m, 'marry', `Женится на ${f.name}${f.group && f.group !== m.group ? ` из «${groupName(S, f.group)}»` : ''}`, wev);
  S.stats.marriages = (S.stats.marriages || 0) + 1;
  // the one who hoped for her: a spurned suitor turns rival to the groom
  let sp = null, sv = 0.35;
  for (const o of S.agents) if (o !== m && o.sex === 'm' && !o.spouse && o.age >= 17 && o.group === f.group && (o.trust[f.id] || 0) > sv && !kin(o, f)) { sv = o.trust[f.id]; sp = o; }
  if (sp) { bond(S, sp, f, 'love', `любит без ответа: ${f.name} выходит за другого`, 0.5, false, wev); bond(S, sp, m, 'rival', `${fem(m, 'женился', 'вышла')} на ${f.name}`, 0.6, false, wev); }
  const gf = S._g.get(f.group), gm = S._g.get(m.group);
  if (gf === gm) return;
  // wife moves to husband's side, unless she leads
  if (gm && f.role !== 'leader') join(S, f, gm, m.id);
  else if (gf && m.role !== 'leader') join(S, m, gf, f.id);
  if (!gf || !gm || gf.dead || gm.dead) return;
  const LF = S._a.get(gf.leader), LM = S._a.get(gm.leader);
  const royal = x => x && (x.role === 'leader' || (LF && (x.mother === LF.id || x.father === LF.id)) || (LM && (x.mother === LM.id || x.father === LM.id)));
  const k = key(gf.id, gm.id);
  S.hostility[k] = (S.hostility[k] || 0) * (royal(f) || royal(m) ? 0.4 : 0.85);
  if (LF && LM) { bump(LF, LM, royal(f) || royal(m) ? 0.3 : 0.05); bump(LM, LF, royal(f) || royal(m) ? 0.3 : 0.05); }
  S.kinTies = S.kinTies || {}; S.kinTies[k] = (S.kinTies[k] || 0) + 1;
  if ((royal(f) || royal(m)) && gf.home && gm.home && (S.marLog || {})[k] === undefined || ((royal(f) || royal(m)) && S.tick - ((S.marLog || {})[k] || 0) > 360 * 6)) {
    S.marLog = S.marLog || {}; S.marLog[k] = S.tick;
    const al = allied(S, gf.id, gm.id);
    if (!al && (S.hostility[k] || 0) < 0.5) S.alliances.push({ a: gf.id, b: gm.id, since: S.tick, kin: true });
    const firstM = !S.firstMarriage; S.firstMarriage = true;
    log(S, 'marriage', `${firstM ? 'Первый в мире брачный союз' : 'Брачный союз'}: ${f.name} из «${gf.name}» выходит за ${m.name} из «${gm.name}»`, (gf.cx + gm.cx) / 2, (gf.cy + gm.cy) / 2, gm.hue, { why: sent([`${royal(f) && f.role !== 'leader' && (f.mother === (LF && LF.id) || f.father === (LF && LF.id)) ? `${f.name} — дочь вождя ${LF.name}` : royal(m) && m.role !== 'leader' ? `${m.name} — сын вождя ${LM ? LM.name : ''}` : 'жених или невеста из правящей семьи'}`, 'родство между правящими домами гасит вражду: вожди теперь доверяют друг другу больше', al ? 'союз деревень скреплён кровью' : 'деревни заключают союз', `всего браков между ними: ${S.kinTies[k]}`]), who: [f.id, m.id], gs: [gf.id, gm.id], first: firstM, causes: [wev] });
  }
}
function growUp(S, k, mo, fa, g) {
  const p = mo || fa;
  const a = spawn(S, 'child', { parent: p, mother: mo, father: fa, g, x: k.x, y: k.y });
  a.sex = k.sex; a.bornT = k.t;
  const par = [S._a.get(k.mo0 || k.mo), S._a.get(k.fa)].filter(Boolean);
  a.bio = [[k.t, 'born', `Рождается${g ? ` в «${g.name}»` : ' в пути'}${mo || fa ? `, ${a.sex === 'f' ? 'дочь' : 'сын'} ${[mo, fa].filter(Boolean).map(x => x.name).join(' и ')}` : ''}`]]; a.drama = 1;
  if (!mo && !fa) bio(S, a, 'orphan', 'Растёт сиротой: родителей уже нет в живых');
  if (k.plagueOrphan) bio(S, a, 'orphan', 'Родители умерли в мор');
  for (const o of S.agents) if (o !== a && ((a.mother && o.mother === a.mother) || (a.father && o.father === a.father))) { a.trust[o.id] = 0.4; o.trust[a.id] = 0.4; }
  inheritBonds(S, a, par);
  childhoodFriend(S, a);
}
function plagueMonth(S) {
  const sick = S.groups.filter(g => g.sick > 0);
  if (!sick.length) return;
  for (const g of sick) {
    let dead = 0;
    for (const id of g.members.slice()) { const m = S._a.get(id); if (!m) continue; if (rnd(S) < 0.04 * (m.age > 50 ? 1.8 : 1) * (m.energy < 0.4 ? 1.4 : 1)) { removeAgent(S, m, 'plague'); dead++; } }
    for (const n of S.agents) if (!n.group && Math.hypot(n.x - g.cx, n.y - g.cy) < 160 && rnd(S) < 0.03) { removeAgent(S, n, 'plague'); dead++; }
    g.plDead = (g.plDead || 0) + dead; S.plague.dead += dead;
    g.sick--;
    if (g.dead) continue;
    for (const o of S.groups) {
      if (o === g || o.sick > 0 || !o.home || !g.home || (o.immune || 0) > S.tick) continue;
      const d = Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y), link = S.routes[key(o.id, g.id)] || (g.state && g.state === o.state) || allied(S, g.id, o.id);
      if ((d < 260 || link) && rnd(S) < (link ? 0.3 : 0.18) * (d < 260 ? 1 : 0.7)) { o.sick = 3 + Math.floor(rnd(S) * 4); o.plStart = S.tick; o.plPop = o.members.length; o.plDead = 0; S.plague.hit.push(o.id); }
    }
    if (g.sick <= 0) {
      g.immune = S.tick + 360 * 18; g.scarce = S.tick + 360 * 8;
      const share = g.plDead / Math.max(1, g.plPop);
      if (share >= 0.12 && g.members.length) {
        for (const id of g.members) bio(S, S._a.get(id), 'plague', `Переживает мор: в «${g.name}» умерли ${g.plDead} из ${g.plPop}`);
        for (const id of g.members) { const m = S._a.get(id); if (m && m.debt) { m.debt *= 0.4; if (m.bond && m.debt < 8) m.bond = false; } }
        log(S, 'plagueEnd', `Мор отступает от «${g.name}»: умерли ${g.plDead} из ${g.plPop}`, g.home.x, g.home.y, g.hue, { why: sent([`выжившим не хватает рук: поля стоят, а каждый работник теперь на счету`, 'простые люди требуют больших долей, и вождю приходится уступать', g.members.some(id => (S._a.get(id) || {}).debt) ? 'долги полегчали: многих кредиторов не стало' : '']), gs: [g.id] });
      }
    }
  }
  if (!S.groups.some(g => g.sick > 0)) {
    const p = S.plague;
    if (p.dead >= 6) log(S, 'plague', `Мор закончился: за ${yrs(Math.max(1, Math.round((S.tick - p.t) / 360)))} он прошёл через ${p.hit.length} ${pl(p.hit.length, 'деревню', 'деревни', 'деревень')} и унёс ${p.dead} ${pl(p.dead, 'жизнь', 'жизни', 'жизней')}`, undefined, undefined, 0, { why: 'Зараза шла по торговым дорогам и от деревни к соседке. Где умерли многие, выжившие стали дороже: доля вождя падает, долги прощаются.' });
    S.plague = null;
  }
}
function plagueYear(S) {
  if (S.plague) return;
  const pop = popOf(S), nr = Object.keys(S.routes).length;
  const p = 0.008 + 0.035 * clamp((pop - 160) / 320, 0, 1) + 0.01 * Math.min(1, nr / 10);
  if (rnd(S) > p) return;
  const vs = S.groups.filter(g => g.home && g.members.length >= 6 && (g.immune || 0) < S.tick);
  if (!vs.length) return;
  let tot = 0; const w = vs.map(g => { const v = (g.members.length + (g.trades || 0) * 0.2) * (1 + 2 * (g.dirty || 0)); tot += v; return v; });
  let r = rnd(S) * tot, g = vs[0]; for (let i = 0; i < vs.length; i++) { r -= w[i]; if (r <= 0) { g = vs[i]; break; } }
  g.sick = 4 + Math.floor(rnd(S) * 4); g.plStart = S.tick; g.plPop = g.members.length; g.plDead = 0;
  S.plague = { t: S.tick, dead: 0, hit: [g.id], from: g.id };
  S.stats.plagues = (S.stats.plagues || 0) + 1;
  log(S, 'plague', `Мор в «${g.name}»`, g.home.x, g.home.y, 0, { why: sent([`в мире ${pop} ${pl(pop, 'человек', 'человека', 'человек')}: чем теснее живут, тем легче заразе`, nr ? `${nr} ${pl(nr, 'торговая дорога', 'торговые дороги', 'торговых дорог')} разнесут её дальше` : '', `«${g.name}» — ${g.members.length} ${pl(g.members.length, 'человек', 'человека', 'человек')}${g.trades ? ` и ${g.trades} ${pl(g.trades, 'сделка', 'сделки', 'сделок')}` : ''}`]), gs: [g.id] });
}
function roomYear(S) {
  if (!S.own) return;
  for (const g of S.groups) {
    if (!g.home) continue;
    const hx = Math.floor(g.home.x / CS), hy = Math.floor(g.home.y / CS); let free = 0;
    for (let dy = -15; dy <= 15; dy++) for (let dx = -15; dx <= 15; dx++) {
      const x = hx + dx, y = hy + dy; if (x < 0 || y < 0 || x >= N || y >= N || dx * dx + dy * dy > 225) continue;
      const c = y * N + x; if (S.ter[c] === 'w' || S.ter[c] === 'h' || S.ter[c] === 's' || S.own[c] || S.occ[c]) continue; free++;
    }
    g.room = clamp((free - 40) / 160, 0, 1);
    let ps = 0, pn = 0; for (const o of S.groups) if (o !== g && o.home && Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y) < 400) { ps += o.pay * o.members.length; pn += o.members.length; }
    g.nbPay = pn ? ps / pn : g.pay;
  }
}
function imNote(S, g) {
  if (!g.imFrom) return;
  const e = S.events[0];
  if (e) { e.text += ` по примеру «${g.imFrom}»`; e.why = (e.why || '') + ` Это подражание, а не изобретение: «${g.imFrom}» рядом, многолюднее или богаче, и в «${g.name}» хотят жить так же.`; }
  g.imFrom = null;
}
function imitP(S, g, has, linkOnly) {
  if (!g.home) return { p: 0, from: null };
  let p = 0, from = null, fv = 0, cn = 0, cy = 0;
  for (const o of S.groups) {
    if (o === g || !o.home || o.dead) continue;
    const d = Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y), link = S.routes[key(o.id, g.id)] || allied(S, o.id, g.id) || g.lord === o.id || (S.kinTies || {})[key(o.id, g.id)];
    if ((d > 380 || linkOnly) && !link) continue;
    cn++;
    if (!has(o)) continue;
    cy++;
    const pr = Math.sqrt(Math.max(0.2, o.members.length / Math.max(1, g.members.length))) * Math.sqrt(Math.max(0.2, (o.pay + 0.5) / (g.pay + 0.5)));
    const v = Math.min(1.6, pr) * (link ? 1.5 : 0.7);
    p += v; if (v > fv) { fv = v; from = o; }
  }
  const conform = cn ? cy / cn : 0;
  return { p: 0.012 * p * (0.6 + conform), from };
}

