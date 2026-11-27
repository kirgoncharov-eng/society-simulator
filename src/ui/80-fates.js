/* ---------- fates: stories from life chronicles ---------- */
const ARC = [
  ['murder', 'Кровь за кровь'], ['revenge', 'Месть'], ['elope', 'Беглецы'], ['returned', 'Изгнанник вернулся'],
  ['deposed', 'Взлёт и падение'], ['heir', 'Наследник'], ['coup', 'Переворот'], ['leader', 'Путь к власти'], ['exiled', 'Изгнанник'],
  ['bond', 'Кабала'], ['master', 'Мастер'], ['plague', 'Переживший мор']
];
const yr = t => { const y = Math.floor(t / 360); return y < 0 ? '−' + (-y) : y; };
function arcOf(p) {
  const ks = new Set(p.bio.map(b => b[1]));
  if (ks.has('leader') && (ks.has('client') || ks.has('bond') || ks.has('orphan') || ks.has('retainer'))) return 'Из низов в вожди';
  for (const [k, t] of ARC) if (ks.has(k)) return t;
  const dead = p.bio.filter(b => b[1] === 'childDied').length; if (dead >= 4) return 'Пережить своих детей';
  return 'Простая жизнь';
}
function storyText(p, full) {
  const B = p.bio, kids = B.filter(b => b[1] === 'child').length, kd = B.filter(b => b[1] === 'childDied').length;
  const key = B.filter(b => !['child', 'childDied', 'move'].includes(b[1]) || (b[1] === 'move' && (full || b[3])));
  const pick = full ? key : key.filter(b => (({ born: 1, marry: 1, death: 1, drowned: 1 })[b[1]]) || b[3] || ['leader', 'deposed', 'coup', 'schism', 'found', 'exiled', 'feud', 'revenge', 'murder', 'elope', 'returned', 'heir', 'bond', 'freed', 'master', 'client', 'retainer', 'plague', 'orphan', 'spouseDied', 'enemy', 'sworn', 'love', 'betrayed', 'reconcile', 'affair', 'jealousy'].includes(b[1])).slice(0, 9);
  const lines = pick.map(b => `<li><time>${yr(b[0])}</time><span>${esc(b[2])}${evLink(b[3])}</span></li>`);
  const fam = kids ? `<p class="famline">${kids} ${kids % 10 === 1 && kids % 100 !== 11 ? 'ребёнок' : kids % 10 > 1 && kids % 10 < 5 && (kids % 100 < 12 || kids % 100 > 14) ? 'ребёнка' : 'детей'}${kd ? `, из них ${kd} ${kd % 10 === 1 && kd % 100 !== 11 ? 'умер' : 'умерли'} в детстве` : ''}.</p>` : '';
  return `<ol class="life">${lines.join('')}</ol>${fam}`;
}
// arcs: what a person wanted, the turns on the way and how it ended; each step opens its event
function arcsHtml(goals, open) {
  const G = (goals || []).filter(x => open || x.end);
  if (!G.length) return '';
  const step = (cls, t, txt, ev) => `<span class="${cls}"><time>${yr(t)}</time> ${esc(txt)}${evLink(ev)}</span>`;
  return `<ul class="arcs">${G.map(x => `<li><b>${esc(SIM.GOAL_NAME[x.k] || x.k)}</b>${x.end ? ` · <em class="out-${x.out}">${esc(SIM.GOAL_OUT[x.out] || x.out)}</em>` : ' · <em>в пути</em>'}<br>${step('tie', x.t, x.txt, x.ev)}${(x.turns || []).map(t => ' → ' + step('turn', t[0], t[1], t[2])).join('')}${x.end ? ' → ' + step('end', x.end, x.endTxt, x.endEv) : ''}</li>`).join('')}</ul>`;
}
function fateList() {
  // ranked in the engine by the weight of their turns, the same list the audit measures
  return SIM.topFates(S, 12).map(p => Object.assign(p, { arc: arcOf(p) }));
}
let fateKey = '';
function drawFates(force) {
  const box = $('fates'); if (!box || $('p-fates').hidden) return;
  const L = fateList(), k = L.map(p => p.id + ':' + p.bio.length).join(',');
  if (!force && k === fateKey) return; fateKey = k;
  if (!L.length) { box.innerHTML = '<p class="empty">Пока ни одна жизнь не сложилась в историю. Дайте миру прожить хотя бы двадцать лет.</p>'; return; }
  box.innerHTML = L.map(p => `<article class="fate${p.alive ? '' : ' gone'}">
    <p class="kick">${esc(p.arc)}${p.alive ? '' : ' · память'}</p>
    <h3>${esc(p.name)} <small>${yr(p.born)}–${p.alive ? 'жив' + (p.sex === 'f' ? 'а' : '') : yr(p.died)}</small></h3>
    ${arcsHtml(p.goals)}
    ${storyText(p)}
    <div class="fbtn">${p.alive ? `<button data-follow="${p.id}">Следить за ${p.sex === 'f' ? 'ней' : 'ним'}</button>` : ''}<button data-full="${p.id}">Вся летопись</button></div>
  </article>`).join('');
}
function fateById(id) { const a = S._a.get(id); if (a) return { name: a.name, sex: a.sex, bio: a.bio || [], goals: a.goals, born: a.bornT !== undefined ? a.bornT : S.tick - a.age * 360, alive: true }; const l = (S.legends || []).find(x => x.id === id) || (S.shades && S.shades[id]); return l ? Object.assign({ alive: false }, l) : null; }
$('fates').addEventListener('click', e => {
  const f = e.target.closest('[data-follow]'), u = e.target.closest('[data-full]');
  if (f) { sel = +f.dataset.follow; follow = true; card(); const a = S._a.get(sel), g = a && S._g.get(a.group); if (V3.on && a) fly3D(a.x, a.y); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  if (u) { const p = fateById(+u.dataset.full); if (!p) return; const art = u.closest('article'); const ol = art.querySelector('ol.life'); if (ol) ol.outerHTML = storyText(p, true).replace(/<p class="famline">.*<\/p>/, ''); u.remove(); }
});
let follow = false;

