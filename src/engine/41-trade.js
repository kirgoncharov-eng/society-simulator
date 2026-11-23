const GOODS = ['food', 'wood', 'stone', 'tools'];
const BASE = { food: 1, wood: 1.5, stone: 2.5, tools: 6 };
const GNAME = { food: 'еды', wood: 'брёвен', stone: 'камня', tools: 'орудий' };
const GNOM = { food: 'еда', wood: 'брёвна', stone: 'камень', tools: 'орудия' }, GACC = { food: 'еду', wood: 'брёвна', stone: 'камень', tools: 'орудия' };
const GPRO = { food: 'её', wood: 'их', stone: 'его', tools: 'их' }, GNEED = { food: 'нужна', wood: 'нужны', stone: 'нужен', tools: 'нужны' };
const QF = { food: ['меру еды', 'меры еды', 'мер еды'], wood: ['бревно', 'бревна', 'брёвен'], stone: ['глыбу камня', 'глыбы камня', 'глыб камня'], tools: ['орудие', 'орудия', 'орудий'] };
const qty = (q, k) => { const n = Math.max(1, Math.round(q)); return `${n} ${pl(n, ...QF[k])}`; };
const stockOf = (g, k) => k === 'food' ? g.treasury : (g[k] || 0);
const addStock = (g, k, q) => { if (k === 'food') g.treasury += q; else g[k] = (g[k] || 0) + q; };
function needOf(g, k) {
  const n = g.members.length;
  if (k === 'food') return n * 6;
  if (k === 'wood') return 8 + Math.max(0, Math.ceil(n / 4) - g.houses.length) * 6 + (g.granary ? 0 : 8) + (g.workshop ? 6 : 0);
  if (k === 'stone') return g.workshop ? 8 : n >= 5 ? 6 : 0;
  return n * 0.6;
}
const valueOf = (g, k) => BASE[k] * clamp((needOf(g, k) + 1) / (stockOf(g, k) + 1), 0.25, 4);
const surplus = (g, k) => Math.max(0, stockOf(g, k) - needOf(g, k) * 1.2 - 1);
function segDist(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1, t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l, 0, 1); return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y); }
function carTarget(S, a) {
  const c = a.car, dest = S._g.get(c.phase === 'go' ? c.to : c.from);
  if (!dest || !dest.home) { a.car = null; return null; }
  return dest.home;
}
function tradeMonth(S) {
  const G = S.groups.filter(g => g.home && g.members.length >= 4);
  for (const A of G) {
    if (A.dead) continue;
    const busy = A.members.filter(id => { const m = S._a.get(id); return m && m.car; }).length;
    if (busy >= (A.members.length >= 14 ? 2 : 1)) continue;
    let best = null, bs = 0;
    for (const B of G) {
      if (B === A || B.dead) continue;
      const d = Math.hypot(A.home.x - B.home.x, A.home.y - B.home.y);
      if (d > 460 || (S.hostility[key(A.id, B.id)] || 0) > 0.5 || !reach(S, A.home.x, A.home.y, B.home.x, B.home.y)) continue;
      if (S.groups.some(H => H !== A && H !== B && H.home && (S.hostility[key(H.id, A.id)] || 0) > 0.6 && segDist(H.home, A.home, B.home) < 130)) continue;
      for (const X of GOODS) {
        const sx = surplus(A, X); if (sx < 1) continue;
        for (const Y of GOODS) {
          if (Y === X) continue;
          const sy = surplus(B, Y); if (sy < 0.5) continue;
          const gain = (valueOf(B, X) / valueOf(A, X)) * (valueOf(A, Y) / valueOf(B, Y));
          const sc = gain - d / 450 + (S.routes[key(A.id, B.id)] ? 0.3 : 0);
          if (sc > Math.max(bs, A.coin && B.coin ? 1.15 : 1.5)) { bs = sc; best = { B, X, Y, sx, sy, d, gain }; }
        }
      }
    }
    if (!best) continue;
    const { B, X, Y } = best;
    const px = Math.sqrt(valueOf(A, X) * valueOf(B, X)), py = Math.sqrt(valueOf(A, Y) * valueOf(B, Y));
    let qx = Math.min(best.sx, (A.coin && B.coin ? 45 : 30) / BASE[X]), V = qx * px, qy = V / py;
    if (qy > best.sy) { qy = best.sy; V = qy * py; qx = V / px; }
    if (qx < 0.5 || qy < 0.3) continue;
    const L = S._a.get(A.leader);
    const cands = A.members.map(id => S._a.get(id)).filter(m => m && !m.car && m !== L && m.age >= 18);
    if (!cands.length) continue;
    cands.sort((a, b) => ((b.xp.trade || 0) - (a.xp.trade || 0)) || (b.coop + b.ambition - a.coop - a.ambition));
    const m = cands[0];
    addStock(A, X, -qx);
    m.job = 'trade';
    m.car = { from: A.id, to: B.id, x: X, qx, y: Y, qy, px, py, phase: 'go', t: S.tick, why: `Обмен выгоден обоим. «${A.name}» отдаёт лишнее (${GACC[X]}) и получает ${GACC[Y]}: дома ${GPRO[Y]} не хватает. Для «${B.name}» наоборот: ${GNOM[Y]} у неё в избытке, а ${GNOM[X]} ${GNEED[X]}. Чем сильнее расходятся нужды, тем выгоднее сделка.` };
  }
}
function caravans(S) {
  for (const a of S.agents.slice()) {
    if (!S._a.has(a.id)) continue;
    const c = a.car; if (!c) continue;
    const A = S._g.get(c.from), B = S._g.get(c.to);
    if (!A || a.group !== c.from) { a.car = null; continue; }
    if (a._travel?.arrived || (S.tick + a.id) % 6 === 0) {
      for (const H of S.groups) {
        if (!H.home || H === A || H.id === c.to || (S.hostility[key(H.id, A.id)] || 0) < 0.6) continue;
        if (!walkedNear(a, H.home, 120) || H.members.length < 4 || rnd(S) > 0.25 || (S.raidCool || {})[key(H.id, A.id)] > S.tick) continue;
        S.raidCool = S.raidCool || {}; S.raidCool[key(H.id, A.id)] = S.tick + 360;
        const good = c.phase === 'go' ? c.x : c.y, q = c.phase === 'go' ? c.qx : c.qy;
        addStock(H, good, q); S.stats.raids++; A.raided = S.tick;
        S.hostility[key(H.id, A.id)] = Math.min(2, (S.hostility[key(H.id, A.id)] || 0) + 0.4);
        const killed = rnd(S) < 0.3, LH = S._a.get(H.leader);
        log(S, 'raid', `Люди «${H.name}» грабят караван «${A.name}»${killed ? `, купец ${a.name} убит` : ''}`, a.x, a.y, H.hue, { why: sent([`караван шёл в ${cells(Math.hypot(a.x - H.home.x, a.y - H.home.y))} от «${H.name}»`, `между деревнями ${hostWord(S.hostility[key(H.id, A.id)] || 0)}`, `добыча: ${qty(q, good)}`, 'теперь «' + A.name + '» выставит стражу']), who: [a.id, LH && LH.id].filter(Boolean), gs: [H.id, A.id] });
        a.car = null;
        if (killed) removeAgent(S, a, 'war'); else a.energy = Math.max(0.05, a.energy - 0.3);
        break;
      }
      if (!a.car) continue;
    }
    if (c.phase === 'go') {
      if (!B || !B.home) { addStock(A, c.x, c.qx * 0.5); a.car = null; continue; }
      if (!a._travel?.arrived) continue;
      const pyNow = Math.sqrt(valueOf(A, c.y) * valueOf(B, c.y));
      let qy = Math.min(c.qx * c.px / pyNow, Math.max(0, stockOf(B, c.y) - needOf(B, c.y) * 0.8));
      if (qy < 0.2) { c.phase = 'back'; c.y = c.x; c.qy = c.qx * 0.7; c.failed = true; continue; }
      addStock(B, c.x, c.qx); addStock(B, c.y, -qy);
      c.qy = qy; c.py = pyNow; c.phase = 'back';
      const V = c.qx * c.px;
      a.wealth += V * (A.coin ? 0.1 : 0.08); a.status += V * 0.03; a.trades = (a.trades || 0) + 1;
      a.xp.trade = (a.xp.trade || 0) + 0.25;
      if (a.xp.trade >= 1 && !a.master) a.master = 'trade';
      const LA = S._a.get(A.leader), LB = S._a.get(B.leader);
      if (LA && LB) { bump(LA, LB, 0.06); bump(LB, LA, 0.06); bump(a, LB, 0.05); bump(LB, a, 0.04); }
      const k = key(A.id, B.id);
      if (S.hostility[k]) S.hostility[k] = Math.max(0, S.hostility[k] - 0.12);
      S.stats.trades++; A.trades = (A.trades || 0) + 1; B.trades = (B.trades || 0) + 1;
      for (const [F, T] of [[A, B], [B, A]]) if (F.coin && !T.coin && S.params.coin >= 0.5 && rnd(S) < 0.2) {
        T.coin = true; S.stats.coinGroups = (S.stats.coinGroups || 0) + 1;
        log(S, 'money', `«${T.name}» переходит на монету «${F.name}»`, T.home.x, T.home.y, T.hue, { why: 'Торговать с партнёром за монету проще, чем искать, кому нужен именно твой товар. Монета не гниёт, поэтому богатство теперь можно копить.', gs: [T.id, F.id] });
        break;
      }
      for (const [F, T] of [[A, B], [B, A]]) {
        if (F.faith && T.faith !== F.faith && rnd(S) < (T.faith ? 0.04 : 0.15)) {
          const old = T.faith, fn = S.faiths[F.faith];
          T.faith = F.faith;
          if (fn) log(S, 'faith', `«${T.name}» ${old ? 'меняет веру и принимает' : 'принимает'} ${fn.name} от торговых партнёров из «${F.name}»`, T.home.x, T.home.y, fn.hue, { why: sent([`купцы годами ходят между деревнями`, old ? `прежняя вера «${T.name}» слабее: соседи и партнёры молятся иначе` : 'своей веры у деревни не было', 'общая вера растит доверие и гасит вражду между единоверцами']), gs: [T.id, F.id] });
          break;
        }
      }
      const P = S.price; P[c.x] = P[c.x] * 0.85 + c.px * 0.15; P[c.y] = P[c.y] * 0.85 + pyNow * 0.15;
      const r = S.routes[k];
      const ratio = `1 ${c.y === 'tools' ? 'орудие' : c.y === 'stone' ? 'камень' : c.y === 'wood' ? 'бревно' : 'мера еды'} = ${(pyNow / c.px).toFixed(1)} ${c.x === 'tools' ? 'орудия' : c.x === 'stone' ? 'камня' : c.x === 'wood' ? 'бревна' : 'еды'}`;
      if (!r) {
        S.routes[k] = { a: A.id, b: B.id, n: 1, t: S.tick, x1: A.home.x, y1: A.home.y, x2: B.home.x, y2: B.home.y };
        const first = !S.firstTrade; S.firstTrade = true;
        log(S, first ? 'trade' : 'route', first ? `Первая сделка в мире: «${A.name}» меняет ${qty(c.qx, c.x)} на ${qty(qy, c.y)} у «${B.name}»` : `«${A.name}» и «${B.name}» открывают торговый путь`, B.home.x, B.home.y, A.hue, { first, why: `${c.why} Цена сложилась сама, из того, насколько каждой стороне нужен товар: ${ratio}. Купец ${a.name} берёт себе восьмую часть сделки.`, who: [a.id, LA && LA.id, LB && LB.id].filter(Boolean), gs: [A.id, B.id] });
      } else { r.n++; r.t = S.tick; r.x1 = A.home.x; r.y1 = A.home.y; r.x2 = B.home.x; r.y2 = B.home.y; }
      if (LA && a.trades >= 3 && a.wealth > LA.wealth && !a.richer) {
        a.richer = true;
        log(S, 'trade', `Купец ${a.name} становится богаче своего вождя ${nameCase(LA, 'genitive')}`, a.x, a.y, A.hue, { why: `После ${a.trades} ${pl(a.trades, 'каравана', 'караванов', 'караванов')} у него ${a.wealth.toFixed(0)}, а у вождя ${LA.wealth.toFixed(0)}. Восьмая часть каждой сделки оседает у купца. Богатство даёт вес и сторонников: рядом с вождём появляется вторая сила.`, who: [a.id, LA.id], gs: [A.id] });
      }
    } else if (a._travel?.arrived) {
      addStock(A, c.y, c.qy); a.car = null;
    }
  }
  for (const k in S.routes) { const r = S.routes[k], dead = !S._g.has(r.a) || !S._g.has(r.b); if (S.tick - r.t > 360 * (dead ? 5 : 10)) delete S.routes[k]; }
}
function marketWatch(S) {
  const h = S.hist; if (!h.pf || h.pf.length < 25 || !S.firstTrade) return;
  const now = h.pf[h.pf.length - 1], then = h.pf[h.pf.length - 25];
  if (now > then * 1.7 && S.tick - (S.foodSpike || -1e9) > 360 * 4) {
    S.foodSpike = S.tick;
    const fam = S.events.filter(e => e.type === 'famine' && S.tick - e.t < 720).length;
    log(S, 'market', `Еда подорожала в ${(now / then).toFixed(1)} раза за два года`, undefined, undefined, 0, { why: sent([fam ? `${fam} голодных зим за два года` : '', S.tick < S.drought + 360 ? 'засуха срезала урожай' : '', `население ${S.agents.length}`, 'у кого полный амбар, тот теперь богатеет на обмене']) });
  }
}

