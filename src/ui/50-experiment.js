/* ---------- two worlds ---------- */
const EX = { on: false, A: null, B: null, k: 'scarcity', va: 0.3, vb: 0.8, playing: true, speed: 16, acc: 0, seed: null, tA: { terr: document.createElement('canvas'), key: '', at: 0, id: 'A' }, tB: { terr: document.createElement('canvas'), key: '', at: 0, id: 'B' }, lastUi: 0 };
const XK = { scarcity: 'дефицит', inflow: 'приток', synergy: 'синергия', memory: 'память', ambition: 'амбиции', noise: 'только случайность', landPriv: 'частная земля', assembly: 'вече', coin: 'монета', usury: 'проценты' };
const BOOL = { landPriv: ['разрешена', 'запрещена'], assembly: ['разрешено', 'запрещено'], coin: ['разрешена', 'запрещена'], usury: ['разрешены', 'запрещены'] };
const xval = v => BOOL[EX.k] ? (v >= 0.5 ? BOOL[EX.k][0] : BOOL[EX.k][1]) : pct(v) + '%';
const CA = () => C.slate, CB = () => (C.dark ? '#e08a6e' : '#b5523b');
function exStart() {
  const base = Object.assign({}, S.params), seed = EX.seed || S.seed;
  EX.seed = seed;
  const pa = Object.assign({}, base), pb = Object.assign({}, base);
  if (EX.k !== 'noise') { pa[EX.k] = EX.va; pb[EX.k] = EX.vb; }
  EX.A = SIM.newWorld(seed, pa); EX.B = SIM.newWorld(seed, pb);
  if (EX.k === 'noise') EX.B.rng = (EX.B.rng ^ 0x5bd1e995) | 0;
  EX.acc = 0; EX.playing = true; EX.tA.key = EX.tB.key = '';
  $('xplay').textContent = 'Пауза';
  exUi(true);
}
function drawMini(W0, c, st) {
  const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
  if (!w || !h) return;
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const k = w / 1000, old = ctx; ctx = c.getContext('2d');
  try {
    const px = v => v * dpr / k, now = performance.now();
    const res = Math.min(1600, Math.round(w * 1.4)), tk = `${res}|${C.dark}|${W0.seed}`;
    if (tk !== st.key || now - st.at > 5000) { paintTerrain(res, W0, st.terr); st.key = tk; st.at = now; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.drawImage(st.terr, 0, 0, 1000, 1000);
    const season = Math.floor((W0.tick % 360) / 90), winter = season === 0;
    if (winter) { ctx.fillStyle = C.dark ? 'rgba(190,215,240,.07)' : 'rgba(255,255,255,.38)'; ctx.fillRect(0, 0, 1000, 1000); }
    st.own = st.own || document.createElement('canvas');
    const okk = `${res}|${C.dark}|${Math.floor(W0.tick / 30)}|${W0.seed}`;
    if (okk !== st.okey) { paintOwn(W0, st.own, res); st.okey = okk; }
    if (W0.own) ctx.drawImage(st.own, 0, 0, 1000, 1000);
    ctx.lineCap = 'round';
    drawWater(ctx, W0); drawNet(ctx, W0, 1.2);
    ctx.lineCap = 'butt';
    for (const r of W0.ruins || []) { ctx.globalAlpha = .45; for (const hh of r.houses) houseGlyph(hh.x, hh.y, 12, rgba(C.muted, .5), rgba(C.muted, .8), false, px); ctx.globalAlpha = 1; }
    const wheat = winter ? (C.dark ? '#4a3d2c' : '#c9b392') : (C.dark ? '#8a7434' : '#ddbb5c');
    for (const g of W0.groups) {
      if (!g.home) continue;
      let md = 14; for (const o of g.houses.concat(g.fields)) md = Math.max(md, Math.hypot(o.x - g.home.x, o.y - g.home.y) + 8);
      if (!W0.own) { ctx.fillStyle = hueC(g.hue, .12); ctx.strokeStyle = hueC(g.hue, .6); ctx.lineWidth = px(1); ctx.beginPath(); ctx.arc(g.home.x, g.home.y, Math.min(md, 120) + 14, 0, 7); ctx.fill(); ctx.stroke(); }
      for (const f of g.fields) fieldGlyph(f, wheat, hueC(g.hue, .8), winter, px);
    }
    for (const g of W0.groups) {
      if (!g.home) continue;
      const fill = hueC(g.hue, 1, C.dark ? -6 : 12), roof = hueC(g.hue, 1, C.dark ? -22 : -14);
      for (const hh of g.houses) houseGlyph(hh.x, hh.y, 14, fill, roof, false, px);
      if (g.workshop) workshopGlyph(g.workshop.x, g.workshop.y, fill, roof, false, false, px, now);
      drawWall(g, px);
      const lord = g.lord && W0._g.get(g.lord);
      if (lord && lord.home) { ctx.strokeStyle = hueC(lord.hue, .9); ctx.lineWidth = px(2); ctx.setLineDash([px(1), px(4)]); ctx.beginPath(); ctx.moveTo(g.home.x, g.home.y); ctx.lineTo(lord.home.x, lord.home.y); ctx.stroke(); ctx.setLineDash([]); }
    }
    for (const wr of W0.wars || []) { const A = W0._g.get(wr.att), B = W0._g.get(wr.def); if (!A || !B || !A.home || !B.home) continue; ctx.strokeStyle = rgba(C.red, .85); ctx.lineWidth = px(2); ctx.setLineDash([px(6), px(4)]); ctx.beginPath(); ctx.moveTo(A.home.x, A.home.y); ctx.lineTo(B.home.x, B.home.y); ctx.stroke(); ctx.setLineDash([]); }
    for (const a of W0.agents) {
      const g = a.group && W0._g.get(a.group);
      ctx.fillStyle = g ? hueC(g.hue, 1) : rgba(C.muted, .85);
      ctx.beginPath(); ctx.arc(a.x, a.y, px(a.role === 'leader' ? 3.2 : 2.2), 0, 7); ctx.fill();
      if (a.war) { ctx.strokeStyle = C.red; ctx.lineWidth = px(1); ctx.stroke(); }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `600 ${11.5 * dpr}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    const placed = [];
    for (const g of W0.groups.filter(g => g.home && g.members.length >= 5).sort((a, b) => b.members.length - a.members.length).slice(0, 5)) {
      const tw = ctx.measureText(g.name).width, sx = Math.min(w - tw / 2 - 4 * dpr, Math.max(tw / 2 + 4 * dpr, g.home.x * k)), sy = Math.max(14 * dpr, (g.home.y - 24) * k);
      if (placed.some(p => Math.abs(p.x - sx) < (p.w + tw) / 2 + 4 * dpr && Math.abs(p.y - sy) < 15 * dpr)) continue;
      placed.push({ x: sx, y: sy, w: tw });
      ctx.strokeStyle = C.plate; ctx.lineWidth = 3.5 * dpr; ctx.strokeText(g.name, sx, sy); ctx.fillStyle = C.ink; ctx.fillText(g.name, sx, sy);
    }
  } finally { ctx = old; }
}
function exChart(id, a, b) {
  const c = $(id); if (!c) return;
  const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const x = c.getContext('2d'); x.clearRect(0, 0, w, h);
  const n = Math.min(a.length, b.length); if (n < 2) return;
  const k0 = Math.max(0, n - 360), all = a.slice(k0, n).concat(b.slice(k0, n)), mx = Math.max(...all) || 1, mn = Math.min(0, ...all);
  for (const [arr, col, dash] of [[a, CA(), []], [b, CB(), []]]) {
    x.beginPath(); for (let i = k0; i < n; i++) { const px = (i - k0) / Math.max(1, n - 1 - k0) * w, py = h - 3 * dpr - (arr[i] - mn) / (mx - mn || 1) * (h - 6 * dpr); i === k0 ? x.moveTo(px, py) : x.lineTo(px, py); }
    x.strokeStyle = col; x.lineWidth = 2 * dpr; x.setLineDash(dash); x.stroke();
  }
}
function worldFacts(W0) {
  const rcm = new Map(); for (const g of W0.groups) if (g.home) rcm.set(g.id, SIM.regime(W0, g));
  const types = {}; for (const g of W0.groups) if (g.home && g.members.length >= 5) { const t = rcm.get(g.id).type; types[t] = (types[t] || 0) + g.members.length; }
  const dom = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
  const big = W0.groups.slice().sort((a, b) => b.members.length - a.members.length)[0];
  const st = W0.stats;
  return { rcm, dom: dom ? dom[0] : null, big, pop: SIM.popOf(W0), soc: W0.groups.filter(g => g.home).length, wars: st.wars || 0, battles: st.battles || 0, conq: st.conquests || 0, coups: st.coups || 0, schisms: st.schisms || 0, trades: st.trades || 0, fam: st.famines || 0, faiths: new Set(W0.groups.map(g => g.faith).filter(Boolean)).size, dyn: W0.groups.filter(g => g.dynasty).length, fallen: st.war || 0, gini: (W0.hist.gini[W0.hist.gini.length - 1] || 0) };
}
const ROWS = [['pop', 'Население'], ['soc', 'Оседлых обществ'], ['trades', 'Сделок'], ['wars', 'Походов'], ['battles', 'Битв'], ['conq', 'Завоеваний'], ['coups', 'Переворотов'], ['schisms', 'Расколов'], ['fam', 'Голодных зим'], ['fallen', 'Погибло в боях'], ['faiths', 'Вер'], ['dyn', 'Династий']];
const DIFF = { trades: 'сделок', wars: 'походов', battles: 'битв', conq: 'завоеваний', coups: 'переворотов', schisms: 'расколов', fam: 'голодных зим', fallen: 'погибших в боях', pop: 'людей' };
function exUi(force) {
  if (!EX.A) return;
  const A = EX.A, B = EX.B, fa = worldFacts(A), fb = worldFacts(B), y = Math.floor(A.tick / 360);
  $('year').textContent = `Год ${y}`; $('season').textContent = ['зима', 'весна', 'лето', 'осень'][Math.floor((A.tick % 360) / 90)];
  const lab = v => `${XK[EX.k]} ${xval(v)}`;
  $('capA').innerHTML = `<b style="color:${CA()}">Мир A</b> · ${EX.k === 'noise' ? 'исходный шум' : lab(EX.va)} · ${fa.pop} чел.`;
  $('capB').innerHTML = `<b style="color:${CB()}">Мир B</b> · ${EX.k === 'noise' ? 'другой шум' : lab(EX.vb)} · ${fb.pop} чел.`;
  $('xstats').innerHTML = `<table><thead><tr><th></th><th style="color:${CA()}">A</th><th style="color:${CB()}">B</th></tr></thead><tbody>${ROWS.map(([k, l]) => `<tr><td>${l}</td><td>${fa[k]}</td><td>${fb[k]}</td></tr>`).join('')}<tr><td>Больше всего людей живёт в</td><td>${fa.dom ? esc(fa.dom.toLowerCase()) : '—'}</td><td>${fb.dom ? esc(fb.dom.toLowerCase()) : '—'}</td></tr></tbody></table>`;
  const yrs = Math.floor(A.tick / 360);
  let sum;
  if (yrs < 4) sum = 'Миры стартовали одинаково: та же карта, те же люди. Первые годы они почти не отличаются, смотрите, когда начнут расходиться.';
  else {
    const diffs = Object.keys(DIFF).map(k => { const a = fa[k], b = fb[k], r = (Math.max(a, b) + 2) / (Math.min(a, b) + 2); return { k, a, b, r }; }).filter(d => d.r > 1.35 && Math.max(d.a, d.b) >= 3).sort((p, q) => q.r - p.r).slice(0, 3);
    const lead = fa.dom && fb.dom && fa.dom !== fb.dom ? `За ${yrsTxt(yrs)} миры пришли к разному устройству: в A больше всего людей живёт в обществах типа «${fa.dom.toLowerCase()}», в B — «${fb.dom.toLowerCase()}».` : fa.dom && fa.dom === fb.dom ? `За ${yrsTxt(yrs)} оба мира пришли к похожему устройству: больше всего людей живёт в обществах типа «${fa.dom.toLowerCase()}».` : `Прошло ${yrsTxt(yrs)}.`;
    const tail = diffs.length ? ' ' + diffs.map(d => `${d.a > d.b ? 'В A' : 'В B'} ${DIFF[d.k]} в ${d.r.toFixed(1).replace('.0', '').replace('.', ',')} раза больше (${Math.max(d.a, d.b)} против ${Math.min(d.a, d.b)}).`).join(' ') : ' По остальным показателям миры пока близки.';
    sum = lead + tail + (EX.k === 'noise' ? ' Разница здесь только в случайности, поэтому всё расхождение — эффект бабочки.' : '');
  }
  $('xsum').textContent = sum;
  exChart('xc0', A.hist.pop, B.hist.pop); exChart('xc1', A.hist.groups, B.hist.groups); exChart('xc2', A.hist.entropy, B.hist.entropy); exChart('xc3', A.hist.gini, B.hist.gini);
  socDraw(A, $('sbA'), $('sA'), fa.rcm); socDraw(B, $('sbB'), $('sB'), fb.rcm);
}
function setMode(on) {
  EX.on = on; document.body.classList.toggle('exp', on);
  $('t1').classList.toggle('on', !on); $('t2').classList.toggle('on', on);
  $('t1').setAttribute('aria-pressed', String(!on)); $('t2').setAttribute('aria-pressed', String(on));
  if (on) { if (!EX.A) exStart(); else exUi(true); } else ui(true);
}
function syncX() {
  const noise = EX.k === 'noise';
  $('xab').style.display = noise ? 'none' : '';
  $('oxa').textContent = xval(EX.va); $('oxb').textContent = xval(EX.vb);
  for (const id of ['xa', 'xb']) $(id).step = BOOL[EX.k] ? '1' : '0.05';
}
$('t1').addEventListener('click', () => setMode(false));
$('t2').addEventListener('click', () => setMode(true));
$('xk').addEventListener('change', e => { EX.k = e.target.value; if (BOOL[EX.k]) { EX.va = 1; EX.vb = 0; } else if (EX.k !== 'noise') { EX.va = 0.25; EX.vb = 0.8; } syncX(); $('xa').value = EX.va; $('xb').value = EX.vb; });
$('xa').addEventListener('input', e => { EX.va = +e.target.value; syncX(); });
$('xb').addEventListener('input', e => { EX.vb = +e.target.value; syncX(); });
$('xgo').addEventListener('click', exStart);
$('xmap').addEventListener('click', () => { EX.seed = (Math.random() * 99999) | 0; exStart(); });
$('xplay').addEventListener('click', () => { EX.playing = !EX.playing; $('xplay').textContent = EX.playing ? 'Пауза' : 'Пуск'; });
document.querySelectorAll('input[name=xs]').forEach(r => r.addEventListener('change', e => { EX.speed = +e.target.value; }));
syncX();


