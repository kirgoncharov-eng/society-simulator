function step(S) {
  S.tick++;
  if (!S.wear) navInit(S);
  if (!S.springs) springsInit(S);
  { const d = S.tick % 360, fr = d >= 12 && d < 78; if (fr !== S.frozen) { S.frozen = fr; S.navV++; } }
  const P = S.params;
  const reg = 0.38 * (1.25 - P.scarcity) * (S.tick < S.drought ? 0.3 : 1) * (seasonOf(S.tick) === 0 ? 0.45 : 1.15);
  const regF = 0.38 * (1.25 - P.scarcity) * 1.9;
  for (const n of S.nodes) n.amt = Math.min(n.cap, n.amt + (n.kind === 'fish' ? regF : reg * 1.25));
  for (const g of S.groups) {
    let sx = 0, sy = 0;
    for (const id of g.members) { const m = S._a.get(id); sx += m.x; sy += m.y; }
    g.cx = sx / g.members.length; g.cy = sy / g.members.length;
    if (g.home) { g.cx = g.home.x; g.cy = g.home.y; }
  }
  move(S);
  deliver(S);
  caravans(S);
  wars(S);
  if (S.tick % 6 === 0) patrol(S);
  produce(S);
  lifecycle(S);
  if (S.tick % 30 === 0) monthly(S);
  inflow(S);
}

function nodeOf(S, id) { for (const n of S.nodes) if (n.id === id) return n; return null; }

