/* ---------- rites: a wedding feast, a funeral to the burial ground, the harvest festival ---------- */
// S.rites: gatherings the map shows for a few days [{ kind, x, y, t, until, g }]; g.cemetery = { x, y, graves }
function gathering(S, kind, x, y, days, gid) {
  (S.rites || (S.rites = [])).push({ kind, x, y, t: S.tick, until: S.tick + days, g: gid });
  if (S.rites.length > 40) S.rites.shift();
}
function cemeteryOf(S, g) {
  if (g.cemetery) return g.cemetery;
  const p = specialSpot(S, g, 'cemetery'); if (!p) return null;
  g.cemetery = { x: p.x, y: p.y, graves: 0 };
  log(S, 'rite', `У «${g.name}» появляется кладбище`, p.x, p.y, g.hue, { rite: 'cemetery', why: 'умерших теперь хоронят в одном месте, на окраине деревни, в стороне от улицы', gs: [g.id] });
  return g.cemetery;
}
// the wedding: kin gather at the groom's house, the families and the village spend on a feast, the two kins draw closer
function weddingFeast(S, f, m, wev) {
  const gm = S._g.get(m.group), gf = S._g.get(f.group), g = gm && gm.home ? gm : gf && gf.home ? gf : null;
  if (!g) return;
  const cost = Math.min(g.treasury * 0.04, 2 + 0.15 * g.members.length); g.treasury -= cost;
  const side = p => S.agents.filter(o => o !== f && o !== m && o.group === g.id && kin(o, p));
  const fk = side(f), mk = side(m);
  for (const a of fk.slice(0, 6)) for (const b of mk.slice(0, 6)) { bump(a, b, 0.04); bump(b, a, 0.04); }
  const h = houseOf(g, m.house) || houseOf(g, f.house) || g.home;
  for (const o of fk.concat(mk).slice(0, 12)) o.rite = { x: h.x, y: h.y, until: S.tick + 2 };
  gathering(S, 'wedding', h.x, h.y, 3, g.id);
  S.stats.weddings = (S.stats.weddings || 0) + 1;
  const L = S._a.get(g.leader), notable = L && (L === m || L === f || kin(L, m) || kin(L, f));
  if (notable) log(S, 'rite', `Свадьба ${nameCase(m, 'genitive')} и ${nameCase(f, 'genitive')} в «${g.name}»: пир у дома ${nameCase(m, 'genitive')}`, h.x, h.y, g.hue, { rite: 'wedding', why: sent([L === m || L === f ? 'женится сам вождь' : `${kin(L, m) ? m.name : f.name} — родня вождя ${nameCase(L, 'genitive')}`, `на пир уходит ${qty(cost, 'food')}`, 'роды жениха и невесты теперь ближе друг к другу']), who: [m.id, f.id, L.id], gs: [g.id], causes: wev ? [wev] : undefined });
}
// a funeral: kin walk to the burial ground; the grave stays; the leader's funeral is the whole village's
function funeral(S, a, why) {
  const g = a.group && S._g.get(a.group);
  if (!g || !g.home || why === 'lostAtSea' || why === 'move' || why === 'emigr') return null;
  const cem = cemeteryOf(S, g); if (!cem) return null;
  cem.graves++; burialPlot(S, g, a);
  const mourners = S.agents.filter(o => o !== a && o.group === g.id && (o.id === a.spouse || o.mother === a.id || o.father === a.id || o.id === a.mother || o.id === a.father));
  for (const o of mourners) { o.rite = { x: cem.x, y: cem.y, until: S.tick + 3 }; for (const p of mourners) if (p !== o) bump(o, p, 0.03); }
  gathering(S, 'funeral', cem.x, cem.y, 3, g.id);
  S.stats.funerals = (S.stats.funerals || 0) + 1;
  const isL = g.leader === a.id;
  const ex = { who: [a.id, ...mourners.map(o => o.id)].slice(0, 8), gs: [g.id], rite: 'funeral' };
  const text = isL ? `Вся «${g.name}» провожает ${fem(a, 'вождя', 'вождя')} ${nameCase(a, 'accusative')} на кладбище` : `Похороны ${nameCase(a, 'genitive')} в «${g.name}»`;
  const ev = isL ? log(S, 'rite', text, cem.x, cem.y, g.hue, Object.assign({ why: sent([`${a.name} ${fem(a, 'правил', 'правила')} «${g.name}» ${yrs(Math.max(1, Math.round((S.tick - (g.since || g.founded)) / 360)))}`, mourners.length ? `за гробом идут ${mourners.map(o => o.name).slice(0, 4).join(', ')}` : '', `на кладбище «${g.name}» уже ${cem.graves} ${pl(cem.graves, 'могила', 'могилы', 'могил')}`]) }, ex)) : note(S, 'rite', text, cem.x, cem.y, g.hue, ex);
  if (isL) rulerMound(S, g, a, ev.id);
  return ev.id;
}
// the harvest festival at the end of autumn, on the village's own day (monthDays): a village with stores feasts together; a rich leader who hosts gains renown
function harvestFeast(S, g) {
  {
    if (!g.home || g.dead || g.members.length < 5) return;
    const n = g.members.length, L = S._a.get(g.leader); if (!L) return;
    const host = L.wealth > 20 + n * 0.3;
    if (!host && g.treasury < n * 3) return;
    if (host) { L.wealth -= n * 0.3; L.status += 1.5; L.rep = clamp((L.rep || 0) + 0.05, -1, 1); } else g.treasury -= n * 0.4;
    const mem = g.members.map(id => S._a.get(id)).filter(Boolean);
    for (let i = 0; i < mem.length; i++) { const a = mem[i], b = mem[(i + 1) % mem.length]; bump(a, b, 0.03); bump(b, a, 0.03); if (host && a !== L) bump(a, L, 0.04); }
    gathering(S, 'feast', g.home.x, g.home.y, 3, g.id);
    S.stats.festivals = (S.stats.festivals || 0) + 1;
    // К1: at the feast the old tell the heaviest memory again
    const told = (g.mem || []).slice().sort((p, q) => q.w - p.w)[0]; if (told) told.w = Math.min(told.w0, told.w + 0.02);
    g.fests = (g.fests || 0) + 1;
    const text = host ? `Праздник урожая в «${g.name}»: ${L.name} ${fem(L, 'угощает', 'угощает')} всю деревню` : `Праздник урожая в «${g.name}»`;
    const ex = { rite: 'feast', host: host ? L.id : undefined, why: sent([host ? `${L.name} ${fem(L, 'выставляет', 'выставляет')} на пир своё зерно, и слава ${fem(L, 'его', 'её')} растёт` : `запасов хватает до весны, и деревня собирается на пир`, 'соседи сидят за одним столом, и обиды до весны забываются']), who: host ? [L.id] : [], gs: [g.id] };
    // the first festival of a village and a leader's feast go to the chronicle; ordinary years leave a quiet record
    if (g.fests === 1 || (host && S.tick - (g.feastLog || -1e9) > 360 * 5)) { log(S, 'rite', text, g.home.x, g.home.y, g.hue, ex); if (host) g.feastLog = S.tick; } else note(S, 'rite', text, g.home.x, g.home.y, g.hue, ex);
  }
}
