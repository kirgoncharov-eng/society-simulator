/* ---------- focus: auto-stop, camera, explanation ---------- */
// linked chronicle: the events that led to this one, each can be opened (even years later, after it left the feed)
function causesHtml(e) {
  const cs = (e.causes || []).map(id => visibleEvent(id)).filter(Boolean);
  return cs.length ? `<p class="causes"><b>Причина:</b> ${cs.map(c => `<button class="evlink" data-ev="${c.id}">${esc(c.text)} · ${eventDate(c)}</button>`).join(' ')}</p>` : '';
}
function evLink(id) { return id && visibleEvent(id) ? ` <button class="evlink" data-ev="${id}" aria-label="Открыть событие-причину" title="Открыть событие-причину">↗</button>` : ''; }
// any [data-ev] button opens that event in the focus box
document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('[data-ev]'); if (!b) return; const e = visibleEvent(+b.dataset.ev); if (e) { ev.preventDefault(); focus(e, true); } });
function eventPeople(e) {
  const ids = new Set([...(e.who || []), ...(e.author ? [e.author] : []), ...(e.against || [])]);
  const people = [];
  let missing = 0;
  for (const id of ids) {
    const person = fateById(id);
    if (!person) { missing++; continue; }
    const role = e.author === id ? (person.sex === 'f' ? 'предложила' : 'предложил') : e.against?.includes(id) ? 'против' : '';
    const label = esc(person.name) + (role ? ` <small>${role}</small>` : '');
    people.push(person.alive
      ? `<button type="button" class="evlink" data-event-person="${id}" title="Открыть карточку и следить">${label}</button>`
      : `<details class="event-fate" data-event-fate="${id}"><summary>${label} · летопись</summary><div></div></details>`);
  }
  if (!people.length && !missing) return '';
  return `<div class="event-people"><b>Участники</b><div>${people.join('')}</div>${missing ? '<p class="who">Летописи некоторых участников не сохранились.</p>' : ''}</div>`;
}
function focus(e, pause, causeRoot) {
  focusEv = e;
  if (pause) {
    playing = false;
    clockCredit = 0;
    if (mainRunner.busy) mainRunner.reset();
    syncPlay();
  }
  if (e.x !== undefined && e.x !== null) { const z = 1.9; vt = { x: e.x, y: e.y + 150 / z, z }; if (!V3.on) $('camZoom').value = Math.round(100 * Math.log(z) / Math.log(5)); fly3D(e.x, e.y); }
  else vt = { x: 500, y: 500, z: 1 };
  const box = $('focus');
  box.style.setProperty('--c', typeColor(e.type, 1, e.hue));
  const root = causeRoot || e;
  const hasMap = root.causes?.some(id => id < root.id && visibleEvent(id));
  const map = hasMap ? `<details id="causeMap" class="cause-map"${causeRoot ? ' open' : ''}>
    <summary>Карта причин</summary><div class="cause-viewport" role="region" aria-label="Карта причин" tabindex="0"></div>
    <p class="who cause-more" hidden>На карте ближайшие причины. Другие связи можно открыть из карточек событий.</p></details>` : '';
  box.innerHTML = `<em>${TL[e.type] || 'Событие'} · ${eventDate(e)}</em><strong>${esc(e.text)}</strong>${e.why ? `<p><b>Почему:</b> ${esc(e.why)}</p>` : ''}${causesHtml(e)}${eventPeople(e)}${map}
  <div class="acts"><button class="main" id="go">${playing ? 'Закрыть' : 'Дальше'}</button></div>`;
  box.hidden = false;
  $('go').onclick = () => { closeFocus(); if (!playing) { playing = true; syncPlay(); } };
  for (const button of box.querySelectorAll('[data-event-person]')) button.onclick = () => {
    sel = +button.dataset.eventPerson;
    followVillage = directed = null;
    closeFocus();
    follow = true;
    playing = true;
    syncPlay();
    card();
  };
  for (const details of box.querySelectorAll('[data-event-fate]')) details.addEventListener('toggle', () => {
    if (!details.open || details.lastElementChild.hasChildNodes()) return;
    const person = fateById(+details.dataset.eventFate);
    if (person) details.lastElementChild.innerHTML = arcsHtml(person.goals, true) + storyText(person, true);
  });

  if (hasMap) {
    const details = $('causeMap');
    const viewport = details.querySelector('.cause-viewport');
    const render = () => drawCauseMap(viewport, root, e);
    details.addEventListener('toggle', () => { if (details.open && !viewport.firstChild) render(); });
    viewport.onclick = event => {
      const button = event.target.closest('[data-cause-node]');
      const node = button && visibleEvent(+button.dataset.causeNode);
      if (!node || node.id === e.id) return;
      focus(node, true, root);
      $('causeMap').querySelector('[aria-current="step"]')?.focus({ preventScroll: true });
    };
    if (details.open) render();
  }
}
function closeFocus(silent) {
  focusEv = null;
  if (S) islandCamera();
  $('focus').hidden = true;
  if (!silent) lastStop = performance.now();
}
function checkStops(now) {
  const fresh = visibleEvents().filter(e => (e.id || 0) > seenEv);
  if (!fresh.length) return;
  seenEv = Math.max(seenEv, ...fresh.map(e => e.id));
  if (!$('stops').checked || focusEv) return;
  if (now - lastStop < 9000 || S.tick - lastStopTick < 360) return;
  const e = fresh.find(isMajor);
  if (!e) return;
  lastStop = now; lastStopTick = S.tick;
  focus(e, true);
}

