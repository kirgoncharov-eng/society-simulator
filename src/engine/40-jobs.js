const TITLE = { farm: 'мастер-земледелец', wood: 'мастер-лесоруб', build: 'мастер-строитель', stone: 'каменотёс', craft: 'мастер-ремесленник', gather: 'опытный охотник' };
const JOBX = ['farm', 'wood', 'build', 'stone', 'craft', 'gather'];
const jobSkill = (m, j) => m.skill * (1 + 0.6 * Math.min(1, (m.xp && m.xp[j]) || 0));
function jobs(S, g) {
  const mem = g.members.map(id => S._a.get(id)), n = mem.length, season = seasonOf(S.tick);
  const cap = g.houses.filter(h => !h.ruined).length * 4;
  // a roof is one's own house or a place in a kinsman's (see households); before the first month, the old rule
  if (g.home && g.wantH !== undefined) for (const m of mem) m.shel = !!m.house;
  else mem.slice().sort((a, b) => (b.role === 'leader') - (a.role === 'leader') || b.status - a.status).forEach((m, i) => { m.shel = i < cap; });
  if (!g.home) { for (const m of mem) m.job = 'gather'; return; }
  const wantH = g.wantH !== undefined ? Math.max(1, g.wantH) : Math.ceil(n / 4), wantF = Math.max(1, Math.ceil(n / 2.2));
  if (S.tick % 90 === 0 || g.woodCell === null || S.wood[g.woodCell] < 3) g.woodCell = nearestForest(S, g.home, g);
  if (S.tick % 360 === 0 || g.stoneDist === undefined) { const h = nearestHill(S, g.home, g); g.stoneCell = h.c; g.stoneDist = h.d; }
  const needWS = !g.workshop && g.stoneCell !== null && n >= 5 && g.houses.length >= 2;
  const needGR = !g.granary && g.treasury > n * 5 && n >= 4;
  const threat = threatOf(S, g); let site = null;
  g.threat = threat;
  // in a lean season the first thing to build is another field, not a house
  const lean0 = ((n <= 6 && g.treasury < n * 3) || g.treasury < n * 1.2) && season !== 0;
  if (!g.site && lean0 && g.fields.length < wantF) g.site = fieldSpot(S, g);
  if (!g.site) {
    if (threat > 0.6 && g.houses.length >= 3 && g.wood >= 8 && (site = wallSite(S, g)) && beginSite(S, g, site, site.wood)) {}
    else if (!g.shrine && n >= 7 && g.trauma > 0 && g.houses.length >= 2 && g.wood >= 8 && (site = specialSpot(S, g, 'shrine'))) beginSite(S, g, site, 8);
    else if (g.landing && (g.fboats || 0) < Math.ceil(n / 8) && g.houses.length >= 2 && g.wood >= 8 && n >= 4) {
      beginSite(S, g, { kind: 'fboat', x: g.landing.x, y: g.landing.y, prog: 0, need: 70 }, 8);
    } else if (g.houses.some(h => h.ruined) && livingHouses(g).length < wantH && g.wood >= 2) {
      const idx = g.houses.findIndex(h => h.ruined), hh = g.houses[idx];
      beginSite(S, g, { kind: 'repair', idx, x: hh.x, y: hh.y, angle: hh.angle, footprint: hh.footprint, prog: 0, need: 20 }, 2);
    } else if (!g.bridgeAt && n >= 8 && g.houses.length >= 3 && g.wood >= 12 && ((g.cross12 || 0) >= 10 || (g.drowned || 0) >= 1)
      && (site = bridgeSpot(S, g)) && beginSite(S, g, site, site.wood)) g.bridgeAt = -1;
    else if (g.houses.length < wantH && g.wood >= (g.workshop ? 5 : 6) && (site = houseSpot(S, g))) beginSite(S, g, site, g.workshop ? 5 : 6);
    // A wattle-and-earth house still needs a load of poles and longer work on site.
    else if (g.wood >= 1 && g.wood < 6 && livingHouses(g).length < wantH
      && (g.woodCell === null || livingHouses(g).length <= wantH - 2) && (site = houseSpot(S, g))) {
      beginSite(S, g, { ...site, need: 90, earth: true }, 1);
    } else if (g.fields.length < wantF && season !== 0 && (site = fieldSpot(S, g))) g.site = site;
    else if (needGR && g.wood >= 8 && (site = specialSpot(S, g, 'granary'))) beginSite(S, g, site, 8);
    else if (needWS && g.wood >= 4 && g.stone >= 4 && (site = specialSpot(S, g, 'workshop'))) beginSite(S, g, site, 4, 4);
  }
  const L = S._a.get(g.leader);
  const pool = mem.filter(m => !(m === L && n > 4) && !m.car && !m.war);
  if (L && n > 4) L.job = 'lead';
  const woodNeed = g.houses.length < wantH || (threat > 0.6 && g.houses.length >= 3 && !g.walls && g.wood < 20) || (needGR && g.wood < 8) || (needWS && g.wood < 4) || (g.workshop && g.wood < 6);
  const stoneNeed = g.stoneCell !== null && ((needWS && g.stone < 4) || (g.workshop && g.stone < 6));
  const lean = lean0;
  const quota = {
    build: g.site ? (lean && g.site.kind !== 'field' && !(g.site.kind === 'house' && livingHouses(g).length < wantH * 0.67) ? 0 : Math.max(1, Math.round(n * 0.2))) : 0,
    wood: g.woodCell === null || lean ? 0 : woodNeed ? Math.max(1, Math.round(n * 0.2)) : (season === 0 ? 1 : 0),
    stone: stoneNeed ? Math.max(1, Math.round(n * 0.12)) : 0,
    craft: lean ? 0 : (g.workshop && g.wood >= 1 && g.stone >= 1 && g.tools < n * 1.2) || (n >= 5 && ((g.pots || 0) < n * 0.5 || ((g.goats || 0) >= 4 && (g.cloth || 0) < n * 0.6))) ? Math.max(1, Math.round(n * 0.1)) : 0,
    farm: farmQuota(season, g.fields.length, pool.length),
    pray: g.shrine ? 1 : 0,
    water: g.wNeed || 0,
    fish: g.fboats && g.landing ? Math.min(g.fboats * 2, Math.ceil(n * 0.3)) : 0,
    herd: (g.goats || 0) > 0 ? Math.max(1, Math.round(g.goats / 18)) : 0,
    guard: threat > 0.5 || S.tick - g.raided < 720 || g.lord ? Math.max(1, Math.round(n * (0.08 + 0.18 * Math.min(1.5, threat)))) : 0
  };
  const free = new Set(pool);
  const priorities = season === 3
    ? ['water', 'pray', 'guard', 'herd', 'fish', 'build', 'farm', 'craft', 'stone', 'wood']
    : ['water', 'pray', 'guard', 'herd', 'fish', 'craft', 'build', 'stone', 'wood', 'farm'];
  for (const job of priorities) {
    let q = Math.min(quota[job], free.size);
    if (!q) continue;
    const ranked = [...free].sort((a, b) => job === 'pray' ? (((b.xp.pray || 0) - (a.xp.pray || 0)) || (b.coop * (1 + b.status / 10) - a.coop * (1 + a.status / 10))) : (((b.xp[job] || 0) - (a.xp[job] || 0)) || a.id - b.id));
    let fi = 0;
    for (const m of ranked.slice(0, q)) { m.job = job; free.delete(m); if (job === 'farm') m.slot = fi++; }
    if (job === 'water') g.wGot = q;
  }
  if (!quota.water) g.wGot = 0;
  // the old who are not needed elsewhere sit by the house, mind the children and the garden
  for (const m of free) m.job = m.age > 62 && m.house ? 'home' : 'gather';
}

