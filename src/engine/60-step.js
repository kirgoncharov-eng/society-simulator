function step(S, plans) {
  S.tick++;
  S.minute = 0;
  advanceWeather(S);
  if (!S.wear) navInit(S);
  if (!S.springs) springsInit(S);
  { const d = S.tick % 360, fr = d >= 12 && d < 78; if (fr !== S.frozen) { S.frozen = fr; S.navV++; } }
  const P = S.params;
  const reg = 0.38 * (1.25 - P.scarcity) * (S.tick < S.drought ? 0.3 : 1) * (seasonOf(S.tick) === 0 ? 0.45 : 1.15);
  const regF = 0.38 * (1.25 - P.scarcity) * 1.9;
  const regLand = reg * 1.25;
  for (const n of S.nodes) n.amt = Math.min(n.cap, n.amt + (n.kind === 'fish' ? regF : regLand));
  for (const g of S.groups) {
    if (g.home) { g.cx = g.home.x; g.cy = g.home.y; continue; }
    let sx = 0, sy = 0;
    for (const id of g.members) { const m = S._agentsById[id]; sx += m.x; sy += m.y; }
    g.cx = sx / g.members.length; g.cy = sy / g.members.length;
  }
  move(S, plans);
  deliver(S);
  caravans(S);
  wars(S);
  if (S.tick % 6 === 0) patrol(S);
  produce(S);
  lifecycle(S);
  births(S);
  if (S.tick % 30 === 0) monthly(S);
  monthDays(S);
  inflow(S);
}

function nodeOf(S, id) {
  if (!S._nodesById) S._nodesById = new Map(S.nodes.map(node => [node.id, node]));
  return S._nodesById.get(id) || null;
}

function moveDistance(dx, dy) {
  const x = Math.abs(dx), y = Math.abs(dy);
  const max = Math.max(x, y);
  if (!max) return 0;
  // Use the same normalized two-term sum as hypot, without its generic argument loop.
  const ratio = Math.min(x, y) / max;
  return Math.sqrt(1 + ratio * ratio) * max;
}

