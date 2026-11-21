{ const M = SIM.MODEL, [y, m, d] = M.date.split('-'); $('ver').textContent = `модель ${M.v} · ${+d} ${['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][m - 1]} ${y}`; $('ver').title = M.note; }
let lastPaint = -Infinity;
function frame(now) {
  const dt = Math.min(100, now - last); last = now;
  if (ATL.on) { requestAnimationFrame(frame); return; }
  if (EX.on) {
    if (EX.playing && EX.A) {
      EX.acc = Math.min(60, EX.acc + dt * 12 * EX.speed / 1000);
      const days = Math.floor(EX.acc);
      if (!experimentRunner.busy && days >= Math.max(1, EX.speed / 4)) {
        EX.acc -= days;
        experimentRunner.advance(days, () => {});
      }
    }
    if (EX.A) { drawMini(EX.A, $('mA'), EX.tA); drawMini(EX.B, $('mB'), EX.tB); }
    if (now - EX.lastUi > 400) { exUi(); EX.lastUi = now; }
    requestAnimationFrame(frame); return;
  }
  if (playing) {
    acc = Math.min(60, acc + dt * (dayWatch ? 1 / OBSERVED_DAY_MS : 12 * speed / 1000));
    // Stop at the same monthly checkpoints as the synchronous simulation.
    const checkpoint = 30 - S.tick % 30;
    const days = Math.min(Math.floor(acc), checkpoint);
    const batch = dayWatch ? 1 : Math.min(checkpoint, Math.max(1, speed / 2));
    if (!mainRunner.busy && days >= batch) {
      acc -= days;
      mainRunner.advance(days, completed => {
        if (!completed || S.tick % 30) return;
        checkStops(performance.now());
        if (!playing) acc = 0;
      });
    }
  }
  // At high speed leave time for controls and snapshots between canvas draws.
  if (dayWatch || speed < 16 || now - lastPaint >= 32) {
    updateDailyView();
    if (V3.on && V3.ready) render3D(now); else draw(now);
    lastPaint = now;
  }
  if (now - lastUi > 350) { ui(); lastUi = now; }
  requestAnimationFrame(frame);
}