function move(S) {
  const A = S.agents;
  for (const a of A) {
    let tx, ty;
    const gH = a.group && S._g.get(a.group);
    const wp = a.war ? warTarget(S, a) : null;
    const cp = !wp && a.car ? carTarget(S, a) : null;
    if (wp) { tx = wp.x + ((a.id * 7) % 15 - 7); ty = wp.y + ((a.id * 11) % 15 - 7); }
    else if (cp) { tx = cp.x + ((a.id * 7) % 9 - 4); ty = cp.y + ((a.id * 11) % 9 - 4); }
    else if (gH && gH.home) {
      const g = gH, j = ((a.id * 37) % 13) - 6, j2 = ((a.id * 53) % 11) - 5;
      let p = null;
      if (a.haul && a.load) p = storeOf(g, a.lk);
      else if (a.job === 'farm' && g.fields.length) p = g.fields[(a.slot || 0) % g.fields.length];
      else if (a.job === 'wood' && g.woodCell !== null) p = { x: (g.woodCell % 50) * 20 + 10, y: Math.floor(g.woodCell / 50) * 20 + 10 };
      else if (a.job === 'build' && g.site) p = g.site;
      else if (a.job === 'stone' && g.stoneCell !== null) p = { x: (g.stoneCell % 50) * 20 + 10, y: Math.floor(g.stoneCell / 50) * 20 + 10 };
      else if (a.job === 'craft') p = g.workshop || g.home;
      else if (a.job === 'pray' && g.shrine) p = g.shrine;
      else if (a.job === 'fish' && g.landing) p = { x: g.landing.x + ((a.id * 7) % 9) - 4, y: g.landing.y + ((a.id * 3) % 9) - 4 };
      else if (a.job === 'herd' && g.pasture) p = { x: g.pasture.x + Math.cos(S.tick / 90 + a.id) * 22, y: g.pasture.y + Math.sin(S.tick / 90 + a.id) * 22 };
      else if (a.job === 'water' && g.wsrc) { const tgt = a.wc ? g.home : g.wsrc; if (Math.hypot(a.x - tgt.x, a.y - tgt.y) < 14) a.wc = !a.wc; p = a.wc ? g.home : g.wsrc; }
      else if (a.job === 'guard') {
        const bc = g.bcells || [];
        if (bc.length && a.id % 3 !== 0) { const c = bc[(a.id * 7 + Math.floor(S.tick / 160)) % bc.length]; p = { x: (c % 50) * 20 + 10, y: Math.floor(c / 50) * 20 + 10 }; }
        else { const ang = a.id * 1.7 + S.tick / 140, r = g.walls ? wallR(g) : 34; p = { x: g.home.x + Math.cos(ang) * r, y: g.home.y + Math.sin(ang) * r }; }
      }
      else if (a.job === 'gather') p = nodeOf(S, g.target);
      if (!p || a.role === 'leader' || a.job === 'lead') { const ang = a.id * 2.39996, r = a.role === 'leader' ? 4 : 10 + (a.id % 4) * 6; p = { x: g.home.x + Math.cos(ang) * r, y: g.home.y + Math.sin(ang) * r }; }
      tx = p.x + j * (a.job === 'gather' ? 3 : 1.2); ty = p.y + j2 * (a.job === 'gather' ? 3 : 1.2);
    } else if (a.group) {
      const g = S._g.get(a.group);
      if (a.role === 'leader') {
        const n = nodeOf(S, g.target);
        const ga = g.id * 2.39996;
        tx = n ? n.x + Math.cos(ga) * 40 : g.cx; ty = n ? n.y + Math.sin(ga) * 40 : g.cy;
        tx += Math.sin(S.tick / 47 + a.id) * 12; ty += Math.cos(S.tick / 53 + a.id) * 12;
      } else {
        const b = S._a.get(a.boss) || S._a.get(g.leader);
        const ang = (a.id * 2.39996) % (Math.PI * 2) + Math.sin(S.tick / 90 + a.id) * 0.4;
        const r = 26 + (a.id % 3) * 9;
        tx = b.x + Math.cos(ang) * r; ty = b.y + Math.sin(ang) * r;
      }
    } else {
      let n = nodeOf(S, a.tnode);
      if (!n || n.amt < 4 || (S.tick + a.id) % 90 === 0) {
        let bv = -1;
        for (const q of S.nodes) { const v = (q.amt + 2) / (1 + Math.hypot(q.x - a.x, q.y - a.y) / 110) * (0.7 + rnd(S) * 0.6) * (S.own && S.own[cellAt(q.x, q.y)] ? 0.4 : 1); if (v > bv) { bv = v; n = q; } }
        a.tnode = n ? n.id : null;
      }
      tx = n ? n.x + Math.cos(a.id) * 22 : a.x; ty = n ? n.y + Math.sin(a.id) * 22 : a.y;
    }
    if (S.ter[cellAt(a.x, a.y)] === 's' || (S.ter[cellAt(a.x, a.y)] === 'w' && !passCost(S, cellAt(a.x, a.y)))) toLand(S, a);
    const ca = cellAt(a.x, a.y), ct = cellAt(tx, ty); let onPath = false;
    if (ca !== ct) {
      const far = Math.abs(ca % N - ct % N) + Math.abs(((ca / N) | 0) - ((ct / N) | 0)) > 2;
      const bk = ca * 2500 + ct; if (a.bkK !== bk || a.bkV !== S.navV) { a.bkK = bk; a.bkV = S.navV; a.bkR = !far && blocked(S, a.x, a.y, tx, ty); }
      if (far || a.bkR) { const wp = navStep(S, a, ca, ct); if (wp) { tx = wp.x; ty = wp.y; a.stuck = 0; onPath = far; } else { tx = a.x; ty = a.y; a.stuck = (a.stuck || 0) + 1; } }
    }
    const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy) || 1, pc = passCost(S, ca) || 3;
    const sp = Math.min(d, 2.4 * (0.5 + a.energy) * (a.car ? 1.6 : 1) / Math.pow(Math.max(0.5, pc), 0.4));
    let nx = a.x + dx / d * sp + gauss(S) * 0.5, ny = a.y + dy / d * sp + gauss(S) * 0.5;
    const nc = cellAt(nx, ny);
    if (nc !== ca && !passCost(S, nc)) { nx = a.x; ny = a.y; }
    a.x = nx; a.y = ny;
    if (sp > 1.1) S.wear[nc] += a.car ? 7 : a.war ? 3 : onPath ? 2.5 : 1;
    if (nc !== a.lc) {
      if (S.ter[nc] === 'w' && !S.bridge[nc]) {
        const gg = a.group && S._g.get(a.group); if (gg) gg.cross = (gg.cross || 0) + 1;
        // a ford is dangerous in the spring flood and with a load on the back; thin ice at the start and end of winter
        const dy = S.tick % 360, flood = dy >= 90 && dy < 150, risk = S.frozen ? (dy < 20 || dy >= 70 ? 0.002 : 0.0004) : flood ? 0.008 : 0.00025;
        if (rnd(S) < risk * (a.car ? 3 : 1) * (a.age > 55 ? 1.5 : 1)) (S._drown || (S._drown = [])).push(a);
      }
      a.lc = nc;
    }
  }
  if (S._drown && S._drown.length) { for (const a of S._drown) drown(S, a); S._drown = []; }
  const X = A.slice().sort((p, q) => p.x - q.x);
  for (let i = 0; i < X.length; i++) {
    const a = X[i];
    for (let j = i + 1; j < X.length; j++) {
      const b = X[j], dx = b.x - a.x, dy = b.y - a.y;
      if (dx > 55) break;
      if (dy > 55 || dy < -55) continue;
      const d2 = dx * dx + dy * dy;
      if (d2 < 81) { const d = Math.sqrt(d2) || 1, f = (9 - d) * 0.25 / d; a.x -= dx * f; a.y -= dy * f; b.x += dx * f; b.y += dy * f; }
      if (d2 < 3025 && rnd(S) < 0.02) interact(S, a, b);
    }
  }
  for (const a of A) { a.x = clamp(a.x, 6, 994); a.y = clamp(a.y, 6, 994); }
}