function move(S, plans) {
  const A = S.agents, tick = S.tick;
  const day = tick % 360, frozen = S.frozen;
  const fordRisk = frozen ? (day < 20 || day >= 70 ? 0.002 : 0.0004)
    : day >= 90 && day < 150 ? 0.008 : 0.00025;
  const guardPost = Math.floor(tick / 160), guardWall = Math.floor(tick / 120);
  const storm = S.weather?.kind === 'storm';
  const costs = navigationCosts(S), light = daylightHours(tick);
  for (const a of A) {
    let tx, ty;
    const gH = a.group && S._groupsById[a.group];
    const wp = a.war ? warTarget(S, a) : null;
    const cp = !wp && a.car ? carTarget(S, a) : null;
    const escape = a.escape && nodeOf(S, gH?.target);
    if (wp) { tx = wp.x + ((a.id * 7) % 15 - 7); ty = wp.y + ((a.id * 11) % 15 - 7); }
    else if (cp) { tx = cp.x + ((a.id * 7) % 9 - 4); ty = cp.y + ((a.id * 11) % 9 - 4); }
    else if (a.relocation && gH?.home) { tx = gH.home.x; ty = gH.home.y; }
    else if (escape) { tx = escape.x; ty = escape.y; }
    else if (gH && gH.home) {
      const g = gH, j = ((a.id * 37) % 13) - 6, j2 = ((a.id * 53) % 11) - 5;
      let p = null;
      if (a.haul && a.load) p = storeOf(g, a.lk);
      else if (a.job === 'farm' && g.fields.length) p = g.fields[(a.slot || 0) % g.fields.length];
      else if (a.job === 'wood' && g.woodCell !== null) p = { x: (g.woodCell % 50) * 20 + 10, y: Math.floor(g.woodCell / 50) * 20 + 10 };
      else if (a.job === 'build' && g.site) p = siteTarget(g, a);
      else if (a.job === 'stone' && g.stoneCell !== null) p = { x: (g.stoneCell % 50) * 20 + 10, y: Math.floor(g.stoneCell / 50) * 20 + 10 };
      else if (a.job === 'craft') p = g.workshop || g.home;
      else if (a.job === 'pray' && g.shrine) p = g.shrine;
      else if (a.job === 'fish' && g.landing && !storm) p = { x: g.landing.x + ((a.id * 7) % 9) - 4, y: g.landing.y + ((a.id * 3) % 9) - 4 };
      else if (a.job === 'herd' && g.pasture) p = { x: g.pasture.x + Math.cos(tick / 90 + a.id) * 22, y: g.pasture.y + Math.sin(tick / 90 + a.id) * 22 };
      else if (a.job === 'water' && g.wsrc) { const tgt = a.wc ? g.home : g.wsrc; if (within(a.x - tgt.x, a.y - tgt.y, 14)) a.wc = !a.wc; p = a.wc ? g.home : g.wsrc; }
      else if (a.job === 'guard') {
        const bc = g.bcells || [];
        if (bc.length && a.id % 3 !== 0) { const c = bc[(a.id * 7 + guardPost) % bc.length]; p = { x: (c % 50) * 20 + 10, y: Math.floor(c / 50) * 20 + 10 }; }
        else if (g.fortifications?.length) {
          const wall = g.fortifications[(a.id + guardWall) % g.fortifications.length];
          const { a: from, b: to } = wall.segments[a.id % wall.segments.length];
          p = { x: (from.x + to.x) / 2 - (wall.facing?.x || 0) * 5, y: (from.y + to.y) / 2 - (wall.facing?.y || 0) * 5 };
        } else { const ang = a.id * 1.7 + tick / 140; p = { x: g.home.x + Math.cos(ang) * 34, y: g.home.y + Math.sin(ang) * 34 }; }
      }
      else if (a.job === 'gather') p = nodeOf(S, g.target);
      else if (a.job === 'home') p = houseOf(g, a.house);
      if (!p || a.role === 'leader' || a.job === 'lead') { const ang = a.id * 2.39996, r = a.role === 'leader' ? 4 : 10 + (a.id % 4) * 6; p = { x: g.home.x + Math.cos(ang) * r, y: g.home.y + Math.sin(ang) * r }; }
      if (a.rite && tick < a.rite.until) p = a.rite;
      const spread = a.job === 'gather' ? 3 : a.job === 'build' ? 0.45 : 1.2;
      tx = p.x + j * spread; ty = p.y + j2 * spread;
      if (a.job === 'home' || !costs[cellAt(tx, ty)]) { tx = p.x; ty = p.y; }
    } else if (a.group) {
      const g = S._groupsById[a.group];
      if (a.role === 'leader') {
        const n = nodeOf(S, g.target);
        const ga = g.id * 2.39996;
        tx = n ? n.x + Math.cos(ga) * 40 : g.cx; ty = n ? n.y + Math.sin(ga) * 40 : g.cy;
        tx += Math.sin(tick / 47 + a.id) * 12; ty += Math.cos(tick / 53 + a.id) * 12;
      } else {
        const b = S._agentsById[a.boss] || S._agentsById[g.leader];
        const ang = (a.id * 2.39996) % (Math.PI * 2) + Math.sin(tick / 90 + a.id) * 0.4;
        const r = 26 + (a.id % 3) * 9;
        tx = b.x + Math.cos(ang) * r; ty = b.y + Math.sin(ang) * r;
      }
    } else {
      let n = nodeOf(S, a.tnode);
      if (!n || n.amt < 4 || (tick + a.id) % 90 === 0) {
        let bv = -1;
        for (const q of S.nodes) { const v = (q.amt + 2) / (1 + Math.hypot(q.x - a.x, q.y - a.y) / 110) * (0.7 + rnd(S) * 0.6) * (S.own && S.own[cellAt(q.x, q.y)] ? 0.4 : 1); if (v > bv) { bv = v; n = q; } }
        a.tnode = n ? n.id : null;
      }
      tx = n ? n.x + Math.cos(a.id) * 22 : a.x; ty = n ? n.y + Math.sin(a.id) * 22 : a.y;
    }
    if (!costs[cellAt(a.x, a.y)]) toLand(S, a);
    tx = clamp(tx, 6, 994);
    ty = clamp(ty, 6, 994);
    if (!costs[cellAt(tx, ty)] && (wp || cp)) { tx = (wp || cp).x; ty = (wp || cp).y; }
    const trip = wp ? 'war' : cp ? 'caravan' : a.relocation && gH?.home ? 'relocation' : escape ? 'escape' : null;
    const home = !trip && gH?.home ? houseOf(gH, a.house) : null;
    const shelter = !trip && gH?.home && (home && !home.ruined ? home : gH.home);
    planMovement(S, a, tx, ty, trip, shelter, home, light, fordRisk, plans);
  }
  if (S._drown?.length) {
    for (const a of S._drown) drown(S, a);
    S._drown.length = 0;
  }
  meet(S, S.agents);
}

