/* ---------- disputes and customs: a village remembers its cases, and a repeated ruling becomes a custom ---------- */
// g.cases: last rulings [kind, outcome, tick, eventId]; g.customs[kind] = outcome the village now holds to.
// Kinds: 'inherit' (heirs quarrel over a house: 'eldest' or 'share') and 'blood' (a killing: 'revenge' or 'wergild').
const CASE_LABEL = { inherit: { eldest: 'дом старшему', share: 'поделиться с младшими' }, blood: { revenge: 'кровь за кровь', wergild: 'выкуп вместо мести' } };
function elders(S, g) { return g.members.map(id => S._a.get(id)).filter(m => m && m.age > 55).length / Math.max(1, g.members.length); }
// record a ruling; when the same ruling keeps coming back, it becomes the village's custom
function ruling(S, g, kind, outcome, ev) {
  g.cases = g.cases || []; g.cases.push([kind, outcome, S.tick, ev]); if (g.cases.length > 16) g.cases.shift();
  if ((g.customs || {})[kind]) S.stats['custom_' + kind + '_' + outcome] = (S.stats['custom_' + kind + '_' + outcome] || 0) + 1;
  S.stats['case_' + kind + '_' + outcome] = (S.stats['case_' + kind + '_' + outcome] || 0) + 1;
  g.customs = g.customs || {};
  if (g.customs[kind]) return;
  const last = g.cases.filter(c => c[0] === kind).slice(-4), same = last.filter(c => c[1] === outcome);
  if (same.length >= 2 && same.length >= last.length - 1) setCustom(S, g, kind, outcome, same.map(c => c[3]).filter(Boolean), `решали так ${same.length} ${pl(same.length, 'раз', 'раза', 'раз')} из ${last.length}`);
}
function setCustom(S, g, kind, outcome, causes, how) {
  g.customs = g.customs || {}; g.customs[kind] = outcome; S.stats.customs = (S.stats.customs || 0) + 1;
  const L = S._a.get(g.leader);
  const text = kind === 'blood' && outcome === 'wergild' ? `«${g.name}» вводит обычай виры: за кровь платят, а не мстят` : kind === 'inherit' ? `В «${g.name}» складывается обычай наследства: ${CASE_LABEL.inherit[outcome]}` : `В «${g.name}» складывается обычай: ${CASE_LABEL[kind][outcome]}`;
  return log(S, 'law', text, g.home.x, g.home.y, g.hue, { why: sent([how, 'теперь так решают и дальше, пока сход или новый вождь не переменят', L ? `обычай объявляет ${L.name}` : '']), who: L ? [L.id] : [], gs: [g.id], causes });
}
// who judges: the leader, or the assembly; returns the ruling the judge leans to without a custom
function judge(S, g, kind) {
  const L = S._a.get(g.leader), assembly = g.gov === 'assembly';
  if (kind === 'inherit') return rnd(S) < (assembly ? 0.6 : 0.15 + 0.5 * ((L && L.norm) || 0.5)) ? 'share' : 'eldest';
  return null;
}
/* heirs quarrel over the house: called from households when the eldest child inherits */
function inheritDispute(S, g, house, heir, ownerName, deathEv) {
  const sibs = g.members.map(id => S._a.get(id)).filter(m => m && m !== heir && m.age >= 16 && ((heir.mother && m.mother === heir.mother) || (heir.father && m.father === heir.father)));
  if (!sibs.length) return;
  const c = sibs.map(m => [m, m.ambition + (bondW(m, heir) < 0 ? 0.3 : 0) + (m.spouse ? 0.15 : 0)]).sort((p, q) => q[1] - p[1])[0];
  if (c[1] < 0.6 || rnd(S) > 0.6) return;
  const sib = c[0], L = S._a.get(g.leader), custom = (g.customs || {}).inherit;
  const outcome = custom && rnd(S) < 0.85 ? custom : judge(S, g, 'inherit');
  const byCustom = custom === outcome;
  const who = g.gov === 'assembly' ? `вече «${g.name}»` : L && L !== heir && L !== sib ? `вождь ${L.name}` : 'старейшины';
  let text, why;
  if (outcome === 'eldest') {
    text = `Спор за дом ${ownerName} в «${g.name}»: ${who} ${byCustom ? 'по обычаю ' : ''}отдаёт дом старшему, ${heir.name}`;
    why = sent([`${sib.name} считает, что ${fem(sib, 'имеет', 'имеет')} на дом не меньше прав`, byCustom ? 'так решают здесь давно' : 'судья держится старшинства', `${sib.name} уходит ни с чем и затаивает обиду`]);
    sib.res = clamp(sib.res + 0.3, 0, 1);
  } else {
    const part = Math.max(3, heir.wealth * 0.3); heir.wealth -= part; sib.wealth += part;
    text = `Спор за дом ${ownerName} в «${g.name}»: ${who} ${byCustom ? 'по обычаю ' : ''}велит ${heir.name} поделиться с ${sib.name}`;
    why = sent([`дом остаётся старшему, но ${sib.name} получает долю зерна: ${qty(part, 'food')}`, byCustom ? 'так решают здесь давно' : 'судья не хочет ссоры в деревне', 'обида меньше, но и старший недоволен']);
  }
  const ev = log(S, 'case', text, house.x, house.y, g.hue, { why, who: [heir.id, sib.id].concat(L ? [L.id] : []), gs: [g.id], causes: deathEv ? [deathEv] : undefined });
  if (outcome === 'eldest') bond(S, sib, heir, 'rival', `${fem(heir, 'забрал', 'забрала')} дом ${ownerName} себе`, 0.6, false, ev.id);
  else bond(S, heir, sib, 'rival', `${fem(sib, 'отсудил', 'отсудила')} долю отцовского добра`, 0.3, false, ev.id);
  bio(S, sib, 'dispute', outcome === 'eldest' ? `Спорит с ${heir.name} за дом ${ownerName} и проигрывает` : `Спорит с ${heir.name} за дом ${ownerName} и получает долю`, ev.id);
  bio(S, heir, 'dispute', outcome === 'eldest' ? `Отстаивает дом ${ownerName} в споре с ${sib.name}` : `Отдаёт ${sib.name} долю за дом ${ownerName}`, ev.id);
  ruling(S, g, 'inherit', outcome, ev.id);
}
/* the moment of revenge inside a village: elders and the leader may talk the killer's kin into paying blood money.
   Returns true if the feud is settled and the killing does not happen. */
