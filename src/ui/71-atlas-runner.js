/* ---------- atlas runner: recompute worlds in background workers ---------- */
const ATLW = `
const R2 = v => Math.round(v * 100) / 100;
function snap(S) {
  const pop = SIM.popOf(S), gs = S.groups, reg = {}; let cw = 0, bw = 0, w = 0;
  const per = gs.map(g => { const r = SIM.regime(S, g), n = g.members.length; reg[r.type] = (reg[r.type] || 0) + n; cw += r.c * n; bw += r.b * n; w += n; return { n, type: r.type, gov: g.gov, coin: !!g.coin, faith: g.faith || null, dyn: !!g.dynasty }; });
  const dom = Object.entries(reg).sort((x, y) => y[1] - x[1])[0];
  const sts = (S.states || []).map(s => ({ type: s.type, name: s.name, pop: s.pop })).sort((x, y) => y.pop - x.pop), top = sts[0] || null;
  const big = per.slice().sort((x, y) => y.n - x.n)[0];
  return { pop, ng: gs.length, dom: dom ? dom[0] : null, c: w ? cw / w : 0, b: w ? bw / w : 0, gini: SIM.gini(S.agents.map(x => x.wealth)), top, bigShare: big && pop ? big.n / pop : 0,
    coin: per.filter(p => p.coin).length, assembly: per.filter(p => p.gov === 'assembly').length, faiths: new Set(per.map(p => p.faith).filter(Boolean)).size, dyn: per.filter(p => p.dyn).length,
    take: gs.length ? Math.max(...gs.map(g => g.take)) : 0, statesEver: Object.keys(S.sarch || {}).length, stats: Object.assign({}, S.stats) };
}
function runWorld(seed, years, params, tick) {
  const S = SIM.newWorld(seed, params || {}), snaps = [], eras = [];
  for (let y = 1; y <= years; y++) { for (let t = 0; t < 360; t++) SIM.step(S); if (y % 10 === 0) { snaps.push(snap(S)); const e = S.events.find(e => e.type === 'era'); eras.push(e ? e.text : ''); } if (tick) tick(y); if (!S.agents.length) break; }
  return packWorld(seed, snaps, eras);
}
function packWorld(seed, snaps, eras) {
  const L = snaps[snaps.length - 1], st = L.stats;
  return { s: seed, p: snaps.map(x => x.pop), c: snaps.map(x => R2(x.c)), b: snaps.map(x => R2(x.b)), d: snaps.map(x => x.dom), g: snaps.map(x => x.ng),
    st: L.top ? L.top.type : null, sn: L.top ? L.top.name : null, sh: L.top && L.pop ? R2(L.top.pop / L.pop) : 0, bs: R2(L.bigShare), gi: R2(L.gini),
    w: st.wars || 0, q: st.conquests || 0, r: st.revolts || 0, k: st.coups || 0, x: st.schisms || 0, t: st.trades || 0, se: L.statesEver, co: L.coin, as: L.assembly, f: L.faiths, dy: L.dyn,
    pl: st.plagues || 0, pd: st.plague || 0, mar: st.marriages || 0, bo: st.bonds || 0, tk: R2(L.take), e: eras.map(e => e.split(': ')[1] || '') };
}`;
const ATLRUN = { on: false, workers: [], queue: [], done: 0, total: 0, t0: 0, res: [], params: null, years: 60, fb: null };
const MODEL_V = SIM.MODEL.v;
function atlSrc() { for (const s of document.scripts) { const t = s.textContent || ''; if (t.includes('const SIM = (() =>') && !t.includes('function atlSrc')) return t; } return null; }
function atlStart() {
  const n = +$('atlN').value, years = +$('atlY').value, own = $('atlOwn').checked;
  const base = 1 + ((Math.random() * 900000) | 0);
  ATLRUN.on = true; ATLRUN.done = 0; ATLRUN.total = n; ATLRUN.years = years; ATLRUN.t0 = performance.now(); ATLRUN.res = new Array(n);
  ATLRUN.params = own && S ? Object.assign({}, S.params) : null;
  ATLRUN.queue = Array.from({ length: n }, (_, i) => ({ i, seed: base + i * 7919 }));
  $('atlGo').hidden = true; $('atlStop').hidden = false; atlProg();
  const src = atlSrc(), cores = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 2) - 1));
  let ok = false;
  if (src && typeof Worker !== 'undefined') {
    try {
      const url = URL.createObjectURL(new Blob([src + '\n' + ATLW + `\nonmessage = e => { const m = e.data; let last = 0; const r = runWorld(m.seed, m.years, m.params, y => { if (y - last >= 10) { last = y; postMessage({ prog: y, i: m.i }); } }); postMessage({ i: m.i, r }); };`], { type: 'text/javascript' }));
      for (let k = 0; k < cores; k++) { const w = new Worker(url); w.onmessage = ev => atlMsg(w, ev.data); w.onerror = () => { w.dead = true; if (ATLRUN.on && !ATLRUN.fb && ATLRUN.workers.every(x => x.dead)) { if (w.job) ATLRUN.queue.unshift(w.job); for (const x of ATLRUN.workers) { if (x.job && x !== w && !ATLRUN.res[x.job.i]) ATLRUN.queue.unshift(x.job); x.terminate(); } ATLRUN.workers = []; atlFallback(src); } }; ATLRUN.workers.push(w); atlFeed(w); }
      ok = true;
    } catch (e) { ok = false; }
  }
  if (!ok) atlFallback(src);
}
function atlFeed(w) {
  const job = ATLRUN.queue.shift();
  if (!job) { w.terminate(); ATLRUN.workers = ATLRUN.workers.filter(x => x !== w); if (!ATLRUN.workers.length && ATLRUN.on) atlFinish(); return; }
  w.job = job; w.postMessage({ i: job.i, seed: job.seed, years: ATLRUN.years, params: ATLRUN.params });
}
function atlMsg(w, m) {
  if (!ATLRUN.on) return;
  if (m.prog) { w.prog = m.prog; atlProg(); return; }
  ATLRUN.res[m.i] = m.r; ATLRUN.done++; w.prog = 0;
  atlApply(false); atlProg(); atlFeed(w);
}
function atlFallback(src) {
  // no workers: compute on the main thread in small slices
  let F = null;
  try { F = new Function('SIM', ATLW + '\nreturn { snap, packWorld };')(SIM); } catch (e) { F = null; }
  if (!F) { $('atlProg').textContent = 'Этот браузер не даёт считать атлас.'; atlStop(); return; }
  ATLRUN.fb = true;
  let job = null;
  const slice = () => {
    if (!ATLRUN.on) return;
    if (!job) { const j = ATLRUN.queue.shift(); if (!j) { atlFinish(); return; } job = { i: j.i, seed: j.seed, S: SIM.newWorld(j.seed, ATLRUN.params || {}), y: 0, snaps: [], eras: [] }; }
    const t0 = performance.now();
    while (performance.now() - t0 < 30 && job.y < ATLRUN.years) {
      for (let t = 0; t < 60; t++) SIM.step(job.S);
      if (job.S.tick % 360 === 0) { job.y++; if (job.y % 10 === 0) { job.snaps.push(F.snap(job.S)); const e = job.S.events.find(e => e.type === 'era'); job.eras.push(e ? e.text : ''); } }
    }
    ATLRUN.fbProg = job.y;
    if (job.y >= ATLRUN.years) { ATLRUN.res[job.i] = F.packWorld(job.seed, job.snaps, job.eras); ATLRUN.done++; job = null; ATLRUN.fbProg = 0; atlApply(false); }
    atlProg();
    setTimeout(slice, 40);
  };
  slice();
}
function atlProg() {
  const el = $('atlProg'); if (!el) return;
  if (!ATLRUN.on) { el.textContent = ATL.meta || ''; return; }
  const part = ATLRUN.workers.reduce((s, w) => s + (w.prog || 0) / ATLRUN.years, 0) + (ATLRUN.fbProg || 0) / ATLRUN.years, dn = ATLRUN.done + part, el2 = (performance.now() - ATLRUN.t0) / 1000;
  const left = dn > 0.3 ? Math.max(0, el2 / dn * (ATLRUN.total - dn)) : null;
  el.textContent = `Считаю: ${ATLRUN.done} из ${ATLRUN.total} миров${ATLRUN.fb ? ' (в общем потоке, медленнее)' : ` · потоков ${ATLRUN.workers.length || 0}`}${left !== null ? ` · осталось около ${left > 90 ? Math.round(left / 60) + ' мин' : Math.max(5, Math.round(left / 5) * 5) + ' с'}` : ''}`;
  $('atlBar').style.width = `${Math.round(dn / ATLRUN.total * 100)}%`;
}
function atlApply(final) {
  const got = ATLRUN.res.filter(Boolean); if (!got.length) return;
  ATLAS = got; ATL.sel = Math.min(ATL.sel || 0, ATLAS.length - 1); ATL.fam = null;
  ATL.meta = `${final ? '' : 'Пока '}${ATLAS.length} ${plA(ATLAS.length, 'мир', 'мира', 'миров')} по ${ATLRUN.years} лет${ATLRUN.params ? ', ваши вводные' : ', обычные вводные'}`;
  ATL.params = ATLRUN.params;
  atlBuild(); atlDraw(); atlCard();
}
function atlFinish() {
  ATLRUN.on = false; atlApply(true);
  try { localStorage.setItem('lab.atlas', JSON.stringify({ v: MODEL_V, years: ATLRUN.years, params: ATLRUN.params, data: ATLAS })); } catch (e) {}
  ATL.meta += `. Посчитано за ${Math.max(1, Math.round((performance.now() - ATLRUN.t0) / 60000))} мин`;
  $('atlGo').hidden = false; $('atlStop').hidden = true; $('atlBar').style.width = '0%'; atlProg();
}
function atlStop() {
  ATLRUN.on = false; for (const w of ATLRUN.workers) w.terminate(); ATLRUN.workers = []; ATLRUN.queue = [];
  if (ATLRUN.res.some(Boolean)) { atlApply(true); ATL.meta += ' (остановлено)'; }
  $('atlGo').hidden = false; $('atlStop').hidden = true; $('atlBar').style.width = '0%'; atlProg();
}
$('atlGo').addEventListener('click', atlStart);
$('atlStop').addEventListener('click', atlStop);
$('atlReset').addEventListener('click', () => { if (ATLRUN.on) atlStop(); try { localStorage.removeItem('lab.atlas'); } catch (e) {} ATLAS = ATLAS0; ATL.params = null; ATL.meta = 'Готовый атлас посчитан на прошлой модели: материк, без воды, острова и судеб. Чтобы увидеть миры-острова, посчитайте новые'; ATL.sel = 0; ATL.fam = null; if (ATL.on) { atlBuild(); atlDraw(); atlCard(); } atlProg(); });
try { const sv = JSON.parse(localStorage.getItem('lab.atlas') || 'null'); if (sv && sv.v === MODEL_V && sv.data && sv.data.length) { ATLAS = sv.data; ATL.params = sv.params; ATL.meta = `Ваш атлас: ${ATLAS.length} ${plA(ATLAS.length, 'мир', 'мира', 'миров')} по ${sv.years} лет${sv.params ? ', ваши вводные' : ''}`; } } catch (e) {}
if (!ATL.meta) ATL.meta = 'Готовый атлас посчитан на прошлой модели: материк, без воды, острова и судеб. Чтобы увидеть миры-острова, посчитайте новые';