function meet(S, agents) {
  const order = S._meetingOrder || (S._meetingOrder = []);
  order.length = agents.length;
  for (let i = 0; i < agents.length; i++) order[i] = agents[i];
  order.sort((a, b) => a.x - b.x || a.id - b.id);
  for (let i = 0; i < order.length; i++) {
    const a = order[i];
    for (let j = i + 1; j < order.length; j++) {
      const b = order[j], dx = b.x - a.x;
      if (dx > 55) break;
      const dy = b.y - a.y;
      if (dx * dx + dy * dy < 3025 && rnd(S) < 0.02) interact(S, a, b);
    }
  }
}

function bump(a, b, d) { a.trust[b.id] = clamp((a.trust[b.id] || 0) + d, -1, 1); }
function allied(S, x, y) { return S.alliances.some(al => (al.a === x && al.b === y) || (al.a === y && al.b === x)); }

function interact(S, a, b) {
  if (!S._a.has(a.id) || !S._a.has(b.id)) return;
  const ga = a.group, gb = b.group;
  if (a.trust[b.id] === undefined) a.trust[b.id] = 0.25 * (b.rep || 0);
  if (b.trust[a.id] === undefined) b.trust[a.id] = 0.25 * (a.rep || 0);
  if (ga && ga === gb) { const Lid = S._groupsById[ga].leader; if (Lid !== a.id && Lid !== b.id) { const ta = a.trust[Lid] || 0, tb = b.trust[Lid] || 0, w = 0.05; if ((a.trust[b.id] || 0) > 0.1) a.trust[Lid] = ta + (tb - ta) * w; if ((b.trust[a.id] || 0) > 0.1) b.trust[Lid] = tb + (ta - tb) * w; } }
  if (ga && ga === gb) {
    const d = 0.025 * (a.coop + b.coop) / 2 - 0.012 * (a.res + b.res) / 2;
    bump(a, b, d); bump(b, a, d);
    const g = S._groupsById[ga];
    for (const [x, y] of [[a, b], [b, a]]) {
      if (x.id !== g.leader && y.id !== g.leader && x.ambition > 0.6 && y.res > 0.15) {
        y.trust[g.leader] = clamp((y.trust[g.leader] || 0) - 0.035 * x.ambition * (0.3 + y.res), -1, 1);
        x.intr = (x.intr || 0) + 1;
        bump(y, x, 0.03 * x.ambition);
      }
      if (y.id === g.leader && x.res < 0.2) bump(x, y, 0.01);
    }
  } else if (!ga && !gb) {
    const d = 0.08 * (a.coop + b.coop) / 2 - 0.012; bump(a, b, d); bump(b, a, d);
    if ((a.trust[b.id] || 0) > 0.22 && (b.trust[a.id] || 0) > 0.22 && rnd(S) < 0.05) {
      const sc = m => m.ambition * 0.7 + m.skill * 0.3 + m.status * 0.05;
      const L = sc(a) >= sc(b) ? a : b, o = L === a ? b : a;
      const g = createGroup(S, L, [o]);
      log(S, 'found', `${L.name} и ${o.name} основывают «${g.name}»`, L.x, L.y, g.hue, { why: `Доверие между ними выросло выше порога, а вместе они добывают больше, чем поодиночке. Вождём становится ${L.name}: ${fem(L, 'он', 'она')} больше рвётся к власти.`, who: [L.id, o.id], gs: [g.id] }); if (!g.powerEv) powerEvent(S, g, S.events[0].id);
    }
  } else if (!ga || !gb) {
    const s = ga ? b : a, m = ga ? a : b, g = S._groupsById[m.group], L = S._agentsById[g.leader];
    bump(s, m, 0.035 * s.coop + 0.008); bump(m, s, 0.02 * m.coop);
    const open = 0.18 + 0.5 * L.coop - 0.004 * g.members.length;
    if ((s.trust[m.id] || 0) > (s.wealth < 1 ? 0.12 : 0.22) && rnd(S) < open * (s.wealth < 1 ? 0.9 : 0.5)) { join(S, s, g, m.id); s.trust[g.leader] = Math.max(s.trust[g.leader] || 0, 0.1); }
  } else {
    const h = S.hostility[key(ga, gb)] || 0, al = allied(S, ga, gb);
    const d = al ? 0.02 : h > 0.4 ? -0.03 * h : 0.012 * (a.coop + b.coop) / 2 - 0.004;
    bump(a, b, d); bump(b, a, d);
    const gA = S._groupsById[ga], gB = S._groupsById[gb];
    for (const [x, y, gx, gy] of [[a, b, gA, gB], [b, a, gB, gA]]) {
      if (x.res > 0.45 && x.id !== gx.leader && (x.trust[y.id] || 0) > 0.25 && gy.pay > gx.pay * 1.2 && rnd(S) < 0.1) { join(S, x, gy, y.id); gy.poached = (gy.poached || 0) + 1; break; }
    }
  }
}