function bloodOrWergild(S, g, avenger, killer) {
  const L = S._a.get(g.leader), custom = (g.customs || {}).blood === 'wergild';
  const kinK = kinOf(S, killer).filter(o => o.group === g.id), price = 12;
  // the killer's kin pay what they can; the community adds the rest from the common store (by custom it must)
  const kinPurse = Math.max(0, killer.wealth) + kinK.reduce((s, o) => s + Math.max(0, o.wealth - 2), 0);
  const help = custom || (L && L.coop > 0.5) ? Math.min(Math.max(0, price - kinPurse), g.treasury * 0.25) : 0;
  const p = kinPurse + help < price * 0.6 ? 0 : custom ? 0.8 : clamp(0.1 + 0.35 * elders(S, g) + 0.2 * ((L && L.coop) || 0.4) - 0.15 * avenger.ambition, 0, 0.6);
  if (rnd(S) > p) return false;
  // pay: the killer first, then the kin
  let due = price; const take = (o, cap) => { const x = Math.min(due, Math.max(0, cap)); o.wealth -= x; due -= x; };
  take(killer, killer.wealth); for (const o of kinK) if (due > 0) take(o, o.wealth - 2);
  const common = Math.min(due, help); g.treasury -= common; due -= common;
  avenger.wealth += price - due;
  const f = avenger.feud, src = f.ev;
  f.done = S.tick; f.settled = true;
  const text = `${killer.name} платит виру за ${f.v}: ${avenger.name} принимает выкуп и не мстит`;
  const why = sent([`${avenger.name} ${yrs(Math.max(1, Math.round((S.tick - f.t) / 360)))} ${fem(avenger, 'ждал', 'ждала')} мести за ${f.rel} ${f.v}`, custom ? `в «${g.name}» обычай: за кровь платят` : `старейшины и ${L ? (L.sex === 'f' ? 'вождь ' : 'вождь ') + L.name : 'община'} уговаривают взять выкуп`, `родня ${killer.name} собирает ${qty(price - due - common, 'food')}`, common >= 1 ? `община добавляет из амбара ${qty(common, 'food')}` : '', 'цепочка мести обрывается, но обида остаётся']);
  const ev = log(S, 'case', text, avenger.x, avenger.y, g.hue, { why, who: [avenger.id, killer.id].concat(L ? [L.id] : []), gs: [g.id], causes: src ? [src] : undefined });
  bio(S, avenger, 'wergild', `Принимает виру за ${f.rel} ${f.v} от ${killer.name}`, ev.id);
  bio(S, killer, 'wergild', `Платит виру родне ${f.v}, чтобы оборвать месть`, ev.id);
  bond(S, avenger, killer, 'rival', `${fem(killer, 'заплатил', 'заплатила')} виру за ${f.rel} ${f.v}`, 0.4, false, ev.id);
  ruling(S, g, 'blood', 'wergild', ev.id);
  return true;
}
// after a revenge killing: a ruling 'revenge'; two bloody turns lead the elders to think of a custom of blood money
function bloodShed(S, g, ev) {
  ruling(S, g, 'blood', 'revenge', ev);
  if ((g.customs || {}).blood) return;
  const recent = (g.cases || []).filter(c => c[0] === 'blood' && c[1] === 'revenge' && S.tick - c[2] < 360 * 30);
  const L = S._a.get(g.leader);
  if (recent.length >= 2 && rnd(S) < 0.25 + 0.3 * ((L && L.coop) || 0.4) + 0.4 * elders(S, g))
    setCustom(S, g, 'blood', 'wergild', recent.map(c => c[3]).filter(Boolean), `за ${yrs(Math.max(1, Math.round((S.tick - recent[0][2]) / 360)))} кровь пролилась ${recent.length} ${pl(recent.length, 'раз', 'раза', 'раз')}, и каждая месть рождает новую`);
}
