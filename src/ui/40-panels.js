/* ---------- panels ---------- */
function spark(id, arr) {
  const c = $(id), dpr = Math.min(2, devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight;
  if (!w) return;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const x = c.getContext('2d'), data = arr.slice(-240);
  x.clearRect(0, 0, c.width, c.height);
  if (data.length < 2) return;
  const mx = Math.max(...data), mn = Math.min(0, ...data), rng = (mx - mn) || 1;
  x.beginPath();
  data.forEach((v, i) => { const px = i / (data.length - 1) * c.width, py = c.height - 2 * dpr - (v - mn) / rng * (c.height - 4 * dpr); i ? x.lineTo(px, py) : x.moveTo(px, py); });
  x.strokeStyle = C.slate; x.lineWidth = 1.5 * dpr; x.stroke();
  x.lineTo(c.width, c.height); x.lineTo(0, c.height); x.closePath(); x.fillStyle = rgba(C.slate, .12); x.fill();
}
const QF = { food: ['мера еды', 'меры еды', 'мер еды'], wood: ['бревно', 'бревна', 'брёвен'], stone: ['глыба камня', 'глыбы камня', 'глыб камня'], tools: ['орудие', 'орудия', 'орудий'] };
const goodsTxt = (q, k) => { const n = Math.max(1, Math.round(q)), f = QF[k]; return `${n} ${n % 10 === 1 && n % 100 !== 11 ? f[0] : (n % 10 > 1 && n % 10 < 5 && (n % 100 < 12 || n % 100 > 14)) ? f[1] : f[2]}`; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = v => Math.round(v * 100);
function ui(force) {
  RC.clear(); for (const g of S.groups) if (g.home) RC.set(g.id, SIM.regime(S, g));
  $('year').textContent = `Год ${Math.floor(S.tick / 360)}`;
  const weather = S.weather?.kind;
  const weatherLabel = weather === 'storm' ? '🌊 шторм' : weather === 'rain' ? '☂ дождь'
    : weather === 'frost' ? '❄ ранний мороз' : S.tick < (S.drought || 0) ? '☀ засуха' : '';
  $('season').textContent = ['зима', 'весна', 'лето', 'осень'][Math.floor((S.tick % 360) / 90)] + (weatherLabel ? ' · ' + weatherLabel : '');
  const h = S.hist, inG = S.groups.reduce((s, g) => s + g.members.length, 0);
  $('mPop').textContent = SIM.popOf(S);
  drawFates();
  $('hYear').textContent = $('year').textContent; $('hSeason').textContent = $('season').textContent;
  $('hPop').textContent = SIM.popOf(S); $('hGroups').textContent = S.groups.length;
  $('hEnt').textContent = (h.entropy[h.entropy.length - 1] || 0).toFixed(2); $('hGini').textContent = (h.gini[h.gini.length - 1] || 0).toFixed(2);
  { const ti = S.events.findIndex(e => isKey(e) && e.type !== 'genesis'), tb = $('ticker');
    if (ti >= 0) { const e = S.events[ti]; tb.hidden = false; tb.dataset.i = ti; tb.innerHTML = `<time>${SIM.date(e.t)}</time>${esc(e.text)}`; } else tb.hidden = true; }
  $('mGroups').textContent = `${S.groups.length}`;
  $('mEnt').textContent = (h.entropy[h.entropy.length - 1] || 0).toFixed(2);
  $('mGini').textContent = (h.gini[h.gini.length - 1] || 0).toFixed(2);
  spark('sPop', h.pop); spark('sGroups', h.groups); spark('sEnt', h.entropy); spark('sGini', h.gini);
  const big = S.groups.reduce((m, g) => g.members.length > (m ? m.members.length : 0) ? g : m, null);
  const st = S.stats, maxD = S.groups.reduce((m, g) => Math.max(m, g.depth), 0);
  $('tally').textContent = `В группах ${S.agents.length ? pct(inG / S.agents.length) : 0}% агентов. Крупнейшая: ${big ? `«${big.name}», ${big.members.length}` : 'нет'}. Поселений ${S.groups.filter(g => g.home).length}, домов ${S.groups.reduce((s, g) => s + g.houses.length, 0)}, полей ${S.groups.reduce((s, g) => s + g.fields.length, 0)}, мастерских ${S.groups.filter(g => g.workshop).length}, руин ${(S.ruins || []).length}. Мастеров ${S.agents.filter(a => a.master && a.master !== 'gather').length}. Государств сейчас ${(S.states || []).length} (возникало ${st.states || 0}). Походов ${st.wars || 0}, битв ${st.battles || 0}, завоеваний ${st.conquests || 0}, восстаний ${st.revolts || 0}, грабежей караванов ${st.raids || 0}; в боях погибло ${st.war || 0}; стража прогоняла чужаков ${st.border || 0} раз; монета в ${S.groups.filter(g => g.coin).length} дер., займов ${st.loans || 0}, в кабале сейчас ${S.agents.filter(a => a.bond).length}, списаний долгов ${st.jubilees || 0}, восстаний должников ${st.debtRevolts || 0}; данников сейчас ${S.groups.filter(g => g.lord).length}. Караванов в пути ${S.agents.filter(a => a.car).length}, торговых путей ${Object.keys(S.routes || {}).length}, сделок ${S.stats.trades || 0}. Иерархия до ${maxD || 1} ур. За всё время: переворотов ${st.coups}, расколов ${st.schisms}, стычек ${st.conflicts}, слияний ${st.merges}, реформ ${st.reforms}.`;
  if (force || S.events[0] !== lastEvt) {
    lastEvt = S.events[0];
    const list = S.events.map((e, i) => [e, i]).filter(([e]) => logAll || isKey(e)).slice(0, 50);
    $('log').innerHTML = list.map(([e, i]) => `<li><button class="ev${isMajor(e) ? ' big' : ''}${e.type === 'era' ? ' era' : ''}" data-i="${i}"><i style="background:${typeColor(e.type, 1, e.hue)}"></i><span><time>${SIM.date(e.t)} · ${TL[e.type] || ''}</time>${esc(e.text)}${(isMajor(e) || e.type === 'era' || e.type === 'law' || e.type === 'faith') && e.why ? `<small>${esc(e.why)}</small>` : ''}</span></button></li>`).join('') || '<li class="empty">Пока ничего важного.</li>';
  }
  const gs = S.groups.slice().sort((a, b) => b.members.length - a.members.length).slice(0, 10);
  $('groups').innerHTML = gs.length ? gs.map(g => {
    const L = S._a.get(g.leader), age = Math.floor((S.tick - g.founded) / 360);
    return `<button class="grp" data-a="${g.leader}"><i style="background:${hueC(g.hue)}"></i><strong>${esc(g.name)}${g.home && g.members.length >= 5 && RC.get(g.id) ? ` · <span style="font-weight:400;color:var(--slate)">${esc(RC.get(g.id).type.toLowerCase())}</span>` : ''}</strong><span class="n">${g.members.length}</span>
    <small>лидер ${esc(L ? L.name : '?')}${g.gen > 1 ? `, ${g.gen}-й по счёту` : ', основатель'} · ${age ? yrsTxt(age) : 'меньше года'} · ${g.home ? `домов ${g.houses.length}, полей ${g.fields.length}${g.workshop ? ', мастерская' : ''}${g.granary ? ', амбар' : ''}${g.walls ? ', частокол' : ''}${g.terr ? `, земли ${g.terr} кл.` : ''}${g.gov === 'assembly' ? ', вече' : ''}${g.land === 'private' ? ', частные поля' : ''}${g.coin ? ', монета' : ''}${g.lord && S._g.get(g.lord) ? ` · данник «${esc(S._g.get(g.lord).name)}»` : ''}${(() => { const v = S.groups.filter(o => o.lord === g.id); return v.length ? ` · данники: ${esc(v.map(o => o.name).join(', '))}` : ''; })()} · еда ${Math.round(g.treasury)}, лес ${Math.round(g.wood)}, камень ${Math.round(g.stone || 0)}, орудия ${Math.round(g.tools || 0)}${g.stoneCell === null ? ' · холмов рядом нет' : ''}` : 'кочует'} · ${g.depth} ур. · энтропия ${g.entropy.toFixed(2)}</small>
    <span class="meter"><span style="width:${Math.min(100, g.entropy / 2.5 * 100)}%"></span></span></button>`;
  }).join('') : '<p class="empty">Групп пока нет: агенты ещё присматриваются друг к другу.</p>';
  drawRiver();
  drawMarket();
  drawSoc();
  portraits(force);
  card();
}
function row(label, v, neg) {
  const w = Math.min(100, Math.abs(v) * 100);
  return `<div class="tr"><em>${label}</em><span class="meter${neg || v < 0 ? ' neg' : ''}"><span style="width:${w}%"></span></span><b>${v < 0 ? '−' : ''}${pct(Math.abs(v))}</b></div>`;
}
const EMPTY = '<p class="empty">Нажмите на человека на карте, чтобы проследить за ним: роль, начальник, доверие к лидеру, груз и обиды.</p>';
function famTxt(a, g, L) {
  const sp = a.spouse && S._a.get(a.spouse), mo = a.mother && S._a.get(a.mother), fa = a.father && S._a.get(a.father);
  const grown = S.agents.filter(o => o.mother === a.id || o.father === a.id), young = SIM.kidsOf(S, a);
  const kids = grown.length + young;
  const parts = [];
  if (sp) parts.push(`${a.sex === 'f' ? 'Замужем за' : 'Женат на'} ${esc(sp.name)}${sp.group !== a.group ? `, ${sp.group && S._g.get(sp.group) ? `из «${esc(S._g.get(sp.group).name)}»` : 'кочует'}` : ''}`);
  else parts.push(a.age < 17 ? 'Ещё молод для брака' : a.sex === 'f' ? 'Не замужем' : 'Не женат');
  if (kids) parts.push(`${kids} ${kids % 10 === 1 && kids % 100 !== 11 ? 'ребёнок' : kids % 10 > 1 && kids % 10 < 5 && (kids % 100 < 12 || kids % 100 > 14) ? 'ребёнка' : 'детей'}${young ? ` (${young} ещё ${young === 1 ? 'мал' : 'малы'})` : ''}${grown.length ? `: ${grown.slice(0, 3).map(o => esc(o.name)).join(', ')}${grown.length > 3 ? ' и другие' : ''}` : ''}`);
  if (mo || fa) parts.push(`родители: ${[mo, fa].filter(Boolean).map(o => esc(o.name)).join(' и ')}`);
  const pt = a.patron && S._a.get(a.patron), cl = S.agents.filter(o => o.patron === a.id).length;
  const rep = a.rep || 0, repT = rep > 0.35 ? 'Слава доброго человека' : rep > 0.12 ? 'Хорошая слава' : rep < -0.35 ? 'Дурная слава' : rep < -0.12 ? 'О нём шепчутся' : '';
  const soc = [];
  if (pt) soc.push(pt === L ? `дружинник вождя ${esc(pt.name)}: получает плату и стоит за него` : `клиент ${esc(pt.name)}: тот выручил в голод, теперь ${a.sex === 'f' ? 'она' : 'он'} отдаёт часть заработка и поддержит его`);
  const pl1 = (n, a1, a2) => n % 10 === 1 && n % 100 !== 11 ? a1 : a2;
  if (cl) soc.push(a.role === 'leader' ? `содержит дружину: ${cl} ${cl % 10 > 1 && cl % 10 < 5 && (cl % 100 < 12 || cl % 100 > 14) ? 'человека' : 'человек'} на жалованье` : `покровитель ${cl} ${pl1(cl, 'клиента', 'клиентов')}`);
  if (repT) soc.push(repT.toLowerCase());
  if (a.age > 55 && g) soc.push('старейшина: голос весит больше');
  return `<p class="rel">${parts.join('. ')}.</p>${soc.length ? `<p class="rel">${soc.map((t, i) => i ? t : t[0].toUpperCase() + t.slice(1)).join('; ')}.</p>` : ''}`;
}
// named ties with their cause: who is a friend, a rival, an enemy, and why
const BOND_ORDER = { enemy: 0, love: 1, sworn: 2, rival: 3, debt: 4, friend: 5, mentor: 6, pupil: 7 };
function bondsTxt(a) {
  const bs = Object.entries(a.bonds || {}).map(([id, b]) => [S._a.get(+id), b]).filter(([o]) => o).sort((x, y) => BOND_ORDER[x[1][0]] - BOND_ORDER[y[1][0]] || y[1][2] - x[1][2]);
  if (!bs.length) return '';
  return `<p class="rel"><b>Связи</b><br>${bs.map(([o, b]) => `${esc(o.name)} — ${esc(SIM.bondLabel(a, o, b[0]))}: ${esc(b[3])}, г. ${yr(b[1])}`).join('<br>')}</p>`;
}
function card() {
  const el = $('card');
  if (!sel) return;
  const a = S._a.get(sel);
  if (!a) { el.innerHTML = `<p class="empty">Этого агента больше нет в мире. Выберите другого.</p>`; sel = null; return; }
  const g = a.group && S._g.get(a.group), boss = a.boss && S._a.get(a.boss), L = g && S._a.get(g.leader);
  const role = !g ? 'одиночка' : a.role === 'leader' ? `лидер «${g.name}»` : a.role === 'lt' ? `управляющий в «${g.name}»` : `рядовой в «${g.name}»`;
  const rel = Object.entries(a.trust).map(([id, v]) => [S._a.get(+id), v]).filter(([o]) => o);
  const fr = rel.filter(r => r[1] > .3).sort((x, y) => y[1] - x[1]).slice(0, 3).map(r => r[0].name);
  const en = rel.filter(r => r[1] < -.2).sort((x, y) => x[1] - y[1]).slice(0, 3).map(r => r[0].name);
  const life = (a.master ? ` · ${TITLE[a.master]}` : '') + (g && g.home ? ` · ${JOB[a.job] || 'без дела'} · ${a.shel ? 'живёт в доме' : 'без крыши'}` : g ? ' · кочует' : '');
  el.innerHTML = `<h3>${esc(a.name)}</h3><p class="role">${role}${boss && boss !== L ? `, подчиняется ${esc(boss.name)}` : ''}${life} · ${Math.floor(a.age)} лет · ${a.born === 'child' ? 'родом из группы' : a.born === 'out' ? 'пришелец извне' : 'из первого поколения'}</p>
  <div class="traits">${row('Навык', a.skill)}${row('Амбиции', a.ambition)}${row('Кооперация', a.coop)}${row('Уравнительность', a.norm)}${row('Энергия', a.energy)}${row('Статус', a.status / (a.status + 10))}${L && L !== a ? row('Доверие лидеру', a.trust[L.id] || 0) : ''}${g && a.role !== 'leader' ? row('Обида', a.res, true) : ''}</div>
  ${a.war ? (() => { const w = (S.wars || []).find(x => x.id === a.war), B = w && S._g.get(w.def); return `<p class="rel">${w && w.phase === 'march' ? `Идёт в поход на «${esc(B ? B.name : '?')}»` : 'Возвращается из похода'}.</p>`; })() : ''}
  ${g && g.home && g.wsrc ? `<p class="rel">Вода: ${g.wsrc.kind === 'well' ? 'свой колодец' : g.wsrc.kind === 'spring' ? 'родник' : 'река'}, ${Math.round(g.wd)} шагов${g.wNeed ? `, воду носят ${g.wNeed} ${g.wNeed % 10 === 1 && g.wNeed % 100 !== 11 ? 'человек' : g.wNeed % 10 > 1 && g.wNeed % 10 < 5 && (g.wNeed % 100 < 12 || g.wNeed % 100 > 14) ? 'человека' : 'человек'}` : ''}${g.dirty > 0.35 ? '; вода нечистая, люди чаще болеют' : ''}${g.thirst ? '; <b style="color:var(--red)">воды нет</b>' : ''}.</p>` : g && g.home && !g.wsrc ? '<p class="rel"><b style="color:var(--red)">В деревне нет воды.</b></p>' : ''}
  ${g && g.home && ((g.pots || 0) >= 1 || (g.cloth || 0) >= 1 || (g.goats || 0) || g.fboats) ? `<p class="rel">Хозяйство: ${[g.goats ? `${g.goats} коз` : '', g.fboats ? `${g.fboats} ${g.fboats === 1 ? 'рыбацкая лодка' : g.fboats < 5 ? 'рыбацкие лодки' : 'рыбацких лодок'}` : '', (g.pots || 0) >= 1 ? `горшков ${Math.round(g.pots)}` : '', (g.cloth || 0) >= 1 ? `тканей ${Math.round(g.cloth)}` : ''].filter(Boolean).join(', ')}${(g.cloth || 0) >= g.members.length * 0.5 ? '. Тёплая одежда: зимой болеют реже' : ''}${(g.pots || 0) >= g.members.length * 0.5 ? '. Есть посуда: запасы хранятся дольше, воду носить легче' : ''}.</p>` : ''}
  ${famTxt(a, g, L)}
  ${bondsTxt(a)}
  ${a.feud && !a.feud.done ? `<p class="rel"><b>Ждёт мести</b> за ${esc(a.feud.rel)} ${esc(a.feud.v)}: ${a.feud.personal ? esc(a.feud.Lname) : `«${esc(a.feud.gname)}»`}.</p>` : ''}
  <div class="fbtn"><button id="cfollow" aria-pressed="${follow}">${follow ? 'Не следить' : 'Следить камерой'}</button></div>
  ${a.bio && a.bio.length > 1 ? `<details class="chron1"><summary>Летопись жизни · ${arcOf({ bio: a.bio })}</summary>${storyText({ bio: a.bio }, true)}</details>` : ''}
  ${a.load > 0.3 ? `<p class="rel">${a.haul ? 'Несёт на склад' : 'Набирает груз'}: ${goodsTxt(a.load, a.lk)}.</p>` : ''}
  ${a.car ? `<p class="rel">${a.car.phase === 'go' ? `Везёт ${goodsTxt(a.car.qx, a.car.x)} в «${esc((S._g.get(a.car.to) || {}).name || '?')}»` : `Возвращается домой: везёт ${goodsTxt(a.car.qy, a.car.y)}${a.car.failed ? ' (сделка сорвалась, товар назад)' : ''}`}. Караванов за жизнь: ${a.trades || 0}.</p>` : a.trades ? `<p class="rel">Купец: караванов за жизнь ${a.trades}.</p>` : ''}
  ${g && g.land === 'private' ? (() => { const nf = g.fields.filter(f => f.owner === a.id).length; return `<p class="rel">${nf ? `Владеет ${nf} ${nf === 1 ? 'полем' : 'полями'} из ${g.fields.length}.` : a.job === 'farm' ? 'Безземельный: батрачит на чужом поле за малую долю урожая.' : 'Своей земли нет.'}</p>`; })() : ''}
  ${a.debt ? (() => { const cr = S._a.get(a.cred); return `<p class="rel">${a.bond ? '<b style="color:var(--red)">В кабале.</b> ' : ''}Должен ${Math.round(a.debt)} ${cr ? esc(cr.name) : ''}${a.rate ? ` под ${pct(a.rate)}% годовых` : ' без процентов: вера запрещает рост'}${a.bond ? '; почти всё сверх пропитания уходит кредитору' : ''}.</p>`; })() : ''}
  ${a.loans ? (() => { const debtors = S.agents.filter(o => o.cred === a.id && o.debt); return `<p class="rel">Ростовщик: выдал займов ${a.loans}, сейчас должны ${debtors.length} чел. на ${Math.round(debtors.reduce((s2, o) => s2 + o.debt, 0))}${debtors.some(o => o.bond) ? `, в кабале ${debtors.filter(o => o.bond).length}` : ''}.</p>`; })() : ''}
  <p class="rel">Запас: ${a.wealth.toFixed(1)}.${a.made ? ` Сделал орудий: ${a.made}.` : ''} ${fr.length ? `Доверяет: ${esc(fr.join(', '))}. ` : ''}${en.length ? `Враждует: ${esc(en.join(', '))}.` : ''}${(a.intr || 0) > 2 ? ' Плетёт интриги против лидера.' : ''}</p>`;
}
const TOG = [['landPriv', 'Частная земля разрешена', 'Иначе поля всегда общие и не переходят по наследству'], ['assembly', 'Вече разрешено', 'Иначе решения всегда принимает вождь или монарх'], ['coin', 'Монета разрешена', 'Иначе торговля остаётся меновой, а богатство гниёт'], ['usury', 'Проценты по займам разрешены', 'Иначе в долг дают без роста, и кабалы нет']];
function syncCtls() {
  $('ctls').innerHTML = CTL.map(([k, l, p]) => `<div class="ctl"><label for="c-${k}">${l}<output id="o-${k}">${pct(S.params[k])}%</output></label><p>${p}</p><input type="range" id="c-${k}" min="0" max="1" step="0.05" value="${S.params[k]}"></div>`).join('')
    + TOG.map(([k, l, p]) => `<div class="ctl"><label class="chk" style="color:var(--ink)" for="c-${k}"><input type="checkbox" id="c-${k}" ${(S.params[k] ?? 1) >= 0.5 ? 'checked' : ''}>${l}</label><p>${p}</p></div>`).join('');
  for (const [k] of CTL) $('c-' + k).addEventListener('input', e => { S.params[k] = +e.target.value; $('o-' + k).textContent = pct(S.params[k]) + '%'; });
  for (const [k] of TOG) $('c-' + k).addEventListener('change', e => { S.params[k] = e.target.checked ? 1 : 0; });
}
function syncPlay() { $('play').textContent = playing ? 'Пауза' : 'Пуск'; if (focusEv && $('go')) $('go').textContent = playing ? 'Закрыть' : 'Дальше'; }


