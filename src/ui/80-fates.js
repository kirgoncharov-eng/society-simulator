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
  const key = B.filter(b => !['child', 'childDied', 'move'].includes(b[1]) || (b[1] === 'move' && full));
  const pick = full ? key : key.filter(b => (({ born: 1, marry: 1, death: 1, drowned: 1 })[b[1]]) || ['leader', 'deposed', 'coup', 'schism', 'found', 'exiled', 'feud', 'revenge', 'murder', 'elope', 'returned', 'heir', 'bond', 'freed', 'master', 'client', 'retainer', 'plague', 'orphan', 'spouseDied', 'enemy', 'sworn', 'love', 'betrayed', 'reconcile'].includes(b[1])).slice(0, 9);
  const lines = pick.map(b => `<li><time>${yr(b[0])}</time><span>${esc(b[2])}</span></li>`);
  const fam = kids ? `<p class="famline">${kids} ${kids % 10 === 1 && kids % 100 !== 11 ? 'ребёнок' : kids % 10 > 1 && kids % 10 < 5 && (kids % 100 < 12 || kids % 100 > 14) ? 'ребёнка' : 'детей'}${kd ? `, из них ${kd} ${kd % 10 === 1 && kd % 100 !== 11 ? 'умер' : 'умерли'} в детстве` : ''}.</p>` : '';
  return `<ol class="life">${lines.join('')}</ol>${fam}`;
}
function fateList() {
  const alive = S.agents.filter(a => a.bio && (a.drama || 0) >= 9).map(a => ({ id: a.id, name: a.name, sex: a.sex, bio: a.bio, drama: a.drama, alive: true, born: a.bornT !== undefined ? a.bornT : S.tick - a.age * 360, g: a.group }));
  const dead = (S.legends || []).map(l => Object.assign({ alive: false }, l));
  const all = alive.concat(dead).map(p => Object.assign(p, { arc: arcOf(p), kinds: new Set(p.bio.map(b => b[1])).size }));
  all.sort((x, y) => (y.drama * (0.6 + y.kinds / 12)) - (x.drama * (0.6 + x.kinds / 12)));
  return all.slice(0, 12);
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
    ${storyText(p)}
    <div class="fbtn">${p.alive ? `<button data-follow="${p.id}">Следить за ${p.sex === 'f' ? 'ней' : 'ним'}</button>` : ''}<button data-full="${p.id}">Вся летопись</button></div>
  </article>`).join('');
}
function fateById(id) { const a = S._a.get(id); if (a) return { name: a.name, sex: a.sex, bio: a.bio || [], born: a.bornT !== undefined ? a.bornT : S.tick - a.age * 360, alive: true }; const l = (S.legends || []).find(x => x.id === id); return l ? Object.assign({ alive: false }, l) : null; }
$('fates').addEventListener('click', e => {
  const f = e.target.closest('[data-follow]'), u = e.target.closest('[data-full]');
  if (f) { sel = +f.dataset.follow; follow = true; card(); const a = S._a.get(sel), g = a && S._g.get(a.group); if (V3.on && a) fly3D(a.x, a.y); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  if (u) { const p = fateById(+u.dataset.full); if (!p) return; const art = u.closest('article'); const ol = art.querySelector('ol.life'); if (ol) ol.outerHTML = storyText(p, true).replace(/<p class="famline">.*<\/p>/, ''); u.remove(); }
});
let follow = false;