function bump(a, b, d) { a.trust[b.id] = clamp((a.trust[b.id] || 0) + d, -1, 1); }
function allied(S, x, y) { return S.alliances.some(al => (al.a === x && al.b === y) || (al.a === y && al.b === x)); }

function interact(S, a, b) {
  if (!S._a.has(a.id) || !S._a.has(b.id)) return;
  const ga = a.group, gb = b.group;
  if (a.trust[b.id] === undefined) a.trust[b.id] = 0.25 * (b.rep || 0);
  if (b.trust[a.id] === undefined) b.trust[a.id] = 0.25 * (a.rep || 0);
  if (ga && ga === gb) { const Lid = S._g.get(ga).leader; if (Lid !== a.id && Lid !== b.id) { const ta = a.trust[Lid] || 0, tb = b.trust[Lid] || 0, w = 0.05; if ((a.trust[b.id] || 0) > 0.1) a.trust[Lid] = ta + (tb - ta) * w; if ((b.trust[a.id] || 0) > 0.1) b.trust[Lid] = tb + (ta - tb) * w; } }
  if (ga && ga === gb) {
    const d = 0.025 * (a.coop + b.coop) / 2 - 0.012 * (a.res + b.res) / 2;
    bump(a, b, d); bump(b, a, d);
    const g = S._g.get(ga);
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
      log(S, 'found', `${L.name} и ${o.name} основывают «${g.name}»`, L.x, L.y, g.hue, { why: `Доверие между ними выросло выше порога, а вместе они добывают больше, чем поодиночке. Лидером становится ${L.name}: у него больше амбиций.`, who: [L.id, o.id], gs: [g.id] });
    }
  } else if (!ga || !gb) {
    const s = ga ? b : a, m = ga ? a : b, g = S._g.get(m.group), L = S._a.get(g.leader);
    bump(s, m, 0.035 * s.coop + 0.008); bump(m, s, 0.02 * m.coop);
    const open = 0.18 + 0.5 * L.coop - 0.004 * g.members.length;
    if ((s.trust[m.id] || 0) > (s.wealth < 1 ? 0.12 : 0.22) && rnd(S) < open * (s.wealth < 1 ? 0.9 : 0.5)) { join(S, s, g, m.id); s.trust[g.leader] = Math.max(s.trust[g.leader] || 0, 0.1); }
  } else {
    const h = S.hostility[key(ga, gb)] || 0, al = allied(S, ga, gb);
    const d = al ? 0.02 : h > 0.4 ? -0.03 * h : 0.012 * (a.coop + b.coop) / 2 - 0.004;
    bump(a, b, d); bump(b, a, d);
    const gA = S._g.get(ga), gB = S._g.get(gb);
    for (const [x, y, gx, gy] of [[a, b, gA, gB], [b, a, gB, gA]]) {
      if (x.res > 0.45 && x.id !== gx.leader && (x.trust[y.id] || 0) > 0.25 && gy.pay > gx.pay * 1.2 && rnd(S) < 0.1) { join(S, x, gy, y.id); gy.poached = (gy.poached || 0) + 1; break; }
    }
  }
}