$('play').addEventListener('click', () => {
  playing = !playing;
  if (!playing && mainRunner.busy) mainRunner.reset();
  if (playing && focusEv) closeFocus();
  syncPlay();
});
document.querySelectorAll('input[name=sp]').forEach(r => r.addEventListener('change', e => {
  dayWatch = e.target.value === 'day';
  if (!dayWatch) speed = +e.target.value;
  acc = dayWatch ? dawnFraction() : 0;
}));
$('fork').addEventListener('click', () => { forkSnap = SIM.serialize(S); forkLabel = SIM.date(S.tick); $('back').disabled = false; $('back').textContent = `Вернуться к ${forkLabel}`; });
$('back').addEventListener('click', () => {
  if (!forkSnap) return;
  const params = Object.assign({}, S.params);
  S = SIM.restore(forkSnap); S.params = params;
  if ($('fly').checked) S.rng = (Math.random() * 2147483647) | 0;
  S.evId = (S.evId || 0) + 1;
  S.events.unshift({ id: S.evId, t: S.tick, type: 'fork', text: $('fly').checked ? 'Возврат к развилке. Шум перемешан: история может пойти иначе' : 'Возврат к развилке. Шум тот же: расхождения дадут только ваши вводные' });
  resetView();
});
$('reset').addEventListener('click', () => { world((Math.random() * 99999) | 0); intro(); });
document.querySelectorAll('[data-shock]').forEach(b => b.addEventListener('click', () => {
  SIM.shock(S, b.dataset.shock); mainRunner.reset(); seenEv = S.evId || 0; ui(true);
  if (S.events[0] && S.events[0].type !== 'genesis') { focus(S.events[0], false); plate.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); }
}));
$('portraits').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) { sel = +b.dataset.a; const ag = S._a.get(sel), gg = ag && S._g.get(ag.group); if (V3.on && gg && gg.home) fly3D(gg.home.x, gg.home.y); card(); plate.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }); } });
document.querySelectorAll('.ptabs [data-p]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.ptabs [data-p]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); $('p-' + x.dataset.p).hidden = !on; });
  sizeCanvas(); portKey = ''; ui(true); if (b.dataset.p === 'fates') drawFates(true);
}));
$('cardx').addEventListener('click', () => { sel = null; follow = false; $('card').innerHTML = EMPTY; });
$('card').addEventListener('click', e => { if (e.target.closest('#cfollow')) { follow = !follow; if (!follow) { vt.z = 1; } card(); } });
$('ticker').addEventListener('click', () => { const ev = S.events[+$('ticker').dataset.i]; if (ev) focus(ev, true); });
$('lf1').addEventListener('click', () => { logAll = false; $('lf1').classList.add('on'); $('lf2').classList.remove('on'); ui(true); });
$('lf2').addEventListener('click', () => { logAll = true; $('lf2').classList.add('on'); $('lf1').classList.remove('on'); ui(true); });
$('groups').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) { sel = +b.dataset.a; const ag = S._a.get(sel), gg = ag && S._g.get(ag.group); if (V3.on && gg && gg.home) fly3D(gg.home.x, gg.home.y); card(); plate.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }); } });
$('log').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b) return; const ev = S.events[+b.dataset.i]; if (ev) { focus(ev, true); plate.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }); } });
cv.addEventListener('pointerdown', e => {
  const r = cv.getBoundingClientRect(), dx = cv.width / r.width;
  const x = ((e.clientX - r.left) * dx - T.ox) / T.k, y = ((e.clientY - r.top) * dx - T.oy) / T.k;
  let best = null, bd = 32 / view.z;
  for (const a of S.agents) { const d = D.get(a.id); if (!d) continue; const dd = Math.hypot(d.x - x, d.y - y); if (dd < bd) { bd = dd; best = a; } }
  sel = best ? best.id : null;
  if (!sel) $('card').innerHTML = EMPTY;
  card();
});
new MutationObserver(readColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readColors);

function intro() {
  playing = false; acc = dayWatch ? dawnFraction() : 0; syncPlay();
  const landing = firstLanding(S);
  if (landing) {
    vt = { x: landing.x1, y: landing.y1, z: 1.65 };
    view = { ...vt };
    fly3D(landing.x1, landing.y1, true);
  }
  const box = $('focus'); box.style.setProperty('--c', C.slate);
  box.innerHTML = `<em>Год 0</em><strong>После кораблекрушения</strong><p>Ночью шторм разбил корабль. К утру шлюпки прибило к берегам острова. Выжившие вынесли на сушу то, что удалось спасти. Теперь им нужно найти пресную воду и место для ночлега.</p><div class="acts"><button class="main" id="go">Смотреть</button></div>`;
  box.hidden = false;
  $('go').onclick = () => { box.hidden = true; lastStop = performance.now() - 6000; playing = true; syncPlay(); };
}
function start(data) {
  readColors(); sizeCanvas();
  let restored = false;
  if (data && data.w) { try { S = SIM.restore(data.w); resetView(); restored = true; } catch (e) { world(2026); } }
  else world(2026);
  if (data && data.fork) { forkSnap = data.fork; forkLabel = data.forkLabel || ''; $('back').disabled = false; $('back').textContent = `Вернуться к ${forkLabel}`; }
  window.claude?.hot?.snapshot?.(() => ({ w: SIM.serialize(S), fork: forkSnap, forkLabel }));
  if (!restored) intro();
  set3D(true);
  requestAnimationFrame(t => { last = t; frame(t); });
}
window.__lab = () => S; window.__v3 = () => V3;
window.__labAdvance = async days => {
  playing = false;
  if (mainRunner.busy) mainRunner.reset();
  syncPlay();
  const target = S.tick + days;
  while (S.tick < target) {
    const completed = await new Promise(resolve => mainRunner.advance(Math.min(360, target - S.tick), resolve));
    if (!completed) throw new Error('World advance interrupted');
  }
  seenEv = S.evId || 0;
  ui(true);
};
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
