/* ---------- atlas of a hundred worlds ---------- */
const ATLAS0 = /*ATLAS*/[];
let ATLAS = ATLAS0;
const plA = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11) ? a : (n % 10 > 1 && n % 10 < 5 && (n % 100 < 12 || n % 100 > 14)) ? b : c;
const ATL = { on: false, sel: null, hits: [], fam: null };
const FAM = [
  { k: 'trade', name: 'торговые', types: ['Вольная торговая община', 'Торговая республика', 'Купеческая олигархия'], l: 'rgb(31,138,122)', d: 'rgb(76,194,176)' },
  { k: 'eq', name: 'вечевые и равные', types: ['Вечевая республика', 'Община равных', 'Земледельческая община'], l: 'rgb(47,111,179)', d: 'rgb(111,168,232)' },
  { k: 'kin', name: 'родовые и княжества', types: ['Родовая община', 'Наследственное княжество'], l: 'rgb(122,79,176)', d: 'rgb(173,138,224)' },
  { k: 'land', name: 'земельная знать', types: ['Феодальное княжество', 'Земельная знать'], l: 'rgb(176,100,42)', d: 'rgb(224,153,94)' },
  { k: 'force', name: 'держатся силой', types: ['Держава данников', 'Воинское братство', 'Военная деспотия', 'Вождество'], l: 'rgb(194,58,58)', d: 'rgb(240,112,112)' },
  { k: 'faith', name: 'теократии', types: ['Теократия'], l: 'rgb(169,138,18)', d: 'rgb(224,192,80)' },
  { k: 'frag', name: 'раздроблены на хутора', types: ['Хутор', 'Кочевая ватага'], l: 'rgb(125,133,144)', d: 'rgb(163,171,181)' },
];
const famOf = t => FAM.find(f => f.types.includes(t)) || FAM[6];
const famCol = (t, a) => { const f = famOf(t), h = C.dark ? f.d : f.l; return a == null ? h : rgba(h, a); };
const lastOf = w => w.d.length - 1;