function produce(S) {
  const P = S.params, claims = new Map(), season = seasonOf(S.tick);
  const cropDrought = S.tick < S.drought ? 0.4 : 1;
  const cropScarcity = 1.2 - 0.5 * P.scarcity;
  const add = (n, c) => { if (!claims.has(n.id)) claims.set(n.id, { n, list: [] }); claims.get(n.id).list.push(c); };
  for (const g of S.groups) {
    const k = g.members.length, syn = (1 + P.synergy * 4 * (1 - Math.exp(-(k - 1) / 6))) / (1 + g.entropy);
    const n = nodeOf(S, g.target);
    const effortCost = 0.0012 * (1 + g.entropy * 0.7);
    if (!g.home) {
      const L = S._agentsById[g.leader];
      if (!n || !L || Math.hypot(L.x - n.x, L.y - n.y) > 90) continue;
      let E = 0;
      for (const id of g.members) { const m = S._agentsById[id], e = m.skill * m.energy; m.eff += e; E += e; m.energy -= effortCost; }
      add(n, { g, pot: 0.14 * E * syn });
      continue;
    }
    let gpot = 0, workers = 0;
    g._gath = [];
    const tm = 1 + 0.5 * Math.min(1, g.tools / Math.max(1, k * 0.6));
    const light = daylightHours(S.tick), homes = householdLoad(S, g); // the family's time budget (Ч2)
    for (const id of g.members) {
      const m = S._agentsById[id];
      if (m.haul || m._travel || m._workBlocked || (m.rite && S.tick < m.rite.until)) continue;
      const b = m._day = dayBudget(S, g, m, light, homes);
      const e = jobSkill(m, m.job) * m.energy * tm * b.f;
      let worked = false;
      if (m.job === 'gather') { if (n && within(m.x - n.x, m.y - n.y, 70)) { const pt = 0.12 * e * syn * HAUL; gpot += pt; g._gath.push([m, pt]); worked = true; } }
      else if (m.job === 'farm') {
        const f = g.fields[(m.slot || 0) % Math.max(1, g.fields.length)];
        if (f && season !== 0 && within(m.x - f.x, m.y - f.y, 30)) {
          const food = 0.34 * e * syn * f.fert * cropDrought * cropScarcity * HAUL;
          const v = farmYield(S, f, season, food, e);
          const ow = f.owner && S._agentsById[f.owner];
          if (g.land === 'private' && ow && ow.group === g.id) { if (ow === m) { m.wealth += v * 0.5; load(m, 'food', v * 0.5); } else { ow.wealth += v * 0.35; m.wealth += v * 0.15; load(m, 'food', v * 0.5); m.hired = S.tick; } }
          else load(m, 'food', v);
          worked = true;
        }
      } else if (m.job === 'wood') {
        const c = g.woodCell;
        if (c !== null && S.wood[c] > 1 && within(m.x - ((c % 50) * 20 + 10), m.y - (Math.floor(c / 50) * 20 + 10), 30)) { const v = 0.1 * e * syn * HAUL; S.wood[c] -= v; load(m, 'wood', v); worked = true; }
      } else if (m.job === 'build') {
        worked = !!g.site && workSite(S, g, m, e * syn);
      } else if (m.job === 'stone') {
        const c = g.stoneCell;
        if (c !== null && within(m.x - ((c % 50) * 20 + 10), m.y - (Math.floor(c / 50) * 20 + 10), 30)) { load(m, 'stone', 0.07 * e * syn * HAUL); worked = true; }
      } else if (m.job === 'craft') {
        const w = g.workshop || g.home;
        if (w && within(m.x - w.x, m.y - w.y, 26)) {
          const n0 = g.members.length, want = g.workshop && g.tools < n0 * 0.6 && g.wood >= 1 && g.stone >= 1 ? 'tools' : (g.pots || 0) < n0 * 0.5 ? 'pots' : (g.goats || 0) >= 4 && (g.cloth || 0) < n0 * 0.6 ? 'cloth' : g.workshop && g.wood >= 1 && g.stone >= 1 && g.tools < n0 * 1.2 ? 'tools' : null;
          if (want) {
            g.craftProg = (g.craftProg || 0) + e * syn; worked = true; m.craftKind = want;
            if (g.craftProg >= 25) {
              g.craftProg -= 25; m.made = (m.made || 0) + 2;
              if (want === 'tools') { g.wood -= 1; g.stone -= 1; g.tools += 2; }
              else if (want === 'pots') g.pots = (g.pots || 0) + 3;
              else { g.cloth = (g.cloth || 0) + 2; }
            }
          }
        }
      }
      if (worked) {
        m.eff += e; m.energy -= effortCost * b.f; workers++;
        const before = m.xp[m.job] || 0; m.xp[m.job] = before + 0.0009;
        if (before < 1 && m.xp[m.job] >= 1) { m.master = m.job; bio(S, m, 'master', `Становится мастером: ${TITLE[m.job]}${m.teacherName ? `, как ${m.sex === 'f' ? 'её' : 'его'} учитель ${m.teacherName}` : ''}`); if (!S.masters) S.masters = {}; if (!S.masters[m.job]) { S.masters[m.job] = 1; log(S, 'tech', `${m.name} становится первым в мире: ${TITLE[m.job]}`, m.x, m.y, g.hue, { why: `Три года одной и той же работы. Опыт поднимает выработку на 60%, поэтому вождь ставит мастера на его дело в первую очередь. Так рождается специализация.`, who: [m.id], gs: [g.id] }); } }
      }
    }
    if (g.tools > 0) g.tools = Math.max(0, g.tools - workers * 0.0014);
    if (gpot > 0 && n) add(n, { g, pot: gpot });
  }
  for (const a of S.agents) {
    if (a.group) continue;
    const n = nodeOf(S, a.tnode); if (!n || Math.hypot(a.x - n.x, a.y - n.y) > 75) continue;
    const e = a.skill * a.energy; a.eff += e; a.energy -= 0.0012;
    add(n, { a, pot: 0.13 * e });
  }
  for (const { n, list } of claims.values()) {
    const tot = list.reduce((s, c) => s + c.pot, 0), f = tot > n.amt ? n.amt / tot : 1;
    n.amt -= tot * f;
    const gs = list.filter(c => c.g);
    for (const c of list) {
      const v = c.pot * f;
      if (c.g) {
        if (c.g.home && c.g._gath && c.g._gath.length) { const tot2 = c.g._gath.reduce((s2, x) => s2 + x[1], 0) || 1; for (const [m, pt] of c.g._gath) load(m, 'food', v * pt / tot2); }
        else c.g.treasury += v;
        if (gs.length > 1) { c.g.rivals = c.g.rivals || {}; for (const o of gs) if (o !== c) c.g.rivals[o.g.id] = (c.g.rivals[o.g.id] || 0) + (1.2 - f); }
      }
      else c.a.wealth += v;
    }
  }
}

