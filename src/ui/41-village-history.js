/* ---------- Н3: how a village became what it is ---------- */
// The page reads the village's own chronicle (SIM.villageHistory): a line of figures for every year and the turning
// points with their causes. It answers three questions without debug data: how the regime changed and why, who got the
// land, and who ruled and how much they took.
const VH_SKIP = new Set(['reform', 'colony']);
const vhYear = t => Math.floor(t / 360);
function vhPerson(id) { const p = id && SIM.personOf(S, id); return p ? p.name : null; }
function vhShare(v) { return `${v} % (${SIM.word('take', v / 100, null, true)})`; }
function vhHold(hold, fields) { return hold.length ? hold.map(([k, n]) => `${esc(k)} ${n}`).join(', ') + ` из ${fields}` : 'поля общие'; }

// the path of the regime: the first label and every change, each change opens its event
function vhPath(h) {
  const first = h.rows[0], steps = [];
  if (first && first[6]) steps.push(`${esc(first[6].toLowerCase())} <small>г.${first[0]}</small>`);
  for (const e of h.turns) if (e.type === 'regime') {
    const to = (e.text.split('→')[1] || '').trim();
    steps.push(`<button class="evlink" data-ev="${e.id}">${esc(to)}</button> <small>г.${vhYear(e.t)}${e.drift ? ', постепенно' : ''}</small>`);
  }
  return steps.length ? `<p class="vh-path"><b>Путь строя:</b> ${steps.join(' → ')}</p>` : '';
}
// the land: when it was divided, who got it, how the share of the largest holder grew
function vhLand(h) {
  const priv = h.rows.filter(r => r[8] === 'private');
  if (!priv.length) return '<p><b>Земля</b> всё время общая: полями владеет деревня.</p>';
  const law = h.turns.find(e => e.type === 'land' && e.law === 'land');
  const first = priv[0], last = priv[priv.length - 1];
  const share = r => r[10].length && r[9] ? Math.round(100 * r[10][0][1] / r[9]) : 0;
  const owners = law && (law.backers || []).map(vhPerson).filter(Boolean);
  const lost = law && (law.against || []).map(vhPerson).filter(Boolean);
  const big = h.turns.find(e => e.type === 'land' && !e.law);
  return `<p><b>Земля.</b> ${law ? `Поля поделены в собственность в г.${vhYear(law.t)} <button class="evlink" data-ev="${law.id}" aria-label="Открыть событие">↗</button>.` : `Поля в собственности с г.${first[0]}.`}
    ${owners && owners.length ? `Получили: ${esc(owners.join(', '))}.` : ''} ${lost && lost.length ? `Остались без поля и были против: ${esc(lost.join(', '))}.` : ''}
    По родам в г.${first[0]}: ${vhHold(first[10], first[9])}; сейчас: ${vhHold(last[10], last[9])}.
    У крупнейшего рода ${share(first)} % полей → ${share(last)} %.${big ? ` ${esc(big.text)} <small>г.${vhYear(big.t)}</small>.` : ''}</p>`;
}
// rulers and their lines, and the leader's share, from one change to the next
function vhPower(h) {
  const runs = [];
  for (const r of h.rows) { const p = runs[runs.length - 1]; if (p && p.name === r[2]) { p.to = r[0]; p.take.push(r[5]); } else runs.push({ name: r[2], lin: r[3], dyn: r[4], from: r[0], to: r[0], take: [r[5]] }); }
  if (!runs.length) return '';
  return `<p><b>Кто правил:</b> ${runs.map(x => `${esc(x.name)}${x.lin ? ` из ${esc(x.lin)}` : ''}${x.dyn ? ' (наследственно)' : ''} <small>г.${x.from}${x.to > x.from ? '–' + x.to : ''}</small>, доля вождя ${vhShare(x.take[0])}${x.take[x.take.length - 1] !== x.take[0] ? ` → ${vhShare(x.take[x.take.length - 1])}` : ''}`).join('; ')}.</p>`;
}
// one line every ten years: people, ruler, share, land, regime
function vhTable(h) {
  const rows = h.rows.filter((r, i) => i === 0 || i === h.rows.length - 1 || r[0] % 10 === 0);
  return `<table class="vh-table"><thead><tr><th>год</th><th>людей</th><th>правит</th><th>доля вождя</th><th>поля по родам</th><th>строй</th></tr></thead><tbody>${rows.map(r =>
    `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${esc(r[2])}${r[3] ? ` <small>из ${esc(r[3])}</small>` : ''}</td><td>${r[5]} %</td><td>${r[8] === 'private' ? vhHold(r[10], r[9]) : 'общие'}</td><td>${esc(r[6] || '')}</td></tr>`).join('')}</tbody></table>`;
}
// the turning points, oldest first; a law names its author and opponents; frequent small reforms are counted
function vhTurns(h) {
  const skipped = h.turns.filter(e => VH_SKIP.has(e.type));
  const items = h.turns.filter(e => !VH_SKIP.has(e.type)).map(e => {
    const author = vhPerson(e.author), against = (e.against || []).map(vhPerson).filter(Boolean);
    const sides = e.author ? ` <small>${author ? `предложил${(SIM.personOf(S, e.author) || {}).sex === 'f' ? 'а' : ''} ${esc(author)}` : ''}${against.length ? `; против — ${esc(against.join(', '))}` : ''}</small>` : '';
    const cause = (e.causes || []).map(id => visibleEvent(id)).filter(Boolean)[0];
    return `<li><time>г.${vhYear(e.t)}</time> <button class="evlink" data-ev="${e.id}">${esc(e.text)}</button>${sides}${cause ? `<br><small>причина: ${esc(cause.text)} (г.${vhYear(cause.t)})</small>` : ''}</li>`;
  });
  const reforms = skipped.filter(e => e.type === 'reform').length, colonies = skipped.filter(e => e.type === 'colony').length;
  const extra = [reforms ? `вождь наводил порядок ${reforms} раз` : '', colonies ? `дочерних деревень ушло ${colonies}` : ''].filter(Boolean).join('; ');
  return `<ol class="vh-turns">${items.join('')}</ol>${extra ? `<p class="who">Кроме того: ${extra}.</p>` : ''}`;
}
function villageHistoryHtml(gid) {
  const h = SIM.villageHistory(S, gid);
  if (!h) return '<p class="empty">Этой деревни больше нет.</p>';
  return `<h3>Как «${esc(h.name)}» стала такой</h3>
    <p class="role">Основана в г.${vhYear(h.founded)}${h.founder ? `, основатель ${esc(h.founder)}` : ''}. Сейчас: ${esc((h.rtype || '').toLowerCase())}.</p>
    ${vhPath(h)}${vhLand(h)}${vhPower(h)}
    <details class="vh-more"><summary>По десятилетиям</summary>${vhTable(h)}</details>
    <h4>Поворотные события</h4>${vhTurns(h)}`;
}
function openVillageHistory(gid) {
  const box = $('vhist');
  box.querySelector('.vh-body').innerHTML = villageHistoryHtml(gid);
  box.hidden = false;
  box.querySelector('.vh-body').scrollTop = 0;
}
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-vh]');
  if (b) { ev.preventDefault(); ev.stopPropagation(); openVillageHistory(+b.dataset.vh); return; }
  // an event opened from the page shows in the event panel on the map: the page steps aside
  if (ev.target.closest && ev.target.closest('#vhist [data-ev]')) { $('vhist').hidden = true; return; }
  if (ev.target.closest && ev.target.closest('#vhistx')) $('vhist').hidden = true;
});
