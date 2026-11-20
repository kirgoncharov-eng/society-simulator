/* ---------- focus: auto-stop, camera, explanation ---------- */
function focus(e, pause) {
  focusEv = e;
  if (pause) { playing = false; syncPlay(); }
  if (e.x !== undefined && e.x !== null) { const z = 1.9; vt = { x: e.x, y: e.y + 150 / z, z }; }
  else vt = { x: 500, y: 500, z: 1 };
  const box = $('focus');
  box.style.setProperty('--c', typeColor(e.type, 1, e.hue));
  const people = (e.who || []).map(id => S._a.get(id)).filter(Boolean);
  box.innerHTML = `<em>${TL[e.type] || 'Событие'} · ${SIM.date(e.t)}</em><strong>${esc(e.text)}</strong>${e.why ? `<p><b>Почему:</b> ${esc(e.why)}</p>` : ''}${people.length ? `<p class="who">Подсвечены участники: ${esc(people.slice(0, 6).map(a => a.name).join(', '))}${people.length > 6 ? ` и ещё ${people.length - 6}` : ''}.</p>` : ''}
  <div class="acts"><button class="main" id="go">${playing ? 'Закрыть' : 'Дальше'}</button>${people[0] ? `<button id="follow">Следить за ${esc(people[0].name)}</button>` : ''}</div>`;
  box.hidden = false;
  $('go').onclick = () => { closeFocus(); if (!playing) { playing = true; syncPlay(); } };
  if ($('follow')) $('follow').onclick = () => { sel = people[0].id; closeFocus(); playing = true; syncPlay(); card(); };
}
function closeFocus(silent) {
  focusEv = null; vt = { x: 500, y: 500, z: 1 };
  $('focus').hidden = true;
  if (!silent) lastStop = performance.now();
}
function checkStops(now) {
  const evs = S.events, fresh = [];
  for (const e of evs) { if ((e.id || 0) <= seenEv) break; fresh.push(e); }
  if (!fresh.length) return;
  seenEv = evs[0].id || seenEv;
  if (!$('stops').checked || focusEv) return;
  if (now - lastStop < 9000 || S.tick - lastStopTick < 360) return;
  const e = fresh.find(isMajor);
  if (!e) return;
  lastStop = now; lastStopTick = S.tick;
  focus(e, true);
}