function setAtlas(on) {
  ATL.on = on; document.body.classList.toggle('atl', on);
  $('t3').classList.toggle('on', on); $('t3').setAttribute('aria-pressed', String(on));
  if (on) {
    $('t1').classList.remove('on'); $('t2').classList.remove('on'); $('t1').setAttribute('aria-pressed', 'false'); $('t2').setAttribute('aria-pressed', 'false');
    document.body.classList.remove('exp'); EX.on = false;
    if (!ATL.built) atlBuild(); atlProg();
    if (ATL.sel == null) ATL.sel = 0;
    atlDraw(); atlCard();
  }
}
function atlBuild() {
  ATL.built = true;
  const N = ATLAS.length, fin = ATLAS.map(w => w.d[lastOf(w)]);
  const types = {}; fin.forEach(t => types[t] = (types[t] || 0) + 1);
  const top = Object.entries(types).sort((a, b) => b[1] - a[1]);
  const fams = {}; fin.forEach(t => { const f = famOf(t).k; fams[f] = (fams[f] || 0) + 1; });
  const noState = ATLAS.filter(w => !w.st).length, heg = ATLAS.filter(w => w.bs > 0.5).length, frag = ATLAS.filter(w => w.bs < 0.2).length;
  const turned = ATLAS.filter(w => w.d[1] !== w.d[lastOf(w)]).length;
  const cs = ATLAS.map(w => w.c[lastOf(w)]), ps = ATLAS.map(w => w.p[lastOf(w)]);
  const coinAll = ATLAS.every(w => w.co > 0), asm = ATLAS.filter(w => w.as > 0).length;
  const OLD = { types: 14, top: 'Вольная торговая община', topN: 23, cMin: 0.31, cMax: 0.54, pMin: 42, pMax: 108, coin: 100, asm: 36, noState: 14, plague: 0 };
  const NEW = { types: Object.keys(types).length, top: top[0][0], topN: top[0][1], cMin: Math.min(...cs), cMax: Math.max(...cs), pMin: Math.min(...ps), pMax: Math.max(...ps), coin: ATLAS.filter(w => w.co > 0).length, asm: ATLAS.filter(w => w.as > 0).length, noState, plague: ATLAS.filter(w => (w.pl || 0) > 0).length };
  const Y = ATLAS[0].d.length * 10;
  const rows = [
    ['Разных концовок', OLD.types, NEW.types],
    ['Самый частый строй', `${OLD.top.toLowerCase()}, ${OLD.topN}`, `${NEW.top.toLowerCase()}, ${NEW.topN}`],
    ['Сосредоточенность власти', `${OLD.cMin.toFixed(2)}–${OLD.cMax.toFixed(2)}`, `${NEW.cMin.toFixed(2)}–${NEW.cMax.toFixed(2)}`],
    ['Население в конце', `${OLD.pMin}–${OLD.pMax}`, `${NEW.pMin}–${NEW.pMax}`],
    ['Миров с монетой', OLD.coin, NEW.coin],
    ['Миров с вечем в конце', OLD.asm, NEW.asm],
    ['Миров без государства', OLD.noState, NEW.noState],
    ['Миров, где прошёл мор', '—', NEW.plague],
  ];
  $('atlCmp').innerHTML = `<thead><tr><th></th><th>Старая модель<br><small>60 кочевников, 60 лет</small></th><th>Сейчас в атласе<br><small>${N} ${plA(N, 'мир', 'мира', 'миров')} по ${Y} лет${ATL.params ? ', ваши вводные' : ''}</small></th></tr></thead><tbody>${rows.map(r => `<tr><th>${r[0]}</th><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody>`;
  if (N < 5) { $('atlFind').innerHTML = `<li>Пока посчитано ${N} ${plA(N, 'мир', 'мира', 'миров')}: для выводов нужно хотя бы пять.</li>`; $('atlWeak').innerHTML = ''; }
  else $('atlFind').innerHTML = `
    <li><b>${NEW.types} ${plA(NEW.types, 'концовка', 'разные концовки', 'разных концовок')}.</b> Чаще всего мир приходит к строю «${esc(top[0][0].toLowerCase())}», но так кончились ${top[0][1]} из ${N}.</li>
    <li><b>Судьба не решается в начале.</b> В ${turned} ${plA(turned, 'мире', 'мирах', 'мирах')} из ${N} господствующий строй в конце не тот, что был на 20-м году.</li>
    <li><b>Державы и мелочь.</b> ${heg ? `В ${heg} ${plA(heg, 'мире', 'мирах', 'мирах')} одна деревня собрала больше половины людей.` : 'Ни в одном мире одна деревня не собрала больше половины людей: на большой земле мир дробится на десятки деревень, а крупное складывается через государства.'} ${noState} ${plA(noState, 'мир', 'мира', 'миров')} так и не ${plA(noState, 'создал', 'создали', 'создали')} государства.</li>
    <li><b>Монета стала развилкой${NEW.coin < 100 ? '' : ' не до конца'}.</b> Её чеканят в ${NEW.coin} ${plA(NEW.coin, 'мире', 'мирах', 'мирах')} из ${N}: теперь её изобретают редко, а перенимают у торговых соседей.</li>`;
  if (N >= 5) $('atlWeak').innerHTML = `
    <li><b>Власть шире, но крайностей мало.</b> Средняя сосредоточенность теперь от ${NEW.cMin.toFixed(2)} до ${NEW.cMax.toFixed(2)}. В тесных долинах вожди с дружиной забирают до ${Math.round(Math.max(...ATLAS.map(w => w.tk || 0)) * 100)}% добычи, но целый мир деспотией не становится.</li>
    <li><b>Мор почти неизбежен.</b> За ${Y} лет он прошёл в ${NEW.plague} ${plA(NEW.plague, 'мире', 'мирах', 'мирах')} из ${N}. Возможно, зараза приходит слишком легко.</li>
    <li><b>Модель не сверена с историей.</b> Числа подобраны так, чтобы миры жили правдоподобно, а не взяты из антропологических данных.</li>`;
  $('atlLeg').innerHTML = FAM.filter(f => fams[f.k]).map(f => `<button data-f="${f.k}" aria-pressed="false"><i style="background:${C.dark ? f.d : f.l}"></i>${f.name} · ${fams[f.k]}</button>`).join('');
}
function atlDraw() {
  const box = $('atlbox'), c = $('atl'); if (!box || !box.clientWidth) return;
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
  ATL.hits = [];
  const order = ATLAS.map((w, i) => i).sort((a, b) => (a === ATL.sel) - (b === ATL.sel));
  for (const i of order) {
    const w = ATLAS[i], n = lastOf(w), t = w.d[n], dim = ATL.fam && famOf(t).k !== ATL.fam, me = i === ATL.sel;
    if (me) {
      x.beginPath(); w.c.forEach((cv, j) => j ? x.lineTo(X(cv), Y(w.b[j])) : x.moveTo(X(cv), Y(w.b[j])));
      x.lineJoin = 'round'; x.strokeStyle = famCol(t, .9); x.lineWidth = 2 * dpr; x.stroke();
      w.c.forEach((cv, j) => { if (j === n) return; x.beginPath(); x.arc(X(cv), Y(w.b[j]), 3 * dpr, 0, 7); x.fillStyle = famCol(w.d[j], .9); x.fill(); });
    }
    const px = X(w.c[n]), py = Y(w.b[n]), r = (2.5 + Math.sqrt(w.p[n]) * 0.55) * dpr;
    x.beginPath(); x.arc(px, py, r, 0, 7); x.fillStyle = famCol(t, dim ? .12 : me ? 1 : .72); x.fill();
    if (me) { x.strokeStyle = C.ink; x.lineWidth = 2 * dpr; x.beginPath(); x.arc(px, py, r + 3 * dpr, 0, 7); x.stroke(); }
    else if (!dim) { x.strokeStyle = C.bg; x.lineWidth = 1 * dpr; x.stroke(); }
    if (!dim) ATL.hits.push({ x: px, y: py, r: r + 6 * dpr, i });
  }
}
function atlCard() {
  const w = ATLAS[ATL.sel]; if (!w) { $('atlCard').innerHTML = ''; return; }
  const n = lastOf(w), t = w.d[n], f = famOf(t);
  const pmax = Math.max(...w.p), spark = w.p.map((p, j) => `<i style="height:${Math.max(6, p / pmax * 100)}%" title="${p} чел."></i>`).join('');
  const st = w.st ? `${esc(w.st.toLowerCase())} «${esc(w.sn)}», в ней ${Math.round(w.sh * 100)}% людей` : 'государства нет';
  $('atlCard').innerHTML = `
    <p class="kick" style="color:${famCol(t)}">${f.name}</p>
    <h3>Мир №${w.s}</h3>
    <p class="lead2">Через ${w.d.length * 10} лет: <b>${esc(t.toLowerCase())}</b>; ${st}. Живёт ${w.p[n]} ${plA(w.p[n], 'человек', 'человека', 'человек')} в ${w.g[n]} ${plA(w.g[n], 'группе', 'группах', 'группах')}.</p>
    <ol class="decs">${w.e.map((e, j) => `<li><span>${j * 10}–${j * 10 + 9}</span><b>${esc(e)}</b><em>${esc((w.d[j] || '').toLowerCase())}</em></li>`).join('')}</ol>
    <div class="psp" aria-label="Население по десятилетиям: ${w.p.join(', ')}">${spark}</div>
    <p class="nums">${w.w} ${plA(w.w, 'поход', 'похода', 'походов')}, ${w.q} ${plA(w.q, 'завоевание', 'завоевания', 'завоеваний')}, ${w.r} ${plA(w.r, 'восстание', 'восстания', 'восстаний')}, ${w.k} ${plA(w.k, 'переворот', 'переворота', 'переворотов')}, ${w.t} ${plA(w.t, 'сделка', 'сделки', 'сделок')}; государств за всё время: ${w.se}; неравенство ${w.gi.toFixed(2)}.</p>
    <button class="main" id="atlOpen">Открыть этот мир с 0 года</button>`;
  $('atlOpen').addEventListener('click', () => {
    const seed = w.s; setAtlas(false); setMode(false); S = ATL.params ? { params: Object.assign({}, ATL.params) } : null; world(seed);
    playing = true; syncPlay(); window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
$('t3').addEventListener('click', () => setAtlas(true));
$('t1').addEventListener('click', () => { if (ATL.on) setAtlas(false); });
$('t2').addEventListener('click', () => { if (ATL.on) { setAtlas(false); setMode(true); } });
$('atl').addEventListener('click', e => {
  const r = $('atl').getBoundingClientRect(), dpr = $('atl').width / r.width, mx = (e.clientX - r.left) * dpr, my = (e.clientY - r.top) * dpr;
  let best = null, bd = 1e9; for (const h of ATL.hits) { const d = Math.hypot(h.x - mx, h.y - my); if (d < h.r && d < bd) { bd = d; best = h; } }
  if (best) { ATL.sel = best.i; atlDraw(); atlCard(); if (innerWidth < 900) $('atlCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
});
$('atlLeg').addEventListener('click', e => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  ATL.fam = ATL.fam === b.dataset.f ? null : b.dataset.f;
  $('atlLeg').querySelectorAll('[data-f]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.f === ATL.fam)));
  if (ATL.fam && famOf(ATLAS[ATL.sel].d[lastOf(ATLAS[ATL.sel])]).k !== ATL.fam) { ATL.sel = ATLAS.findIndex(w => famOf(w.d[lastOf(w)]).k === ATL.fam); atlCard(); }
  atlDraw();
});
$('atlRand').addEventListener('click', () => { const pool = ATLAS.map((w, i) => i).filter(i => !ATL.fam || famOf(ATLAS[i].d[lastOf(ATLAS[i])]).k === ATL.fam); ATL.sel = pool[(Math.random() * pool.length) | 0]; atlDraw(); atlCard(); });
new ResizeObserver(() => { if (ATL.on) atlDraw(); }).observe($('atlbox'));