function produce(S) {
  const P = S.params, claims = new Map(), season = seasonOf(S.tick);
  const add = (n, c) => { if (!claims.has(n.id)) claims.set(n.id, { n, list: [] }); claims.get(n.id).list.push(c); };
  for (const g of S.groups) {
    const k = g.members.length, syn = (1 + P.synergy * 4 * (1 - Math.exp(-(k - 1) / 6))) / (1 + g.entropy);
    const n = nodeOf(S, g.target), L = S._a.get(g.leader);
    if (!g.home) {
      if (!n || !L || Math.hypot(L.x - n.x, L.y - n.y) > 90) continue;
      let E = 0;
      for (const id of g.members) { const m = S._a.get(id), e = m.skill * m.energy; m.eff += e; E += e; m.energy -= 0.0012 * (1 + g.entropy * 0.7); }
      add(n, { g, pot: 0.14 * E * syn });
      continue;
    }
    let gpot = 0, workers = 0;
    g._gath = [];
    const tm = 1 + 0.5 * Math.min(1, g.tools / Math.max(1, k * 0.6));
    for (const id of g.members) {
      const m = S._a.get(id), e = jobSkill(m, m.job) * m.energy * tm;
      let worked = false;
      if (m.haul) continue;
      if (m.job === 'gather') { if (n && Math.hypot(m.x - n.x, m.y - n.y) < 70) { const pt = 0.12 * e * syn * HAUL; gpot += pt; g._gath.push([m, pt]); worked = true; } }
      else if (m.job === 'farm') {
        const f = g.fields[(m.slot || 0) % Math.max(1, g.fields.length)];
        if (f && season !== 0 && Math.hypot(m.x - f.x, m.y - f.y) < 30) {
          const v = 0.34 * e * syn * f.fert * (S.tick < S.drought ? 0.4 : 1) * (1.2 - 0.5 * P.scarcity) * HAUL;
          const ow = f.owner && S._a.get(f.owner);
          if (g.land === 'private' && ow && ow.group === g.id) { if (ow === m) { m.wealth += v * 0.5; load(m, 'food', v * 0.5); } else { ow.wealth += v * 0.35; m.wealth += v * 0.15; load(m, 'food', v * 0.5); m.hired = S.tick; } }
          else load(m, 'food', v);
          worked = true;
        }
      } else if (m.job === 'wood') {
        const c = g.woodCell;
        if (c !== null && S.wood[c] > 1 && Math.hypot(m.x - ((c % 50) * 20 + 10), m.y - (Math.floor(c / 50) * 20 + 10)) < 30) { const v = 0.1 * e * syn * HAUL; S.wood[c] -= v; load(m, 'wood', v); worked = true; }
      } else if (m.job === 'build') {
        const st = g.site;
        if (st && Math.hypot(m.x - st.x, m.y - st.y) < 26) { st.prog += e * syn; worked = true; if (st.prog >= st.need) finishSite(S, g); }
      } else if (m.job === 'stone') {
        const c = g.stoneCell;
        if (c !== null && Math.hypot(m.x - ((c % 50) * 20 + 10), m.y - (Math.floor(c / 50) * 20 + 10)) < 30) { load(m, 'stone', 0.07 * e * syn * HAUL); worked = true; }
      } else if (m.job === 'craft') {
        const w = g.workshop || g.home;
        if (w && Math.hypot(m.x - w.x, m.y - w.y) < 26) {
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
        m.eff += e; m.energy -= 0.0012 * (1 + g.entropy * 0.7); workers++;
        const before = m.xp[m.job] || 0; m.xp[m.job] = before + 0.0009;
        if (before < 1 && m.xp[m.job] >= 1) { m.master = m.job; bio(S, m, 'master', `Становится мастером: ${TITLE[m.job]}${m.teacherName ? `, как ${m.sex === 'f' ? 'её' : 'его'} учитель ${m.teacherName}` : ''}`); if (!S.masters) S.masters = {}; if (!S.masters[m.job]) { S.masters[m.job] = 1; log(S, 'tech', `${m.name} становится первым в мире: ${TITLE[m.job]}`, m.x, m.y, g.hue, { why: `Три года одной и той же работы. Опыт поднимает выработку на 60%, поэтому лидер ставит мастера на его дело в первую очередь. Так рождается специализация.`, who: [m.id], gs: [g.id] }); } }
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
    if (a.wealth < -1.5) a.wealth = -1.5; // hunger is what one lacks now, not a debt that grows without end
    if (a.wealth < 0) a.energy -= 0.0008; else a.energy += 0.003 * (1.05 - a.energy);
    const gq = a.group && S._g.get(a.group); if (gq && gq.home) { if (gq.thirst) a.energy -= 0.0016; else if (gq.wShort > 1) a.energy -= 0.0012; }
    if (winter) { if (a.shel && a.group) a.energy += 0.0004; else a.energy -= 0.0008; }
    a.energy = clamp(a.energy, 0, 1);
    if (a.age > a.life) dead.push([a, 'death']);
    else if (a.energy < 0.03) dead.push([a, 'burnout']);
    else if (rnd(S) < (0.004 + 0.0013 * Math.exp((a.age - 25) / 11)) / 360 * (a.energy < 0.3 ? 1.5 : 1) * (winter ? (a.group && ((S._g.get(a.group) || {}).cloth || 0) >= ((S._g.get(a.group) || {}).members || []).length * 0.5 ? 1.05 : 1.25) : 0.9) * (1 + 1.6 * ((a.group && (S._g.get(a.group) || {}).dirty) || 0))) dead.push([a, 'sick']);
  }
  for (const [a, why] of dead) removeAgent(S, a, why);
}

function removeAgent(S, a, why) {
  if (!S._a.has(a.id)) return;
  S.stats[why] = (S.stats[why] || 0) + 1;
  if (why === 'emigr') legend(S, a, 'emigr');
  if (why !== 'move' && why !== 'emigr') {
    const DW = { sick: 'Умирает от болезни', death: 'Умирает от старости', burnout: 'Умирает от истощения и голода', war: 'Гибнет в бою', plague: 'Умирает от мора', drown: 'Тонет при переправе', killed: a.sex === 'f' ? 'Убита' : 'Убит' };
    if (why !== 'killed') bio(S, a, why === 'drown' ? 'drowned' : 'death', `${DW[why] || 'Умирает'}${a.age ? `, ${Math.floor(a.age)} ${pl(Math.floor(a.age), 'год', 'года', 'лет')}` : ''}`);
    const sp0 = a.spouse && S._a.get(a.spouse); if (sp0) bio(S, sp0, 'spouseDied', `${a.sex === 'f' ? 'Умирает жена' : 'Умирает муж'} ${a.name}${why === 'war' ? ', в бою' : why === 'plague' ? ', от мора' : why === 'killed' ? ', убит' : ''}`);
    legend(S, a, why);
    const kids = S.agents.filter(o => o !== a && (o.mother === a.id || o.father === a.id)), sp = a.spouse && S._a.get(a.spouse);
    const w = Math.max(0, a.wealth), g = S._g.get(a.group);
    if (kids.length) { for (const k of kids) { k.wealth += w * (sp ? 0.7 : 1) / kids.length; if (w / kids.length > 12) bio(S, k, 'inherit', `Наследует от ${a.sex === 'f' ? 'матери' : 'отца'} ${a.name} запас ${Math.round(w * (sp ? 0.7 : 1) / kids.length)}`); } if (sp) sp.wealth += w * 0.3; }
    else if (sp) sp.wealth += w; else if (g) g.treasury += w * 0.5;
    if (sp) sp.spouse = null;
    const heir = kids.filter(k => k.group === a.group).sort((x, y) => y.age - x.age)[0];
    for (const o of S.agents) if (o.patron === a.id) o.patron = heir && rnd(S) < 0.6 ? heir.id : null;
  }
  if (a.group) leave(S, a, why);
  S.agents = S.agents.filter(x => x !== a); S._a.delete(a.id);
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

