const cellVal = (S, c) => { const t = S.ter[c]; return t === 'r' ? 3 : t === 'f' ? 2 : t === 'h' ? 2 : t === 'g' ? 1 : 0.4; };
function claim(S, g, target, maxAdd) {
  if (!g.home) return;
  if (!S.own) S.own = new Array(N * N).fill(0);
  const own = S.own, mine = [];
  for (let c = 0; c < own.length; c++) if (own[c] === g.id) mine.push(c);
  if (!mine.length) { const hc = cellAt(g.home.x, g.home.y); if (own[hc]) return; own[hc] = g.id; mine.push(hc); }
  const nodeCells = new Set(S.nodes.map(n => cellAt(n.x, n.y)));
  let added = 0;
  while (mine.length < target && added < maxAdd) {
    let best = -1, bv = -1e9;
    const seen = new Set();
    for (const c of mine) for (const q of nb4(c)) {
      if (own[q] || seen.has(q)) continue; seen.add(q);
      const v = cellVal(S, q) + (nodeCells.has(q) ? 4 : 0) - Math.hypot((q % N) * CS + 10 - g.home.x, Math.floor(q / N) * CS + 10 - g.home.y) / 45;
      if (v > bv) { bv = v; best = q; }
    }
    if (best < 0) break;
    own[best] = g.id; mine.push(best); added++;
  }
  if (mine.length > target * 1.6) {
    mine.sort((p, q) => Math.hypot((q % N) * CS - g.home.x, Math.floor(q / N) * CS - g.home.y) - Math.hypot((p % N) * CS - g.home.x, Math.floor(p / N) * CS - g.home.y));
    for (let i = 0; i < 5 && i < mine.length; i++) if (!S.occ[mine[i]]) own[mine[i]] = 0;
  }
}
function territories(S) {
  if (!S.own) S.own = new Array(N * N).fill(0);
  for (const g of S.groups) if (g.home) claim(S, g, 16 + g.members.length * 3 + (g.walls ? 6 : 0), 8);
  const own = S.own, B = {}, cnt = {}, bc = {};
  for (let c = 0; c < own.length; c++) {
    const o = own[c]; if (!o) continue;
    cnt[o] = (cnt[o] || 0) + 1;
    for (const q of nb4(c)) { const p = own[q]; if (p !== o) { (bc[o] = bc[o] || []).push(c); if (p && q > c) { const k = key(o, p); B[k] = (B[k] || 0) + 1; } break; } }
  }
  S.borders = B;
  for (const g of S.groups) {
    g.terr = cnt[g.id] || 0;
    const cells = bc[g.id] || [];
    const hostile = cells.filter(c => nb4(c).some(q => own[q] && own[q] !== g.id && (S.hostility[key(g.id, own[q])] || 0) > 0.4));
    const hs = new Set(hostile); g.bcells = hostile.slice(0, 30).concat(cells.filter(c => !hs.has(c)).slice(0, 30));
  }
}
function patrol(S) {
  if (!S.own) return;
  S.borderLog = S.borderLog || {};
  for (const a of S.agents.slice()) {
    if (a.war || a.car || !S._a.has(a.id)) continue;
    const o = S.own[cellAt(a.x, a.y)]; if (!o || o === a.group) continue;
    if (a.group && (allied(S, a.group, o) || !['gather', 'wood', 'stone'].includes(a.job))) continue;
    const O = S._g.get(o); if (!O) continue;
    const G = a.group && S._g.get(a.group);
    if (G && G.lord === o) continue;
    let guard = null;
    for (const id of O.members) { const m = S._a.get(id); if (m && m.job === 'guard' && Math.hypot(m.x - a.x, m.y - a.y) < 90) { guard = m; break; } }
    if (!guard) continue;
    a.energy = Math.max(0.05, a.energy - 0.06); bump(a, guard, -0.15);
    S.stats.border = (S.stats.border || 0) + 1;
    const k = G ? key(o, G.id) : 'n' + o;
    S.patrolCool = S.patrolCool || {};
    if (G && (S.patrolCool[k] || 0) < S.tick) { S.patrolCool[k] = S.tick + 30; S.hostility[k] = Math.min(2, (S.hostility[k] || 0) + 0.04); }
    if (G) { if (a.job === 'gather') { G.avoid[G.target] = S.tick + 360; pickTarget(S, G); } else if (a.job === 'wood') G.woodCell = null; else if (a.job === 'stone') G.stoneDist = undefined; }
    else { a.tnode = null; a.x += (a.x - O.home.x) * 0.15; a.y += (a.y - O.home.y) * 0.15; }
    const kill = G && (S.hostility[k] || 0) > 1.2 && rnd(S) < 0.05;
    if ((S.borderLog[k] || 0) < S.tick || kill) {
      S.borderLog[k] = S.tick + 360 * 2;
      log(S, 'border', kill ? `Стычка на меже: стража «${O.name}» убивает ${a.name} из «${G.name}»` : `Стража «${O.name}» гонит ${G ? `людей «${G.name}»` : 'кочевников'} со своей земли`, a.x, a.y, O.hue, { why: sent([`${a.name} ${a.job === 'wood' ? 'рубил лес' : a.job === 'stone' ? 'ломал камень' : 'собирал и охотился'} на земле «${O.name}»`, `стражник ${guard.name} заметил чужака`, G ? `вражда между деревнями растёт: ${P0(Math.min(1, (S.hostility[k] || 0) / 2))}` : '', G ? `теперь «${G.name}» придётся искать ${a.job === 'gather' ? 'другие угодья' : a.job === 'wood' ? 'другой лес' : 'другие холмы'} или торговать` : '']), who: [a.id, guard.id], gs: [o, G && G.id].filter(Boolean) });
    }
    if (kill) removeAgent(S, a, 'war');
  }
}

function landTop(g) {
  if (g.land !== 'private' || !g.fields.length) return null;
  const cnt = {}; for (const f of g.fields) if (f.owner) cnt[f.owner] = (cnt[f.owner] || 0) + 1;
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  return top ? { id: +top[0], n: top[1], share: top[1] / g.fields.length, owners: Object.keys(cnt).length } : null;
}