function lifecycle(S) {
  const dead = [], winter = seasonOf(S.tick) === 0;
  for (const a of S.agents) {
    a.age += 1 / 360;
    a.wealth -= a.age < 18 ? 0.025 : 0.033;
    // light hunger wears one down slowly, deep hunger fast; the deficit is not a debt that grows without end
    if (a.wealth < -1.5) a.wealth = -1.5;
    if (a.wealth < 0) a.energy -= 0.0004 + 0.0004 * Math.min(1, -a.wealth / 1.5); else a.energy += 0.003 * (1.05 - a.energy);
    const gq = a.group && S._groupsById[a.group]; if (gq && gq.home) { if (gq.thirst) a.energy -= 0.0016; else if (gq.wShort > 1) a.energy -= 0.0012; }
    if (winter) { if (a.shel && a.group) a.energy += 0.0004; else a.energy -= 0.0008; }
    a.energy = clamp(a.energy, 0, 1);
    if (a.age > a.life) dead.push([a, 'death']);
    else if (a.energy < 0.03) dead.push([a, 'burnout']);
    else {
      const roll = rnd(S), dirty = gq?.dirty || 0;
      // At age 80 or less and dirt at most 1.5, the maximum daily risk is below 0.004.
      if ((roll < 0.004 || a.age > 80 || dirty > 1.5) &&
          roll < (0.004 + 0.0013 * Math.exp((a.age - 25) / 11)) / 360 *
            (a.energy < 0.3 ? 1.5 : 1) *
            (winter ? (a.group && (gq?.cloth || 0) >= (gq?.members.length || 0) * 0.5 ? 1.05 : 1.25) : 0.9) *
            (1 + 1.6 * dirty)) dead.push([a, 'sick']);
    }
  }
  for (const [a, why] of dead) removeAgent(S, a, why);
}

