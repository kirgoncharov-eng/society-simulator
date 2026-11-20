/* ---------- hamlets: loners, small bands and tiny villages drift into real villages ---------- */
// how many close kin (parents, children, siblings, spouse) of a live in village g
function kinIn(S, a, g) {
  let k = 0;
  for (const id of g.members) { const o = S._a.get(id); if (o && kin(o, a)) k++; }
  return k;
}
// a whole small group moves into a bigger village: people walk over, the old houses stand empty
function absorb(S, big, sm, keepLand) {
  const sL = S._a.get(sm.leader);
  if (S.arch && S.arch[sm.id]) S.arch[sm.id].into = big.id;
  if (keepLand && S.own) for (let c = 0; c < S.own.length; c++) if (S.own[c] === sm.id) S.own[c] = big.id;
  for (const id of sm.members) {
    const m = S._a.get(id); if (!m) continue;
    m.group = big.id; m.role = 'member'; m.boss = big.leader; m.joined = S.tick; m.war = null; m.job = null;
    big.members.push(id);
  }
  // the old fields close enough to walk to stay in use; empty houses are taken apart for timber
  if (sm.home && big.home) {
    const keep = sm.fields.filter(f => Math.hypot(f.x - big.home.x, f.y - big.home.y) < 280);
    for (const f of keep) { S.occ[f.c] = big.id; if (S.own) S.own[f.c] = big.id; f.owner = null; big.fields.push(f); }
    sm.fields = sm.fields.filter(f => !keep.includes(f));
    big.wood = (big.wood || 0) + sm.houses.length * 3; sm.houses = []; // taken apart: no ruin is left to lure the next band
  }
  big.treasury += sm.treasury; sm.treasury = 0; sm.members = [];
  big.wood = (big.wood || 0) + (sm.wood || 0); big.stone = (big.stone || 0) + (sm.stone || 0); big.tools = (big.tools || 0) + (sm.tools || 0); big.goats = (big.goats || 0) + (sm.goats || 0);
  sm.wood = sm.stone = sm.tools = sm.goats = 0;
  S.wars = S.wars.filter(w => w.att !== sm.id && w.def !== sm.id);
  dissolve(S, sm, true); restructure(S, big);
  if (sL) sL.status += 0.5;
  S.stats.merges++;
}
// the best village for a person or a small band to go to; null if none will take them
function hostFor(S, x, y, from, a, minN) {
  let best = null, bv = -1e9;
  for (const o of S.groups) {
    if (!o.home || o.dead || o === from || o.members.length < minN) continue;
    const d = Math.hypot(o.home.x - x, o.home.y - y); if (d > 520) continue;
    if (from && (S.hostility[key(from.id, o.id)] || 0) > 0.5) continue;
    if (a && a.exiledFrom === o.id) continue;
    const k = a ? kinIn(S, a, o) : from ? Math.min(4, (S.kinTies || {})[key(from.id, o.id)] || 0) : 0;
    const v = 3 * Math.min(3, k) + Math.min(4, o.treasury / Math.max(1, o.members.length)) * 0.5 + Math.min(20, o.members.length) * 0.1 - Math.max(0, o.members.length - 30) * 0.15 - d / 120 + (o.thirst ? -3 : 0);
    if (v > bv) { bv = v; best = { o, k, d }; }
  }
  return best && reach(S, x, y, best.o.home.x, best.o.home.y) ? best : null;
}
function hamletsMonth(S) {
  // loners look for a village: kin first, then any that will feed one more pair of hands
  for (const a of S.agents) {
    if (a.group || a.age < 16 || rnd(S) > 0.35) continue;
    const h = hostFor(S, a.x, a.y, null, a, 3); if (!h) continue;
    const L = S._a.get(h.o.leader); if (!L) continue;
    const p = (0.25 + 0.45 * L.coop + 0.2 * Math.min(2, h.k)) * ((a.rep || 0) < -0.3 ? 0.35 : 1);
    if (rnd(S) > p) continue;
    join(S, a, h.o, h.k ? h.o.members.map(id => S._a.get(id)).find(o => o && kin(o, a)).id : L.id);
    bio(S, a, 'move', h.k ? `Уходит жить к родне в «${h.o.name}»` : `Прибивается к «${h.o.name}»: одному не прожить`);
    S.stats.settledIn = (S.stats.settledIn || 0) + 1;
  }
  for (const g of S.groups.slice()) {
    if (g.dead) continue;
    const n = g.members.length, L = S._a.get(g.leader); if (!L) continue;
    const age = S.tick - g.founded;
    // a small band that has wandered a year joins a village instead of founding its own
    if (!g.home && n <= 4 && age > 360 && rnd(S) < 0.08) {
      const h = hostFor(S, g.cx, g.cy, g, null, 5); if (!h) continue;
      const HL = S._a.get(h.o.leader); if (!HL || rnd(S) > 0.3 + 0.5 * HL.coop) continue;
      for (const m of g.members.map(id => S._a.get(id))) if (m) bio(S, m, 'move', `Ватага «${g.name}» прибивается к «${h.o.name}»`);
      log(S, 'merge', `Ватага «${g.name}» (${n} ${pl(n, 'человек', 'человека', 'человек')}) прибивается к «${h.o.name}»`, g.cx, g.cy, h.o.hue, { why: sent([`${yrs(Math.round(age / 360))} кочевья, а людей так и не прибавилось`, 'чтобы поднять деревню, нужно хотя бы пять пар рук', h.k ? `в «${h.o.name}» у них родня` : `${HL.name} готов${HL.sex === 'f' ? 'а' : ''} принять работников`]), who: [L.id, HL.id], gs: [g.id, h.o.id] });
      absorb(S, h.o, g, false); continue;
    }
    // a hamlet of 2-4 grows, or moves into a neighbouring village: kin, safety, a shared well
    if (g.home && n < 5 && age > 720 && !S.wars.some(w => w.att === g.id || w.def === g.id)) {
      const h = hostFor(S, g.home.x, g.home.y, g, null, Math.max(5, n + 2)); if (!h || h.d > 380) continue;
      const HL = S._a.get(h.o.leader); if (!HL) continue;
      const threat = Math.min(1.5, g.threat || 0), noWell = !g.well && h.o.well && !h.o.well.dry, hungry = g.treasury < n * 1.5;
      const p = (0.025 + 0.03 * Math.min(3, h.k) + 0.04 * threat + (noWell ? 0.025 : 0) + (hungry ? 0.04 : 0) + (S.tick - g.raided < 720 ? 0.04 : 0)) * (1.2 - 0.6 * L.ambition) * (0.6 + 0.6 * HL.coop);
      if (rnd(S) > p) continue;
      const why = sent([`в «${g.name}» ${n} ${pl(n, 'взрослый', 'взрослых', 'взрослых')}: некому одновременно пахать, носить воду и стеречь`, h.k ? `с «${h.o.name}» их связывают браки: ${h.k} ${pl(h.k, 'семейная связь', 'семейные связи', 'семейных связей')}` : '', threat > 0.5 || S.tick - g.raided < 720 ? 'вокруг неспокойно, а за частоколом большой деревни безопаснее' : '', noWell ? `у «${h.o.name}» есть колодец` : '', hungry ? 'своих запасов не хватает' : '', `${L.name} соглашается стать простым общинником`]);
      for (const m of g.members.map(id => S._a.get(id))) if (m) bio(S, m, 'move', `Хутор «${g.name}» пустеет: семья перебирается в «${h.o.name}»`);
      log(S, 'merge', `Хутор «${g.name}» пустеет: ${n} ${pl(n, 'человек', 'человека', 'человек')} перебираются в «${h.o.name}»`, g.home.x, g.home.y, h.o.hue, { why, who: [L.id, HL.id], gs: [g.id, h.o.id] });
      absorb(S, h.o, g, false);
      continue;
    }
    // synoecism: a village under 15 grows together with a neighbour at least as big (but not into a giant), if marriages, an alliance or a common lord bind them
    if (g.home && n >= 5 && n < 15 && age > 360 * 5 && !S.wars.some(w => w.att === g.id || w.def === g.id) && rnd(S) < 0.25) {
      let best = null, bv = 0;
      for (const o of S.groups) {
        if (o === g || !o.home || o.dead || o.members.length < n || o.members.length + n > 36) continue;
        const d = Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y); if (d > 300) continue;
        const k = key(g.id, o.id); if ((S.hostility[k] || 0) > 0.4) continue;
        const ties = Math.min(3, (S.kinTies || {})[k] || 0), bond = allied(S, g.id, o.id) || (g.state && g.state === o.state) || g.lord === o.id;
        const v = 0.1 * ties + (bond ? 0.25 : 0) + 0.12 * Math.min(1.5, g.threat || 0) + (g.treasury < n * 1.5 ? 0.1 : 0) - d / 1500;
        if (v > bv) { bv = v; best = { o, ties, bond, d }; }
      }
      if (!best) continue;
      const OL = S._a.get(best.o.leader); if (!OL) continue;
      if (rnd(S) > bv * 0.12 * (1.3 - 0.9 * L.ambition) * (0.6 + 0.6 * OL.coop) || !reach(S, g.home.x, g.home.y, best.o.home.x, best.o.home.y)) continue;
      const { o } = best, nb = o.members.length;
      const why = sent([`«${g.name}» (${n}) стоит в ${cells(best.d)} от «${o.name}» (${nb}): поля уже сходятся`, best.ties ? `между деревнями ${best.ties} ${pl(best.ties, 'брак', 'брака', 'браков')}` : '', best.bond ? (g.lord === o.id ? `«${g.name}» и так платит «${o.name}» дань` : 'деревни давно в союзе') : '', (g.threat || 0) > 0.5 ? 'вместе легче отбиться от набегов' : '', `${L.name} соглашается войти в совет «${o.name}»`]);
      for (const m of g.members.map(id => S._a.get(id))) if (m) bio(S, m, 'move', `«${g.name}» сливается с «${o.name}»`);
      log(S, 'merge', `«${g.name}» сливается с «${o.name}»: теперь там ${n + nb} человек`, g.home.x, g.home.y, o.hue, { why, who: [L.id, OL.id], gs: [g.id, o.id] });
      absorb(S, o, g, true);
    }
  }
}
