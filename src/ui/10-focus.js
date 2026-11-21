/* ---------- focus: auto-stop, camera, explanation ---------- */
// linked chronicle: the events that led to this one, each can be opened (even years later, after it left the feed)
function causesHtml(e) {
  const cs = (e.causes || []).map(id => SIM.eventById(S, id)).filter(Boolean);
  return cs.length ? `<p class="causes"><b>Причина:</b> ${cs.map(c => `<button class="evlink" data-ev="${c.id}">${esc(c.text)} · ${SIM.date(c.t)}</button>`).join(' ')}</p>` : '';
}
function evLink(id) { return id && SIM.eventById(S, id) ? ` <button class="evlink" data-ev="${id}" aria-label="Открыть событие-причину" title="Открыть событие-причину">↗</button>` : ''; }
// any [data-ev] button opens that event in the focus box
document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('[data-ev]'); if (!b) return; const e = SIM.eventById(S, +b.dataset.ev); if (e) { ev.preventDefault(); focus(e, true); } });
function focus(e, pause) {
  focusEv = e;
  if (pause) {
    playing = false;
    if (mainRunner.busy) mainRunner.reset();
    syncPlay();
  }
  if (e.x !== undefined && e.x !== null) { const z = 1.9; vt = { x: e.x, y: e.y + 150 / z, z }; if (!V3.on) $('camZoom').value = Math.round(100 * Math.log(z) / Math.log(5)); fly3D(e.x, e.y); }
  else vt = { x: 500, y: 500, z: 1 };
  const box = $('focus');
  box.style.setProperty('--c', typeColor(e.type, 1, e.hue));
  const people = (e.who || []).map(id => S._a.get(id)).filter(Boolean);
  box.innerHTML = `<em>${TL[e.type] || 'Событие'} · ${SIM.date(e.t)}</em><strong>${esc(e.text)}</strong>${e.why ? `<p><b>Почему:</b> ${esc(e.why)}</p>` : ''}${causesHtml(e)}${people.length ? `<p class="who">Подсвечены участники: ${esc(people.slice(0, 6).map(a => a.name).join(', '))}${people.length > 6 ? ` и ещё ${people.length - 6}` : ''}.</p>` : ''}
  <div class="acts"><button class="main" id="go">${playing ? 'Закрыть' : 'Дальше'}</button>${people[0] ? `<button id="follow">Следить за ${esc(people[0].name)}</button>` : ''}</div>`;
  box.hidden = false;
  $('go').onclick = () => { closeFocus(); if (!playing) { playing = true; syncPlay(); } };
  if ($('follow')) $('follow').onclick = () => { sel = people[0].id; closeFocus(); playing = true; syncPlay(); card(); };
}
function closeFocus(silent) {
  focusEv = null;
  if (S) islandCamera();
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

