/* ---------- river of history ---------- */
let socHit = [];
function socDraw(W0, box, c, rcm) {
  if (!box || !c) return [];
  const dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(box.clientWidth * dpr), H = Math.round(box.clientHeight * dpr);
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const x = c.getContext('2d'); x.clearRect(0, 0, W, H);
  const L = 24 * dpr, Rm = 12 * dpr, T = 12 * dpr, B = 26 * dpr, pw = W - L - Rm, ph = H - T - B;
  const X = v => L + v * pw, Y = v => T + (1 - v) * ph;
  x.fillStyle = rgba(C.slate, C.dark ? .07 : .05); x.fillRect(X(0), Y(1), pw / 2, ph / 2); x.fillRect(X(.5), Y(.5), pw / 2, ph / 2);
  x.strokeStyle = rgba(C.rule, 1); x.lineWidth = 1; x.strokeRect(X(0), Y(1), pw, ph);
  x.setLineDash([3 * dpr, 4 * dpr]); x.beginPath(); x.moveTo(X(.5), Y(1)); x.lineTo(X(.5), Y(0)); x.moveTo(X(0), Y(.5)); x.lineTo(X(1), Y(.5)); x.stroke(); x.setLineDash([]);
  x.font = `500 ${12 * dpr}px Inter, system-ui, sans-serif`; x.fillStyle = C.muted;
  x.textAlign = 'left'; x.fillText('торговые общины', X(0) + 8 * dpr, Y(1) + 17 * dpr); x.fillText('воинские братства', X(0) + 8 * dpr, Y(0) - 9 * dpr);
  x.textAlign = 'right'; x.fillText('олигархии и княжества', X(1) - 8 * dpr, Y(1) + 17 * dpr); x.fillText('деспотии и державы', X(1) - 8 * dpr, Y(0) - 9 * dpr);
  x.textAlign = 'center'; x.font = `${12 * dpr}px Inter, system-ui, sans-serif`;
  x.fillText('власть у многих  ←  →  власть у немногих', X(.5), H - 7 * dpr);
  x.save(); x.translate(10 * dpr, Y(.5)); x.rotate(-Math.PI / 2); x.fillText('держится на силе  ←  →  на торговле', 0, 0); x.restore();
  const hits = [];
  const gs = W0.groups.filter(g => g.home && g.members.length >= 3 && rcm.get(g.id)).sort((a, b) => a.members.length - b.members.length);
  for (const g of gs) {
    const tr = g.rhist || []; if (tr.length < 2) continue;
    x.beginPath(); tr.forEach((p, i) => i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1]))); const r = rcm.get(g.id); x.lineTo(X(r.c), Y(r.b));
    x.lineJoin = 'round'; x.strokeStyle = hueC(g.hue, .45); x.lineWidth = 1.5 * dpr; x.stroke();
  }
  const placed = [];
  for (const g of gs.slice().reverse()) {
    const r = rcm.get(g.id), px = X(r.c), py = Y(r.b), rad = (4 + 2.2 * Math.sqrt(g.members.length)) * dpr;
    x.beginPath(); x.arc(px, py, rad, 0, 7); x.fillStyle = hueC(g.hue, .85); x.fill(); x.strokeStyle = C.bg; x.lineWidth = 1.5 * dpr; x.stroke();
    if (g.faith && W0.faiths && W0.faiths[g.faith]) { x.setLineDash([2 * dpr, 2 * dpr]); x.strokeStyle = hueC(W0.faiths[g.faith].hue, .9); x.beginPath(); x.arc(px, py, rad + 3.5 * dpr, 0, 7); x.stroke(); x.setLineDash([]); }
    hits.push({ x: px, y: py, r: rad + 4 * dpr, g });
    if (g.members.length < 5) continue;
    const t1 = g.name, t2 = r.type.toLowerCase();
    x.font = `600 ${12.5 * dpr}px Inter, system-ui, sans-serif`; const w1 = x.measureText(t1).width;
    x.font = `${12 * dpr}px Inter, system-ui, sans-serif`; const w2 = x.measureText(t2).width, w = Math.max(w1, w2);
    let lx = px + rad + 6 * dpr, align = 'left'; if (lx + w > W - 4 * dpr) { lx = px - rad - 6 * dpr; align = 'right'; }
    const left = align === 'left' ? lx : lx - w;
    if (placed.some(p => left < p.x + p.w && left + w > p.x && Math.abs(p.y - py) < 30 * dpr)) continue;
    placed.push({ x: left, y: py, w });
    x.textAlign = align; x.lineJoin = 'round';
    x.font = `600 ${12.5 * dpr}px Inter, system-ui, sans-serif`; x.strokeStyle = C.bg; x.lineWidth = 3 * dpr; x.strokeText(t1, lx, py - 2 * dpr); x.fillStyle = C.ink; x.fillText(t1, lx, py - 2 * dpr);
    x.font = `${12 * dpr}px Inter, system-ui, sans-serif`; x.strokeText(t2, lx, py + 12 * dpr); x.fillStyle = C.muted; x.fillText(t2, lx, py + 12 * dpr);
  }
  if (!gs.length) { x.textAlign = 'center'; x.fillStyle = C.muted; x.font = `${13 * dpr}px Inter, system-ui, sans-serif`; x.fillText('Оседлых обществ пока нет', X(.5), Y(.5)); }
  return hits;
}
function drawSoc() { if (!$('socbox').clientWidth) return; socHit = socDraw(S, $('socbox'), $('soc'), RC); }
let portKey = '';
function portraits(force) {
  const el = $('portraits'); if (!el) return;
  const gs = S.groups.filter(g => g.home && g.members.length >= 5).sort((a, b) => b.members.length - a.members.length).slice(0, 5);
  const k = gs.map(g => `${g.id}:${g.members.length}:${RC.get(g.id).type}:${g.leader}`).join('|') + (S.tick / 360 | 0) + (S.states || []).map(x => x.id + x.members.length).join(',');
  if (!force && k === portKey) return; portKey = k;
  const sts = (S.states || []).slice().sort((a, b) => b.pop - a.pop);
  const stHtml = `<div class="sts"><h3>Государства</h3>${sts.length ? sts.map(st2 => { const cap = S._g.get(st2.cap), L = cap && S._a.get(cap.leader); return `<button class="st" data-a="${cap ? cap.leader : ''}"><span class="ph"><i style="background:${hueC(st2.hue)}"></i><strong>${esc(st2.name)}</strong><em>${esc(st2.type.toLowerCase())}</em></span><span class="pl">Столица «${esc(cap ? cap.name : '?')}»${L ? `, правит ${esc(L.name)}` : ''} · ${st2.members.length} ${st2.members.length === 1 ? 'деревня' : st2.members.length < 5 ? 'деревни' : 'деревень'}, ${st2.pop} чел., ${st2.terr} клеток · ${yrsTxt(Math.max(1, Math.round((S.tick - st2.founded) / 360)))}${st2.members.length > 1 ? ` · ${esc(st2.members.map(id => (S._g.get(id) || {}).name).filter(Boolean).join(', '))}` : ''}</span></button>`; }).join('') : '<p class="empty">Государств пока нет: каждая деревня живёт сама по себе. Они появятся через дань, покровительство или долгий союз.</p>'}</div>`;
  if (!gs.length) { el.innerHTML = stHtml + '<p class="empty">Портреты появятся, когда хотя бы одна деревня дорастёт до пяти человек.</p>'; return; }
  el.innerHTML = stHtml + gs.map(g => {
    const r = RC.get(g.id), L = S._a.get(g.leader), mem = g.members.map(id => S._a.get(id)).filter(Boolean);
    const rich = mem.slice().sort((a, b) => b.wealth - a.wealth)[0], priest = mem.find(m => m.job === 'pray');
    const yrsL = Math.floor((S.tick - (g.since || g.founded)) / 360), age = Math.floor((S.tick - g.founded) / 360);
    const vass = S.groups.filter(o => o.lord === g.id), f = g.faith && S.faiths && S.faiths[g.faith], lord = g.lord && S._g.get(g.lord);
    const power = r.c > 0.6 ? 'сосредоточена наверху' : r.c < 0.35 ? 'размыта между многими' : 'распределена умеренно';
    const base = r.b > 0.62 ? 'торговле и ремесле' : r.b < 0.38 ? 'силе' : 'земле и урожае';
    const lines = [
      `Правит ${esc(L ? L.name : '?')}${yrsL ? ` ${yrsTxt(yrsL)}` : ', недавно'}${g.dynasty ? `, династия ${esc(g.dynName)}, ${g.dynGen}-е поколение` : ''}${L && L.wasPriest ? ', бывший жрец' : ''}${g.gen > 1 ? `; это ${g.gen}-й лидер` : ''}.`,
      `Власть ${power}: лидер берёт ${pct(g.take)}% добычи, ${g.depth} ур. управления, неравенство ${r.gi.toFixed(2)}, делят ${g.norm > 0.6 ? 'поровну' : g.norm < 0.4 ? 'по статусу' : 'смешанно'}.`,
      `Держится на ${base}${[g.trades ? `${g.trades} сделок` : '', g.workshop ? 'мастерская' : ''].filter(Boolean).length ? ': ' : ''}${[g.trades ? `${g.trades} сделок` : '', g.workshop ? 'мастерская' : ''].filter(Boolean).join(', ')}${g.warsWon || g.warsLost ? `, войн выиграно ${g.warsWon || 0}, проиграно ${g.warsLost || 0}` : ''}${vass.length ? `, данники: ${esc(vass.map(v => v.name).join(', '))}` : ''}${lord ? `; сама платит дань «${esc(lord.name)}»` : ''}.`,
      [f ? `Вера: ${esc(f.name)}${priest ? `, жрец ${esc(priest.name)}` : ''}` : 'Своей веры нет', g.code ? `закон: ${g.code === 'egal' ? 'всем равные доли' : 'доли по статусу'}` : 'писаных законов нет', rich && rich !== L && rich.wealth > (L ? L.wealth : 0) ? `самый богатый — ${rich.trades ? 'купец ' : ''}${esc(rich.name)}, а не лидер` : ''].filter(Boolean).join(' · ') + '.',
      (() => { const lt = SIM.landTop(g), T = lt && S._a.get(lt.id); return `Правление: ${g.gov === 'assembly' ? 'вече, решения принимает собрание' : g.gov === 'monarch' ? 'монарх' : 'вождь решает сам'} · Земля: ${g.land === 'private' ? `частная${T ? `, у ${esc(T.name)} ${lt.n} из ${g.fields.length} полей` : ''}` : 'общая'} · Владения: ${g.terr || 0} клеток.`; })(),
      g.coin ? (() => { const db = mem.filter(m => m.debt), bd = db.filter(m => m.bond), lend = mem.filter(m => m.loans).sort((a, b) => (b.loans || 0) - (a.loans || 0))[0], fb = f && f.usury === 'ban'; return `Деньги: в ходу монета${fb ? ', вера запрещает проценты' : ''} · должников ${db.length}${bd.length ? `, в кабале ${bd.length}` : ''}${lend ? ` · крупнейший заимодавец ${esc(lend.name)}` : ''}.`; })() : 'Денег нет: меняются товар на товар, богатство гниёт.',
      `Основана ${age ? `${yrsTxt(age)} назад` : 'в этом году'} основателем ${esc(g.founder)}; живёт ${g.members.length} чел. в ${g.houses.length} домах, энтропия ${g.entropy.toFixed(2)}.`
    ];
    return `<button class="por" data-a="${g.leader}"><span class="ph"><i style="background:${hueC(g.hue)}"></i><strong>${esc(g.name)}</strong><em>${esc(r.type)}</em></span>${lines.map(l => `<span class="pl">${l}</span>`).join('')}</button>`;
  }).join('');
}
$('soc').addEventListener('pointerdown', ev => {
  const c = $('soc'), r = c.getBoundingClientRect(), dpr = c.width / r.width, x = (ev.clientX - r.left) * dpr, y = (ev.clientY - r.top) * dpr;
  const h = socHit.filter(o => Math.hypot(o.x - x, o.y - y) < o.r).sort((a, b) => a.r - b.r)[0];
  if (h) { sel = h.g.leader; card(); plate.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }); }
});
let marketKey = '';
function drawMarket() {
  const box = $('market'), c = $('mk'); if (!box || !c || !box.clientWidth) return;
  const h = S.hist, n = (h.pf || []).length, dpr = Math.min(2, devicePixelRatio || 1);
  const W = Math.round(box.clientWidth * dpr), H = Math.round(box.clientHeight * dpr);
  const key = `${n}|${W}|${H}|${C.dark}|${S.stats.trades}`;
  if (key === marketKey) return; marketKey = key;
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const x = c.getContext('2d'); x.clearRect(0, 0, W, H);
  const P = S.price || {};
  $('mtxt').textContent = S.firstTrade ? `Сейчас за орудие дают ${(P.tools || 0).toFixed(1)} меры еды, за глыбу камня ${(P.stone || 0).toFixed(1)}, за бревно ${(P.wood || 0).toFixed(1)}. Сделок всего ${S.stats.trades}, торговых путей ${Object.keys(S.routes || {}).length}. ${S.groups.some(g => g.coin) ? `Монета в ходу у ${S.groups.filter(g => g.coin).length} дер.: между ними торговля идёт легче и крупнее.` : 'Монеты пока нет: торговля меновая.'}` : 'Торговли пока нет: деревням нечего предложить друг другу. Первые караваны тронутся, когда у кого-то появятся излишки.';
  if (n < 2 || !S.firstTrade) return;
  const k0 = Math.max(0, n - 240), series = [['food', h.pf, 'еда', C.dark ? '#d6b04e' : '#c79a2e'], ['wood', h.pw, 'бревно', C.dark ? '#b07a45' : '#8a5a2b'], ['stone', h.ps, 'камень', C.dark ? '#a8adb5' : '#7d8590'], ['tools', h.pt, 'орудие', C.slate]];
  const L = 34 * dpr, Rm = 78 * dpr, T = 10 * dpr, B = 20 * dpr, pw = W - L - Rm, ph = H - T - B;
  let mx = 1; for (const s of series) for (let i = k0; i < n; i++) mx = Math.max(mx, s[1][i] || 0);
  mx = Math.ceil(mx);
  const X = i => L + (i - k0) / Math.max(1, n - 1 - k0) * pw, Y = v => T + ph - v / mx * ph;
  x.font = `${12 * dpr}px Inter, system-ui, sans-serif`; x.fillStyle = C.muted; x.strokeStyle = rgba(C.rule, .9); x.lineWidth = 1; x.textAlign = 'right';
  const step = mx > 6 ? 2 : 1;
  for (let v = 0; v <= mx; v += step) { x.beginPath(); x.moveTo(L, Y(v)); x.lineTo(L + pw, Y(v)); x.stroke(); x.fillText(String(v), L - 6 * dpr, Y(v) + 4 * dpr); }
  x.textAlign = 'center';
  const lastT = Math.floor(S.tick / 30) * 30;
  for (let i = k0; i < n; i++) { const tk = lastT - (n - 1 - i) * 30; if (tk % 3600 === 0) x.fillText(`г.${tk / 360}`, X(i), H - 5 * dpr); }
  const ends = [];
  for (const [k, arr, label, col] of series) {
    x.beginPath(); for (let i = k0; i < n; i++) { const v = arr[i] || 0; i === k0 ? x.moveTo(X(i), Y(v)) : x.lineTo(X(i), Y(v)); }
    x.strokeStyle = col; x.lineWidth = 2 * dpr; x.stroke();
    ends.push({ y: Y(arr[n - 1] || 0), label: `${label} ${(arr[n - 1] || 0).toFixed(1)}`, col });
  }
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14 * dpr) ends[i].y = ends[i - 1].y + 14 * dpr;
  x.textAlign = 'left';
  for (const e of ends) { x.fillStyle = e.col; x.fillText(e.label, L + pw + 6 * dpr, Math.min(H - B, e.y) + 4 * dpr); }
}
function drawRiver() {
  if (!rv.width || !riverBox.clientWidth) return;
  const h = S.hist, gsH = h.gs || [], n = gsH.length;
  const key = `${n}|${rv.width}|${rv.height}|${S.evId}|${C.dark}`;
  if (key === riverKey) return;
  riverKey = key;
  const W = rv.width, H = rv.height, dpr = W / Math.max(1, riverBox.clientWidth);
  rctx.setTransform(1, 0, 0, 1, 0, 0); rctx.clearRect(0, 0, W, H);
  riverHit = { dots: [], bands: [] };
  if (n < 2) { $('rtip').textContent = 'Река начнёт течь через пару месяцев.'; return; }
  const arch = S.arch || {}, bottom = 20 * dpr, topM = 6 * dpr, plotH = H - bottom - topM;
  const lastT = Math.floor(S.tick / 30) * 30, t0 = lastT - (n - 1) * 30;
  const X = i => i / (n - 1) * W;
  const rows = gsH.map(r => { const m = new Map(); for (let j = 0; j < r.length; j += 2) m.set(r[j], r[j + 1]); return m; });
  const present = new Set(); rows.forEach(m => m.forEach((_, id) => present.add(id)));
  const kids = new Map(), roots = [];
  for (const id of present) {
    const a = arch[id], p = a && a.parent;
    if (p && present.has(p)) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(id); } else roots.push(id);
  }
  const fnd = id => (arch[id] ? arch[id].founded : 0);
  const order = [];
  const visit = id => { order.push(id); (kids.get(id) || []).sort((a, b) => fnd(a) - fnd(b)).forEach(visit); };
  roots.sort((a, b) => fnd(a) - fnd(b)).forEach(visit);
  const solo = h.solo || [];
  let maxT = 1;
  rows.forEach((m, i) => { let s = solo[i] || 0; m.forEach(v => s += v); maxT = Math.max(maxT, s); });
  const sc = plotH / maxT;
  const top = new Map(), bot = new Map(), soloB = [];
  rows.forEach((m, i) => {
    let tot = solo[i] || 0; m.forEach(v => tot += v);
    let y = topM + (plotH - tot * sc) / 2;
    for (const id of order) { const v = m.get(id); if (!v) continue; if (!top.has(id)) { top.set(id, []); bot.set(id, []); } top.get(id)[i] = y; y += v * sc; bot.get(id)[i] = y; }
    soloB[i] = [y, y + (solo[i] || 0) * sc];
  });
  // year grid
  rctx.font = `${12 * dpr}px Inter, system-ui, sans-serif`; rctx.textAlign = 'center'; rctx.fillStyle = C.muted; rctx.strokeStyle = rgba(C.rule, .8); rctx.lineWidth = 1;
  const yrs = n / 12, stepY = yrs > 40 ? 10 : yrs > 16 ? 5 : yrs > 6 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const tk = t0 + i * 30; if (tk % (360 * stepY) !== 0) continue;
    const x = X(i); rctx.beginPath(); rctx.moveTo(x, topM); rctx.lineTo(x, H - bottom); rctx.stroke();
    if (x > 14 * dpr && x < W - 14 * dpr) rctx.fillText(`г.${tk / 360}`, x, H - 5 * dpr);
  }
  // solo stream
  rctx.beginPath();
  soloB.forEach((b, i) => i ? rctx.lineTo(X(i), b[0]) : rctx.moveTo(X(i), b[0]));
  for (let i = n - 1; i >= 0; i--) rctx.lineTo(X(i), soloB[i][1]);
  rctx.closePath(); rctx.fillStyle = rgba(C.muted, .22); rctx.fill();
  // group streams
  const mid = (id, i) => { const a = top.get(id), b = bot.get(id); return a && a[i] !== undefined ? (a[i] + b[i]) / 2 : null; };
  for (const id of order) {
    const a = top.get(id), b = bot.get(id), info = arch[id] || { hue: 0 };
    let i = 0;
    while (i < n) {
      while (i < n && a[i] === undefined) i++;
      if (i >= n) break;
      const st = i; while (i < n && a[i] !== undefined) i++;
      const en = i - 1;
      rctx.beginPath();
      const x0 = st === 0 ? 0 : X(st) - (X(1) - X(0)) / 2, x1 = en === n - 1 ? W : X(en) + (X(1) - X(0)) / 2;
      rctx.moveTo(x0, a[st]);
      for (let j = st; j <= en; j++) rctx.lineTo(X(j), a[j]);
      rctx.lineTo(x1, a[en]); rctx.lineTo(x1, b[en]);
      for (let j = en; j >= st; j--) rctx.lineTo(X(j), b[j]);
      rctx.lineTo(x0, b[st]); rctx.closePath();
      rctx.fillStyle = hueC(info.hue, C.dark ? .75 : .7); rctx.fill();
      rctx.strokeStyle = C.bg; rctx.lineWidth = .8 * dpr; rctx.stroke();
      riverHit.bands.push({ id, st, en });
      // birth from parent
      if (st > 0 && info.parent) { const pm = mid(info.parent, st - 1); if (pm !== null) { rctx.strokeStyle = hueC(info.hue, .9); rctx.lineWidth = 1.5 * dpr; rctx.beginPath(); rctx.moveTo(X(st - 1), pm); rctx.bezierCurveTo(X(st), pm, X(st - 1), mid(id, st), X(st) + 2 * dpr, mid(id, st)); rctx.stroke(); } }
      // merge into another
      if (en < n - 1 && info.into) { const tm = mid(info.into, en + 1); if (tm !== null) { rctx.strokeStyle = hueC(info.hue, .9); rctx.lineWidth = 1.5 * dpr; rctx.beginPath(); rctx.moveTo(X(en), mid(id, en)); rctx.bezierCurveTo(X(en + 1) + 6 * dpr, mid(id, en), X(en), tm, X(en + 1) + 8 * dpr, tm); rctx.stroke(); } }
    }
  }
  // labels at widest point
  rctx.textAlign = 'left'; rctx.lineJoin = 'round';
  const placed = [];
  const cand = order.map(id => { const a = top.get(id), b = bot.get(id); let best = -1, bi = 0; for (let i = 0; i < n; i++) if (a[i] !== undefined && b[i] - a[i] > best) { best = b[i] - a[i]; bi = i; } return { id, best, bi }; }).filter(c => c.best >= 13 * dpr).sort((p, q) => q.best - p.best);
  for (const c of cand) {
    const nm = (arch[c.id] || {}).name || ''; const tw = rctx.measureText(nm).width;
    let x = Math.min(W - tw - 4 * dpr, Math.max(4 * dpr, X(c.bi) - tw / 2)); const y = mid(c.id, c.bi) + 4 * dpr;
    if (placed.some(p => x < p.x + p.w + 6 * dpr && x + tw + 6 * dpr > p.x && Math.abs(p.y - y) < 14 * dpr)) continue;
    placed.push({ x, y, w: tw });
    rctx.strokeStyle = rgba(C.bg, .85); rctx.lineWidth = 3 * dpr; rctx.strokeText(nm, x, y);
    rctx.fillStyle = C.ink; rctx.fillText(nm, x, y);
  }
  // event dots
  for (const e of S.events) {
    if (!isMajor(e) && e.type !== 'shock') continue;
    const i = Math.round((e.t - t0) / 30); if (i < 0 || i >= n) continue;
    let y = null; for (const gid of e.gs || []) { y = mid(gid, i) ?? mid(gid, Math.max(0, i - 1)) ?? mid(gid, Math.min(n - 1, i + 1)); if (y !== null) break; }
    if (y === null) y = topM + 6 * dpr;
    const x = X(i);
    rctx.beginPath(); rctx.arc(x, y, 4 * dpr, 0, 7); rctx.fillStyle = typeColor(e.type, 1); rctx.fill();
    rctx.strokeStyle = C.bg; rctx.lineWidth = 1.5 * dpr; rctx.stroke();
    riverHit.dots.push({ x, y, e });
  }
  riverHit.X = X; riverHit.n = n; riverHit.t0 = t0; riverHit.top = top; riverHit.bot = bot; riverHit.dpr = dpr;
  const alive = S.groups.length, total = Object.keys(arch).length;
  $('rtip').textContent = `${yrsTxt(Math.round(n / 12))} истории на ленте: ${total} групп родилось, ${alive} живы сейчас. Нажмите на точку события или на полосу.`;
}
const yrsTxt = n => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'год' : (n % 10 > 1 && n % 10 < 5 && (n % 100 < 12 || n % 100 > 14)) ? 'года' : 'лет'}`;
rv.addEventListener('pointerdown', ev => {
  const r = rv.getBoundingClientRect(), dpr = riverHit.dpr || 1, x = (ev.clientX - r.left) * dpr, y = (ev.clientY - r.top) * dpr;
  let best = null, bd = 14 * dpr;
  for (const d of riverHit.dots) { const dd = Math.hypot(d.x - x, d.y - y); if (dd < bd) { bd = dd; best = d; } }
  if (best) { focus(best.e, true); plate.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); return; }
  if (!riverHit.n) return;
  const i = Math.max(0, Math.min(riverHit.n - 1, Math.round(x / rv.width * (riverHit.n - 1))));
  for (const b of riverHit.bands) {
    if (i < b.st || i > b.en) continue;
    const a = riverHit.top.get(b.id)[i], c = riverHit.bot.get(b.id)[i];
    if (y >= a - 2 && y <= c + 2) {
      const info = (S.arch || {})[b.id] || {};
      const row = S.hist.gs[i]; let cnt = 0; for (let j = 0; j < row.length; j += 2) if (row[j] === b.id) cnt = row[j + 1];
      const par = info.parent && S.arch[info.parent] ? `, отделилась от «${S.arch[info.parent].name}»` : '';
      const fate = info.end !== null && info.end !== undefined ? (info.into && S.arch[info.into] ? `; влилась в «${S.arch[info.into].name}»` : `; распалась в ${SIM.date(info.end)}`) : '; жива';
      $('rtip').textContent = `«${info.name}» в ${SIM.date(riverHit.t0 + i * 30)}: ${cnt} чел. Основана в ${SIM.date(info.founded)}${par}${fate}.`;
      const g = S._g.get(b.id); if (g) { sel = g.leader; card(); }
      return;
    }
  }
});