function removeAgent(S, a, why, departure) {
  if (!S._a.has(a.id)) return;
  if (why !== 'move' && why !== 'emigr') houseOwnerDies(S, a);
  if (S.ageAudit) noteAgeExit(S, a, why);
  S.stats[why] = (S.stats[why] || 0) + 1;
  if (why === 'emigr' || why === 'move') goalsOnDeath(S, a, why, departure);
  if (why === 'emigr') legend(S, a, 'emigr');
  if (why !== 'move' && why !== 'emigr') {
    const DW = { sick: 'Умирает от болезни', death: 'Умирает от старости', burnout: 'Умирает от истощения и голода', war: 'Гибнет в бою', plague: 'Умирает от мора', drown: 'Тонет при переправе', lostAtSea: 'Уходит в море на лодке и не возвращается', killed: a.sex === 'f' ? 'Убита' : 'Убит' };
    if (why !== 'killed') bio(S, a, why === 'drown' || why === 'lostAtSea' ? 'drowned' : 'death', `${DW[why] || 'Умирает'}${a.age ? `, ${Math.floor(a.age)} ${pl(Math.floor(a.age), 'год', 'года', 'лет')}` : ''}`);
    const sp0 = a.spouse && S._a.get(a.spouse); if (sp0) bio(S, sp0, 'spouseDied', `${a.sex === 'f' ? 'Умирает жена' : 'Умирает муж'} ${a.name}${why === 'war' ? ', в бою' : why === 'lostAtSea' ? ', в море' : why === 'plague' ? ', от мора' : why === 'killed' ? ', убит' : ''}`);
    if (sp0) sp0.widowT = S.tick;
    { const fev = funeral(S, a, why); if (fev && sp0) refLast(S, sp0, 'spouseDied', fev); goalsOnDeath(S, a, why, fev); }
    legend(S, a, why);
    const kids = S.agents.filter(o => o !== a && (o.mother === a.id || o.father === a.id)), sp = a.spouse && S._a.get(a.spouse);
    const w = Math.max(0, a.wealth), g = S._g.get(a.group);
    if (kids.length) { for (const k of kids) { k.wealth += w * (sp ? 0.7 : 1) / kids.length; if (w / kids.length > 12) bio(S, k, 'inherit', `Наследует от ${a.sex === 'f' ? 'матери' : 'отца'} ${nameCase(a, 'genitive')} запас ${Math.round(w * (sp ? 0.7 : 1) / kids.length)}`); } if (sp) sp.wealth += w * 0.3; }
    else if (sp) sp.wealth += w; else if (g) g.treasury += w * 0.5;
    if (sp) sp.spouse = null;
    const heir = kids.filter(k => k.group === a.group).sort((x, y) => y.age - x.age)[0];
    for (const o of S.agents) if (o.patron === a.id) o.patron = heir && rnd(S) < 0.6 ? heir.id : null;
  }
  if (a.group) leave(S, a, why);
  S.agents = S.agents.filter(x => x !== a); S._a.delete(a.id); S._agentsById[a.id] = undefined;
}

function inflow(S) {
  if (S.isle) return; // on the island newcomers arrive only by boat
  const P = S.params, pop = S.agents.length;
  const p = P.inflow * 2.5 / 360 * (popOf(S) > 450 ? 0.2 : 1);
  if (rnd(S) >= p) return;
  if (false) {
    let tot = 0; const w = S.groups.map(g => { const v = Math.max(0.1, g.pay) * g.members.length * (1 + Math.min(2, g.treasury / (g.members.length * 12 + 1))) * (g.home ? 1.3 : 1); tot += v; return v; });
    let r = rnd(S) * tot, g = S.groups[0];
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { g = S.groups[i]; break; } }
    const parent = S._a.get(g.members[Math.floor(rnd(S) * g.members.length)]);
    if (parent) spawn(S, 'child', { parent });
  } else spawn(S, 'out');
}

