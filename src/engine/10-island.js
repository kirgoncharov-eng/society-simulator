function beachSpot(S, avoid) {
  const B = []; for (let c = 0; c < N * N; c++) if (S.ter[c] === 'b') B.push(c);
  let best = null, bv = -1e9;
  for (let t = 0; t < 30 && B.length; t++) { const c = B[Math.floor(rnd(S) * B.length)], x = (c % N) * CS + 10, y = ((c / N) | 0) * CS + 10; let v = rnd(S) * 50; if (avoid) for (const g of S.groups) if (g.home) v += Math.min(200, Math.hypot(g.home.x - x, g.home.y - y)) / 4; if (v > bv) { bv = v; best = { c, x, y }; } }
  return best;
}
function landBoat(S, size, first) {
  const b = beachSpot(S, first); if (!b) return;
  const ix = S.isle ? S.isle.x : 500, iy = S.isle ? S.isle.y : 500, d = Math.hypot(b.x - ix, b.y - iy) || 1, ux = (b.x - ix) / d, uy = (b.y - iy) / d;
  const band = spawnBand(S, size, b.x - ux * 10, b.y - uy * 10, first ? 12 : 8);
  const g = band.length && S._g.get(band[0].group); if (g) { g.treasury = band.length * 9; g.goats = 2 + Math.floor(rnd(S) * 3); }
  for (const a of band) { a.bio = [[S.tick, 'born', first ? 'Среди первых приплывает на остров' : 'Приплывает на остров из-за моря']]; a.drama = 1; }
  S.boats = S.boats || []; S.boats.push({ x0: b.x + ux * 140, y0: b.y + uy * 140, x1: b.x + ux * 8, y1: b.y + uy * 8, t: S.tick, out: false });
  if (S.boats.length > 30) S.boats.shift();
  S.stats.arrived = (S.stats.arrived || 0) + band.length;
  const firstEver = !S.firstBoat; S.firstBoat = true;
  log(S, 'boat', firstEver ? `Первая лодка пристаёт к острову: ${band.length} ${pl(band.length, 'человек', 'человека', 'человек')}` : `К берегу пристаёт лодка: ${band.length} ${pl(band.length, 'человек', 'человека', 'человек')} из-за моря`, b.x, b.y, g ? g.hue : 200, { first: firstEver, why: sent([first ? 'остров пуст: ни домов, ни троп' : `на острове уже ${popOf(S) - band.length} ${pl(popOf(S) - band.length, 'человек', 'человека', 'человек')}`, 'в лодке одна семья или род: родители, дети, братья и сёстры', 'с собой немного зерна на первое время, а дальше — как сложится', !first ? 'новички будут искать свободную землю у воды или проситься к соседям' : '']), who: band.map(a => a.id), gs: g ? [g.id] : [] });
}
function sectorOf(S, x, y) { return ((Math.round((Math.atan2(y - S.isle.y, x - S.isle.x) + Math.PI) / (2 * Math.PI) * 12)) % 12 + 12) % 12; }
function homeEconomy(S, g, mem) {
  const seas = seasonOf(S.tick), dry = S.tick < (S.drought || 0), n = mem.length;
  if (S.tick % 360 === 30 || g.landing === undefined) { const b = beachNear(S, g.home.x, g.home.y, 170); g.landing = b || null; }
  if (!g.pasture || S.tick % 1800 === 0) { let best = null, bv = -1e9; for (let t = 0; t < 14; t++) { const a = t * 0.45 + g.id, r = 50 + (t % 3) * 25, x = g.home.x + Math.cos(a) * r, y = g.home.y + Math.sin(a) * r, c = cellAt(x, y), tt = S.ter[c]; if (tt !== 'g' && tt !== 'r' && tt !== 'h') continue; if (S.occ[c]) continue; const v = (tt === 'g' ? 2 : 1) - r / 100; if (v > bv) { bv = v; best = { x, y }; } } g.pasture = best; }
  // gardens behind the houses: women, children and the old tend them
  if (seas !== 0) { const hh = g.houses.filter(h => !h.ruined).length; g.treasury += hh * 0.45 * (dry ? 0.5 : 1); }
  // goats
  if (g.goats) {
    const cap = 6 + Math.round(40 * (g.room === undefined ? 0.5 : g.room)) + (g.pasture ? 6 : 0);
    if (seas === 1) g.goats += Math.max(g.goats >= 2 ? 1 : 0, Math.round(g.goats * 0.14 * (g.goats < cap ? 1 : 0.2)));
    if (g.goats > cap) g.goats -= Math.ceil((g.goats - cap) * 0.15);
    if (seas !== 0) g.treasury += g.goats * 0.12 * (dry ? 0.6 : 1);
    if (g.treasury < n * 1.2 && g.goats > 3) { const k = Math.min(g.goats - 3, Math.ceil(n / 5)); g.goats -= k; g.treasury += k * 4; g.slaughter = (g.slaughter || 0) + k; }
  } else if (S.tick - g.founded > 360 && rnd(S) < 0.01) { for (const o of S.groups) if (o !== g && o.goats > 8 && o.home && Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y) < 300 && (S.hostility[key(o.id, g.id)] || 0) < 0.6) { o.goats -= 2; g.goats = 2; break; } }
  // sea fishing from boats
  const fishers = mem.filter(m => m.job === 'fish');
  if (fishers.length && g.landing) {
    S.seaFish = S.seaFish || Array.from({ length: 12 }, () => ({ amt: 220, cap: 220 }));
    const sec = S.seaFish[sectorOf(S, g.landing.x, g.landing.y)], stock = sec.amt / sec.cap;
    let catchT = 0;
    // winter storms: boats go out only when the village is short of food, otherwise fishers mend nets ashore
    const needy = g.treasury < (n + 1) * 2;
    for (const m of fishers) {
      if (seas === 0 && !needy) continue;
      const c = 3.4 * (0.4 + m.energy * 0.6) * (0.3 + 0.7 * stock) * (seas === 0 ? 0.45 : 1); catchT += c;
      const risk = seas === 0 ? 0.0025 : seas === 3 ? 0.0012 : seas === 1 ? 0.0005 : 0.00025;
      if (rnd(S) < risk) { if (rnd(S) < 0.4 && g.fboats) g.fboats--; if (!S.firstLost || S.tick - S.firstLost > 360 * 6) { log(S, 'drown', `Лодка из «${g.name}» не возвращается с моря: ${m.name} не вернул${m.sex === 'f' ? 'ась' : 'ся'}`, g.landing.x, g.landing.y, g.hue, { first: !S.firstLost, why: seas === 0 ? 'Зимние шторма: в это время в море выходят только от голода.' : 'Море опасно и летом: лодку могло опрокинуть ветром.', who: [m.id], gs: [g.id] }); S.firstLost = S.tick; } removeAgent(S, m, 'lostAtSea'); }
    }
    sec.amt = Math.max(0, sec.amt - catchT * 0.55);
    g.treasury += catchT; S.stats.seaCatch = (S.stats.seaCatch || 0) + catchT;
  }
}
function seaRegen(S) { for (const sec of S.seaFish || []) sec.amt = Math.min(sec.cap, sec.amt + (sec.cap - sec.amt) * 0.035 + 1.5); }
function seaMonth(S) {
  seaRegen(S);
  while (S.waves && S.waves.length && S.waves[0] <= S.tick) { S.waves.shift(); landBoat(S, 6 + Math.floor(rnd(S) * 5), false); }
  if (S.tick % 360 === 180 && S.tick > 360 * 35 && popOf(S) < 420 && rnd(S) < 0.1) landBoat(S, 4 + Math.floor(rnd(S) * 4), false);
  // emigration: crowded, hungry or thirsty coastal villages send families away by boat
  if (S.tick % 360 !== 240) return;
  for (const g of S.groups.slice()) {
    if (!g.home || g.dead || g.members.length < 8 || g.wood < 6) continue;
    const hungryF = g.members.filter(id => { const m = S._a.get(id); return m && m.wealth < 0.3; }).length / g.members.length;
    const pressure = (1 - (g.room === undefined ? 1 : g.room)) * 0.6 + (g.thirst ? 0.5 : 0) + hungryF * 0.9 + (g.warsLost > (g.wl1 || 0) ? 0.2 : 0);
    g.wl1 = g.warsLost;
    if (pressure < 0.32 || rnd(S) > 0.35 * pressure) continue;
    const bs = beachNear(S, g.home.x, g.home.y, 260); if (!bs) continue;
    const mem = g.members.map(id => S._a.get(id)).filter(Boolean);
    const head = mem.filter(m => m.spouse && m.role !== 'leader' && m.age > 22 && m.age < 50).sort((a, b) => b.res - a.res)[0]; if (!head) continue;
    const fam = mem.filter(m => m === head || m.id === head.spouse || ((m.mother === head.id || m.father === head.id) && !m.spouse));
    if (fam.length < 2) continue;
    g.wood -= 8;
    const tx = `Уплывает с семьёй за море: в «${g.name}» ${g.thirst ? 'нет воды' : hungryF > 0.3 ? 'голодно' : 'тесно, свободной земли нет'}`;
    for (const m of fam) bio(S, m, 'emigr', tx);
    S.kids = (S.kids || []).filter(k => {
      if (!fam.some(m => m.id === k.mo || m.id === k.fa)) return true;
      if (S.ageAudit && k.t > 0 && k.t <= S.ageAudit.lastBirthTick) S.ageAudit.leftBefore60++;
      return false;
    });
    const d = Math.hypot(bs.x - S.isle.x, bs.y - S.isle.y) || 1;
    S.boats.push({ x0: bs.x, y0: bs.y, x1: bs.x + (bs.x - S.isle.x) / d * 160, y1: bs.y + (bs.y - S.isle.y) / d * 160, t: S.tick, out: true });
    S.stats.emigrated = (S.stats.emigrated || 0) + fam.length;
    log(S, 'emigr', `Семья ${head.name} уплывает из «${g.name}» искать новую землю`, bs.x, bs.y, g.hue, { first: !S.firstEmigr, why: sent([g.thirst ? 'в деревне нет воды' : hungryF > 0.3 ? `в деревне голодают ${Math.round(hungryF * 100)}%` : 'остров тесен: вокруг деревни не осталось свободной земли', `на лодку ушло дерево, а с острова — ${fam.length} ${pl(fam.length, 'человек', 'человека', 'человек')}`, 'кто уплыл, тот не вернётся: о них больше никто не услышит']), who: fam.map(m => m.id), gs: [g.id] });
    S.firstEmigr = true;
    for (const m of fam) removeAgent(S, m, 'emigr');
  }
}
function beachNear(S, x, y, R0) { let best = null, bd = R0; const ci = Math.floor(x / CS), cj = Math.floor(y / CS), r = Math.ceil(R0 / CS); for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) { if (i < 0 || j < 0 || i >= N || j >= N) continue; const c = j * N + i; if (S.ter[c] !== 'b') continue; const bx = i * CS + 10, by = j * CS + 10, d = Math.hypot(bx - x, by - y); if (d < bd && reach(S, x, y, bx, by)) { bd = d; best = { x: bx, y: by }; } } return best; }
function spawnBand(S, size, bx, by, kidsMax) {
  let made = 0; const band = [];
  for (let i = 0; i < size; i++) { const a = spawn(S, 'start'); a.x = clamp(bx + gauss(S) * 18, 10, 990); a.y = clamp(by + gauss(S) * 18, 10, 990); band.push(a); made++; }
  for (const a of band) for (const b of band) if (a !== b) a.trust[b.id] = 0.3 + rnd(S) * 0.15;
  const fs = band.filter(a => a.sex === 'f'), ms = band.filter(a => a.sex === 'm');
  for (let i = 0; i < Math.min(fs.length, ms.length); i++) if (rnd(S) < 0.75) { fs[i].spouse = ms[i].id; ms[i].spouse = fs[i].id; fs[i].trust[ms[i].id] = 0.8; ms[i].trust[fs[i].id] = 0.8; }
  if (band.length >= 3) { const L = band.slice().sort((p, q) => (q.ambition * 0.7 + q.skill * 0.3) - (p.ambition * 0.7 + p.skill * 0.3))[0]; const g = createGroup(S, L, band.filter(a => a !== L)); g.treasury = band.length * 7; }
  for (const a of band) if (a.spouse && a.sex === 'f' && rnd(S) < 0.6) { const n = 1 + Math.floor(rnd(S) * 3); for (let c = 0; c < n; c++) S.kids.push({ t: -Math.floor(rnd(S) * 360 * 12), mo: a.id, fa: a.spouse, g: null, sex: rnd(S) < 0.5 ? 'f' : 'm', x: a.x, y: a.y }); }
  return band;
}
