function settle(S, g) {
  const L = S._a.get(g.leader), o = { x: g.cx, y: g.cy };
  let best = null, bv = -1e9, info = null;
  for (const r of S.ruins || []) {
    if (S.tick - r.t > 360 * 40 || !r.houses.length || Math.hypot(r.x - o.x, r.y - o.y) > 380) continue;
    if (S.groups.some(h => h !== g && h.home && Math.hypot(h.home.x - r.x, h.home.y - r.y) < 130)) continue;
    if (!reach(S, o.x, o.y, r.x, r.y)) continue;
    const v = 18 + r.houses.length * 5 + r.fields.length * 2 - Math.hypot(r.x - o.x, r.y - o.y) / 40;
    if (v > bv) { bv = v; best = r; }
  }
  if (best && rnd(S) < 0.85) {
    const r = best; S.ruins = S.ruins.filter(x => x !== r);
    g.home = { x: r.x, y: r.y }; g.cx = r.x; g.cy = r.y;
    g.houses = r.houses.slice(0, 16).map(h => ({ ...h, ruined: true }));
    for (const f of r.fields) { const c = cellAt(f.x, f.y); if (S.occ[c] || (S.own && S.own[c])) continue; S.occ[c] = g.id; g.fields.push({ x: f.x, y: f.y, c, fert: S.ter[c] === 'r' ? 0.9 : 0.55 }); }
    if (r.plan) g.plan = Object.assign({}, r.plan);
    if (r.fortifications?.length) {
      g.fortifications = r.fortifications; g.walls = true;
      S.wallV = (S.wallV || 0) + 1;
    }
    claim(S, g, 20, 20); pickTarget(S, g);
    S.settledOnce = true;
    log(S, 'settle', `«${g.name}» занимает заброшенную деревню «${r.name}» и чинит дома`, r.x, r.y, g.hue, { why: sent([`деревня пустует ${yrs(Math.max(1, Math.round((S.tick - r.t) / 360)))}`, `там стоят ${g.houses.length} ${pl(g.houses.length, 'дом', 'дома', 'домов')} без крыш${g.fields.length ? ` и ${g.fields.length} ${pl(g.fields.length, 'заросшее поле', 'заросших поля', 'заросших полей')}` : ''}`, 'починить старый дом вдвое быстрее, чем построить новый', 'место уже проверено: здесь когда-то жили']), gs: [g.id] }); if (!g.powerEv) powerEvent(S, g, S.events[0].id);
    return;
  }
  best = null; bv = -1e9;
  for (let t = 0; t < 140; t++) {
    const x = clamp(o.x + gauss(S) * 260, 40, 960), y = clamp(o.y + gauss(S) * 260, 40, 960);
    const c = cellAt(x, y), tt = S.ter[c]; if (tt === 'w' || tt === 'h' || tt === 's' || tt === 'b' || riverDist(S, x, y) < 45) continue;
    let fert = 0, forest = 0, water = 0;
    const ci = c % N, cj = Math.floor(c / N);
    for (let dj = -6; dj <= 6; dj++) for (let di = -6; di <= 6; di++) {
      const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= N || j >= N) continue;
      const q = S.ter[j * N + i], dd = di * di + dj * dj;
      if (dd <= 25 && q === 'r' && !S.occ[j * N + i]) fert++; if (dd <= 36 && q === 'f') forest++; if (dd <= 9 && q === 'w') water++;
    }
    let near = 1e9; for (const h of S.groups) if (h !== g && h.home) near = Math.min(near, Math.hypot(h.home.x - x, h.home.y - y));
    let wd = riverDist(S, x, y) - 22; for (const sp of S.springs || []) wd = Math.min(wd, Math.hypot(sp.x - x, sp.y - y));
    const v = fert * 1.6 + Math.min(forest, 20) * 0.8 + (water ? 8 : 0) - (near < 170 ? 40 : near < 260 ? 10 : 0) - Math.hypot(x - o.x, y - o.y) / 40 - Math.max(0, wd - 60) / 12;
    if (v > bv) { bv = v; best = { x, y }; info = { fert, forest, water, near }; }
  }
  if (!best || !reach(S, o.x, o.y, best.x, best.y)) return;
  g.home = best; g.cx = best.x; g.cy = best.y; planOf(S, g);
  claim(S, g, 20, 20);
  pickTarget(S, g);
  const first = !S.settledOnce; S.settledOnce = true;
  log(S, 'settle', first ? `Первое поселение в мире: «${g.name}» перестаёт кочевать${info.water ? ' и оседает у реки' : ''}` : `«${g.name}» основывает поселение${info.water ? ' у реки' : ''}`, best.x, best.y, g.hue, { first, why: sent([info.fert ? `рядом ${info.fert} клеток плодородной земли под поля` : 'плодородной земли мало, придётся жить собирательством', info.forest ? `лес в шаге: ${info.forest} клеток на брёвна` : 'леса рядом нет, брёвна носить издалека', info.water ? 'вода под боком' : '', g.plan.toward ? `первая улица идёт к ${g.plan.toward}` : '', info.near < 1e8 ? `ближайшие соседи в ${cells(info.near)}` : 'соседей поблизости нет']), who: [L.id], gs: [g.id] }); if (!g.powerEv) powerEvent(S, g, S.events[0].id);
}
function houseSpot(S, g) {
  const plan = planOf(S, g);
  for (let t = 0; t < 32; t++) {
    const p = plotPos(g, plan.k);
    plan.k = (plan.k + 1) % 32;
    if (p && plotOk(S, g, p) && lineOnLand(S, p.entrance, p.frontage)
      && !g.fortifications?.some(w => w.segments.some(({ a, b }) => lineCrossing(p.entrance, p.frontage, a, b) !== null))) {
      return { kind: 'house', ...p, prog: 0, need: 50 };
    }
  }
  return specialSpot(S, g, 'house');
}
function fieldSpot(S, g) {
  const hc = cellAt(g.home.x, g.home.y), ci = hc % N, cj = Math.floor(hc / N);
  let best = null, bv = -1e9;
  for (let dj = -8; dj <= 8; dj++) for (let di = -8; di <= 8; di++) {
    const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= N || j >= N) continue;
    const c = j * N + i, t = S.ter[c]; if ((t !== 'r' && t !== 'g') || S.occ[c] || (S.own && S.own[c] && S.own[c] !== g.id)) continue;
    const x = i * CS + 10, y = j * CS + 10, d = Math.hypot(x - g.home.x, y - g.home.y);
    if (riverDist(S, x, y) < 28) continue;
    if (d < 48 || d > 170 || !streetClear(g, { x, y }, 10)) continue;
    if (g.houses.some(h => Math.abs(h.x - x) < 16 && Math.abs(h.y - y) < 16)
      || [g.well, g.workshop, g.granary, g.shrine].some(p => p && dist(p, { x, y }) < 17)) continue;
    if (g.fortifications?.some(w => w.segments.some(({ a, b }) => distanceToSegment({ x, y }, a, b) < 10))) continue;
    if (!reach(S, g.home.x, g.home.y, x, y)) continue;
    let adj = 0; for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = c + ox + oy * N; if (S.occ[q] === g.id) adj++; }
    const fert = t === 'r' ? 1 : 0.6, v = fert * 2 - d / 110 + adj * 0.45 - (S.road[c] ? 1 : 0);
    if (v > bv) { bv = v; best = { kind: 'field', x, y, c, fert, prog: 0, need: 40 }; }
  }
  if (best) { S.occ[best.c] = g.id; if (S.own) S.own[best.c] = g.id; best.owner = g.land === 'private' ? g.leader : null; }
  return best;
}
function finishSite(S, g) {
  const st = g.site; g.site = null;
  if (st.kind === 'house') {
    g.houses.push({ ...placedSite(st), built: S.tick, ...(st.earth ? { earth: true } : {}) });
    const k = g.houses.length;
    if (k === 5 || k === 10 || k === 15) log(S, 'milestone', `Поселение «${g.name}» разрастается до ${k} домов`, g.home.x, g.home.y, g.hue, { why: `В деревне ${g.members.length} человек, под крышей могут зимовать ${k * 4}. Для последнего дома строители принесли ${st.materials?.wood ?? 6} заготовок дерева и отработали на площадке.`, gs: [g.id] });
  } else if (st.kind === 'workshop') {
    g.workshop = { ...placedSite(st), built: S.tick };
    const first = !S.firstWorkshop; S.firstWorkshop = true;
    log(S, 'tech', first ? `Первая мастерская в мире: «${g.name}» начинает делать орудия` : `«${g.name}» строит мастерскую`, st.x, st.y, g.hue, { first, why: `Камень с холмов и брёвна из леса превращаются в орудия. С орудием любая работа идёт на половину быстрее, но орудия изнашиваются, и камень с деревом нужны постоянно. Холмы у «${g.name}» в ${cells(g.stoneDist)} от поселения.`, gs: [g.id] });
  } else if (st.kind === 'palisade') {
    (g.fortifications ||= []).push({ id: st.id, kind: st.kind, ...st.layout, started: st.started, built: S.tick, materials: st.materials });
    g.walls = true;
    S.wallV = (S.wallV || 0) + 1;
    log(S, 'tech', `«${g.name}» заканчивает участок частокола`, st.x, st.y, g.hue, {
      why: sent([`ограда прикрывает жилые дворы со стороны «${st.layout.threatName}»`, `${st.layout.posts} кольев из ${st.wood} заготовок дерева`, st.layout.gates.length ? 'на улице оставили проезд' : 'тропы остались открыты']),
      gs: [g.id],
    });
  } else if (st.kind === 'shrine') {
    g.shrine = { ...placedSite(st), built: S.tick };
    S.faiths = S.faiths || {};
    const partner = S.groups.find(o => o !== g && o.faith && o.home && (S.routes[key(o.id, g.id)] || (S.hostility[key(o.id, g.id)] || 0) < 0.2 && Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y) < 300));
    const why0 = sent([g.famY !== undefined ? 'голодные зимы' : '', g.warsLost ? 'проигранные битвы' : '', 'люди ищут смысл в бедах', 'святилище утешает: обиды копятся на треть медленнее, а власть вождя кажется законнее', 'жрец кормится подношениями']);
    if (!g.faith && partner && rnd(S) < 0.6) {
      g.faith = partner.faith; const fn = S.faiths[g.faith];
      log(S, 'faith', `«${g.name}» ставит святилище и принимает ${fn.name} от соседей из «${partner.name}»`, st.x, st.y, fn.hue, { why: why0, gs: [g.id, partner.id] });
    } else if (!g.faith) {
      const nearRiver = riverDist(S, g.home.x, g.home.y) < 120, h = nearestHill(S, g.home), fc = nearestForest(S, g.home);
      const kind = nearRiver ? 'культ Реки' : h.d < 150 ? 'культ Горы' : fc !== null && Math.hypot((fc % N) * CS - g.home.x, Math.floor(fc / N) * CS - g.home.y) < 80 ? 'культ Леса' : (g.warsWon > g.warsLost ? 'культ Огня' : 'культ Предков');
      const same = Object.values(S.faiths).filter(f => f.base === kind).length;
      const id = 'f' + (Object.keys(S.faiths).length + 1);
      S.faiths[id] = { name: same ? `${kind} (${['северный', 'новый', 'южный', 'истинный', 'старый'][same % 5]})` : kind, base: kind, hue: (g.hue + 180) % 360, founded: S.tick, by: g.id, usury: rnd(S) < 0.4 ? 'ban' : 'ok' };
      g.faith = id;
      const first = !S.firstFaith; S.firstFaith = true;
      log(S, 'faith', first ? `Первая вера в мире: в «${g.name}» рождается ${S.faiths[id].name}` : `В «${g.name}» рождается ${S.faiths[id].name}`, st.x, st.y, S.faiths[id].hue, { first, why: why0 + ` Чему поклоняться, подсказывает место: ${nearRiver ? 'река рядом кормит и топит' : h.d < 150 ? 'над деревней нависают холмы' : 'деревню окружает лес'}.`, gs: [g.id] });
    }
  } else if (st.kind === 'bridge') {
    for (const c of st.cells) S.bridge[c] = g.id; S.navV++; g.bridgeAt = S.tick;
    if (st.approaches) (S.bridgePlans ||= []).push({ ...placedSite(st), cells: st.cells, approaches: st.approaches, built: S.tick });
    const first = !S.firstBridge; S.firstBridge = true;
    log(S, 'bridge', first ? `Первый мост в мире: «${g.name}» перекидывает мост через реку` : `«${g.name}» строит мост через реку`, st.x, st.y, g.hue, { first, why: sent([`за год жители ${g.cross12 || 0} ${pl(g.cross12 || 0, 'раз', 'раза', 'раз')} переходили реку вброд или по льду`, g.drowned ? `${g.drowned} ${pl(g.drowned, 'человек утонул', 'человека утонули', 'человек утонули')}` : 'брод опасен, особенно в половодье', 'мост — это брёвна и месяцы работы, зато по нему ходят без риска и вдвое быстрее', 'теперь по мосту пойдут и чужие: торговцы и войска']), gs: [g.id] });
  } else if (st.kind === 'fboat') {
    g.fboats = (g.fboats || 0) + 1;
    if (!S.firstFboat) { S.firstFboat = true; log(S, 'tech', `Первая рыбацкая лодка: «${g.name}» выходит в море`, st.x, st.y, g.hue, { first: true, why: 'Рыба у берега быстро кончается, а в море её больше. На лодке двое рыбаков ловят за день столько, сколько с берега за неделю. Но море опасно: в шторм лодки не возвращаются.', gs: [g.id] }); }
  } else if (st.kind === 'well') {
    const ok = rnd(S) < wellOk(S, st.x, st.y);
    if (ok) { g.well = { ...placedSite(st), t: S.tick, depth: wellOk(S, st.x, st.y) > 0.9 ? 1 : 0.5, dry: false }; }
    const first = ok && !S.firstWell; if (ok) S.firstWell = true;
    log(S, 'well', ok ? (first ? `Первый колодец в мире: «${g.name}» копает свой колодец` : `«${g.name}» копает колодец`) : `«${g.name}» копает колодец, но до воды не докапывается`, st.x, st.y, g.hue, { first, why: sent([`до воды ${Math.round(g.wd || 0)} шагов: каждый день ${g.wNeed || 0} ${pl(g.wNeed || 0, 'человек', 'человека', 'человек')} только носят воду`, ok ? 'теперь вода прямо в деревне, и руки освобождаются для полей' : 'здесь глубоко до воды: в низине у реки копать легче', ok && wellOk(S, st.x, st.y) < 0.9 ? 'колодец неглубокий и в засуху может пересохнуть' : '']), gs: [g.id] });
  } else if (st.kind === 'repair') {
    const hh = g.houses[st.idx]; if (hh) hh.ruined = false;
  } else if (st.kind === 'granary') {
    g.granary = { ...placedSite(st), built: S.tick };
    const first = !S.firstGranary; S.firstGranary = true;
    log(S, 'tech', first ? `Первый амбар в мире: «${g.name}» учится хранить урожай` : `«${g.name}» строит амбар`, st.x, st.y, g.hue, { why: `Без амбара запасы гниют: полтора процента в месяц. В амбаре — в пять раз медленнее, и урожай доживает до весны. В «${g.name}» скопилось ${Math.round(g.treasury)} еды.`, gs: [g.id] });
  } else g.fields.push({ x: st.x, y: st.y, c: st.c, fert: st.fert });
}
function nearestHill(S, p, g) {
  let best = null, bd = 1e9;
  for (let c = 0; c < S.ter.length; c++) { if (S.ter[c] !== 'h' || !usable(S, c, g)) continue; const d = Math.hypot((c % N) * CS + 10 - p.x, Math.floor(c / N) * CS + 10 - p.y); if (d < bd) { bd = d; best = c; } }
  return bd < 360 ? { c: best, d: bd } : { c: null, d: bd };
}
function placedSite({ x, y, angle, footprint, entrance, frontage, id, started, materials, approvedBy }) {
  return { x, y, angle, footprint, entrance, frontage, id, started, materials, approvedBy };
}
function specialSpot(S, g, kind) {
  const plan = planOf(S, g);
  const angle = Math.atan2(plan.uy, plan.ux);
  const radius = kind === 'house' ? 6 : kind === 'well' ? 5 : kind === 'cemetery' ? 10 : 8;
  const field = g.fields.reduce((near, f) => !near || dist(f, g.home) < dist(near, g.home) ? f : near, null);
  const quarry = g.stoneCell == null ? null : { x: (g.stoneCell % N) * CS + 10, y: Math.floor(g.stoneCell / N) * CS + 10 };
  let choice = null, best = -Infinity;
  for (const r of [16, 28, 42, 58, 78, 105, 133, 162]) {
    if (kind === 'well' && r > 58) break;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6 + angle;
      const p = { x: g.home.x + r * Math.cos(a), y: g.home.y + r * Math.sin(a) };
      if (!plotOk(S, g, p, radius)) continue;
      const street = distanceToSegment(p, plan.street.a, plan.street.b);
      let score = -r - street * 0.5;
      if (kind === 'granary') score += Math.min(50, riverDist(S, p.x, p.y) - 24) - (field ? dist(p, field) * 0.5 : 0);
      if (kind === 'workshop') score -= (quarry ? dist(p, quarry) * 0.6 : 0) + Math.max(0, 24 - r) * 2;
      if (kind === 'well') score += wellOk(S, p.x, p.y) * 85;
      if (kind === 'cemetery') score = (r < 42 ? -500 : -Math.abs(r - 75)) + Math.min(40, street) * 0.8;
      if (score > best) { best = score; choice = p; }
    }
    if (choice && kind === 'house') break;
  }
  if (!choice) return null;
  const need = kind === 'house' ? 50 : kind === 'workshop' ? 70
    : kind === 'well' && wellOk(S, choice.x, choice.y) < 0.5 ? 120 : 60;
  return { kind, ...choice, angle, prog: 0, need };
}
const CARGO_JOB = { food: 'farm', wood: 'wood', stone: 'stone' };
const HAUL = 2.5, CAP = { food: 4, wood: 3, stone: 2 };
function load(m, k, v) { if (m.lk && m.lk !== k && m.load > 0) return; m.lk = k; m.load = (m.load || 0) + v; if (m.load >= CAP[k]) m.haul = true; }
function storeOf(g, k) { return k === 'food' && g.granary ? g.granary : k === 'stone' && g.workshop ? g.workshop : g.home; }
function deliver(S) {
  const winter = seasonOf(S.tick) === 0;
  for (const a of S.agents) {
    if (!a.load) continue;
    const g = a.group && S._groupsById[a.group];
    if (!g || !g.home) { a.load = 0; a.haul = false; a.lk = null; continue; }
    const st = storeOf(g, a.lk);
    if (a.haul && within(a.x - st.x, a.y - st.y, 16)) { addStock(g, a.lk, a.load); a.load = 0; a.haul = false; a.lk = null; }
    else if (!a.haul && winter && a.lk === 'food' && a.job !== 'gather') a.haul = true;
    else if (!a.haul && a.job !== (a.lk === 'food' && a.job === 'gather' ? 'gather' : CARGO_JOB[a.lk])) a.haul = true;
  }
}
