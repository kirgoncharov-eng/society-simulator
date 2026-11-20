/* ---------- water: springs, river, wells, drought, dirty water ---------- */
function springsInit(S) {
  S.springs = [];
  const cand = [];
  for (let c = 0; c < N * N; c++) {
    const t = S.ter[c]; if (t === 'w' || t === 'h' || t === 's' || t === 'b') continue;
    const cx = c % N, cy = (c / N) | 0; let hill = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < N && y < N && S.ter[y * N + x] === 'h') hill++; }
    if (hill >= 2) cand.push(c);
  }
  for (let t = 0; t < 400 && S.springs.length < 9 && cand.length; t++) {
    const c = cand[Math.floor(rnd(S) * cand.length)], x = (c % N) * CS + 10, y = ((c / N) | 0) * CS + 10;
    if (S.springs.some(p => Math.hypot(p.x - x, p.y - y) < 140) || riverDist(S, x, y) < 120) continue;
    S.springs.push({ id: S.nextId++, c, x, y, big: rnd(S) < 0.35, dry: false });
  }
}
function wellOk(S, x, y) { const t = S.ter[cellAt(x, y)], rd = riverDist(S, x, y); return t === 'r' || rd < 160 ? 0.95 : t === 'g' ? 0.6 : t === 'f' ? 0.55 : 0.25; }
function waterSrc(S, g) {
  const o = g.home; let best = null, bd = 1e9;
  if (g.well && !g.well.dry) { best = { x: g.well.x, y: g.well.y, kind: 'well' }; bd = Math.hypot(g.well.x - o.x, g.well.y - o.y); }
  for (const sp of S.springs || []) { if (sp.dry) continue; const d = Math.hypot(sp.x - o.x, sp.y - o.y); if (d < bd && reach(S, o.x, o.y, sp.x, sp.y)) { bd = d; best = { x: sp.x, y: sp.y, kind: 'spring', id: sp.id }; } }
  const r = S.river; if (r) { const k = clamp(Math.round((o.y + 20) / 20), 0, r.length - 1), rx = r[k][0], bx = rx + (o.x < rx ? -22 : 22), d = Math.abs(o.x - bx); if (d < bd && reach(S, o.x, o.y, bx, o.y)) { bd = d; best = { x: bx, y: o.y, kind: 'river' }; } }
  if (best) best.d = bd;
  return best;
}
function waterMonth(S) {
  const yr = Math.floor(S.tick / 360), dr = S.tick < (S.drought || 0) && seasonOf(S.tick) >= 1;
  for (const sp of S.springs || []) { const was = sp.dry; sp.dry = dr && !sp.big ? true : dr && sp.big ? sp.dry || rnd(S) < 0.08 : false; if (!dr) sp.dry = false; sp.justDried = !was && sp.dry; }
  for (const g of S.groups) {
    if (!g.home || g.dead) continue;
    if (g.well) g.well.dry = dr && g.well.depth < 1 && (g.well.dryRoll = (g.well.dryRoll === undefined ? rnd(S) : g.well.dryRoll)) < 0.45;
    if (!dr && g.well) g.well.dryRoll = undefined;
    const src = waterSrc(S, g), n = g.members.length;
    g.wsrc = src; g.wd = src ? src.d : 9999;
    g.wNeed = src ? Math.round(n * clamp((src.d - 30) / 480, 0, 0.35) * ((g.pots || 0) >= n * 0.5 ? 0.8 : 1)) : Math.ceil(n * 0.4);
    if (src && src.kind === 'river') { let up = 0; for (const o of S.groups) if (o !== g && o.home && o.wsrc && o.wsrc.kind === 'river' && o.home.y < g.home.y && g.home.y - o.home.y < 260 && Math.abs(o.home.x - g.home.x) < 200) up += o.members.length; g.dirty = Math.min(1.5, up / 90); }
    else if (src && src.kind === 'well') g.dirty = Math.min(1.2, Math.max(0, (n - 22) / 40) + (S.tick - g.well.t) / (360 * 120));
    else g.dirty = 0;
    if (!src || g.wd > 600) { g.thirst = (g.thirst || 0) + 1; if (g.thirst === 2 && (g.thirstLog || 0) < yr) { g.thirstLog = yr + 2; log(S, 'thirst', `В «${g.name}» нет воды`, g.home.x, g.home.y, g.hue, { why: sent([dr ? 'засуха: ближние родники пересохли' : 'поблизости нет ни реки, ни родника', g.well ? 'колодец пересох' : 'колодца нет', 'люди слабеют от жажды и думают, куда уйти']), gs: [g.id] }); } }
    else g.thirst = 0;
    if (g.wNeed > 0 && (g.wGot || 0) < g.wNeed) g.wShort = (g.wShort || 0) + 1; else g.wShort = 0;
    // wells
    const L = S._a.get(g.leader);
    if (!g.site && !g.well && L && n >= 5 && g.wd > 110 && g.wood >= 4 && (g.wTry || 0) < S.tick && seasonOf(S.tick) !== 0) {
      g.wood -= 4; g.wTry = S.tick + 360 * 4; g.site = { kind: 'well', x: g.home.x + (planOf(S, g).uy * 10), y: g.home.y - (planOf(S, g).ux * 10), prog: 0, need: 60 + (wellOk(S, g.home.x, g.home.y) < 0.5 ? 60 : 0) };
    }
  }
  // drought conflicts over shared springs
  if (dr) for (const sp of S.springs || []) { const users = S.groups.filter(g => g.wsrc && g.wsrc.id === sp.id); for (let i = 0; i < users.length; i++) for (let j = i + 1; j < users.length; j++) { const k = key(users[i].id, users[j].id); S.hostility[k] = Math.min(2, (S.hostility[k] || 0) + 0.06); } }
}
function droughtYear(S) {
  if (S.tick < (S.drought || 0)) return;
  if (rnd(S) < 0.07) {
    S.drought = S.tick + 360; S.stats.droughts = (S.stats.droughts || 0) + 1;
    log(S, 'drought', 'Засушливый год: дождей нет, родники пересыхают', undefined, undefined, 30, { why: 'Малые родники уйдут до осени, мелкие колодцы тоже. Река обмелеет, броды станут безопаснее. Урожай упадёт втрое, а деревни у одного родника начнут ссориться из-за воды.' });
  }
}

