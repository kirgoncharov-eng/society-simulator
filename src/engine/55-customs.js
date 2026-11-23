/* ---------- disputes and customs: a village remembers its cases, and a repeated ruling becomes a custom ---------- */
// g.cases: last rulings [kind, outcome, tick, eventId]; g.customs[kind] = outcome the village now holds to.
// Kinds: 'inherit' (heirs quarrel over a house: 'eldest' or 'share') and 'blood' (a killing: 'revenge' or 'wergild').
const CASE_LABEL = { inherit: { eldest: 'дом старшему', share: 'поделиться с младшими' }, blood: { revenge: 'кровь за кровь', wergild: 'выкуп вместо мести' }, theft: { fine: 'вор возвращает вдвое', ban: 'вору закрыты ворота' } };
function elders(S, g) { return g.members.map(id => S._a.get(id)).filter(m => m && m.age > 55).length / Math.max(1, g.members.length); }
// record a ruling; when the same ruling keeps coming back, it becomes the village's custom
function ruling(S, g, kind, outcome, ev) {
  g.cases = g.cases || []; g.cases.push([kind, outcome, S.tick, ev]); if (g.cases.length > 16) g.cases.shift();
  const cu = (g.customs || {})[kind]; if (cu) { const k = 'under_' + kind + '_' + cu + '_' + outcome; S.stats[k] = (S.stats[k] || 0) + 1; }
  S.stats['case_' + kind + '_' + outcome] = (S.stats['case_' + kind + '_' + outcome] || 0) + 1;
  g.customs = g.customs || {};
  if (g.customs[kind]) return;
  if (kind === 'blood' && outcome === 'revenge') return; // after bloodshed the elders choose the custom themselves (see bloodShed)
  const last = g.cases.filter(c => c[0] === kind).slice(-4), same = last.filter(c => c[1] === outcome);
  if (same.length >= 2 && same.length >= last.length - 1) setCustom(S, g, kind, outcome, same.map(c => c[3]).filter(Boolean), `решали так ${same.length} ${pl(same.length, 'раз', 'раза', 'раз')} из ${last.length}`);
}
function setCustom(S, g, kind, outcome, causes, how) {
  causes = (causes || []).filter(id => eventById(S, id)); // only rulings whose events are still known
  g.customs = g.customs || {}; g.customs[kind] = outcome; S.stats.customs = (S.stats.customs || 0) + 1;
  const L = S._a.get(g.leader);
  g.customEv = g.customEv || {};
  const text = kind === 'blood' && outcome === 'wergild' ? `«${g.name}» вводит обычай виры: за кровь платят, а не мстят` : kind === 'inherit' ? `В «${g.name}» складывается обычай наследства: ${CASE_LABEL.inherit[outcome]}` : `В «${g.name}» складывается обычай: ${CASE_LABEL[kind][outcome]}`;
  const A = L || topBy(adultsOf(S, g), m => m.age, 1)[0]; if (!A) return null;
  const ev = enact(S, g, { kind: 'custom', author: A, against: customLosers(S, g, kind, outcome, causes, A), cause: causes[0] || null, propose: g.gov === 'assembly' ? 'на вече обычай объявляет' : 'обычай объявляет', text,
    why: [how, 'теперь так решают и дальше, пока сход или новый вождь не переменят'], authorLine: `Объявляет обычай «${g.name}»: ${CASE_LABEL[kind][outcome]}`, lostLine: p => `Обычай «${g.name}» — ${CASE_LABEL[kind][outcome]} — против ${fem(p, 'него', 'неё')}`, grudge: 'объявил обычай против меня', extra: { causes: causes.length ? causes : undefined } });
  g.customEv[kind] = cite(S, ev.id);
  return ev;
}
// who loses by a custom: in an inheritance custom the side the cases went against; under blood money those who took
// blood and want it still; under blood for blood an old peacemaker; for theft the thieves
function customLosers(S, g, kind, outcome, causes, A) {
  const out = [];
  for (const id of causes || []) {
    const e = eventById(S, id); if (!e || !e.who) continue;
    let p = null;
    if (kind === 'inherit') p = S._a.get(outcome === 'eldest' ? e.who[1] : e.who[0]);
    else if (kind === 'blood' && outcome === 'wergild' && e.type === 'revenge') p = S._a.get(e.who[0]);
    else if (kind === 'theft') p = S._a.get(e.who[e.who.length - 1]);
    if (p && p !== A && p.group === g.id && !out.includes(p)) out.push(p);
  }
  if (out.length) return out;
  // nobody from the cases is left: whoever the custom works against by their place in the family or their grudge
  const ad = adultsOf(S, g).filter(m => m !== A), sib = (m, older) => ad.some(o => o !== m && ((m.father && o.father === m.father) || (m.mother && o.mother === m.mother)) && (older ? o.age > m.age : o.age < m.age));
  const pick = kind === 'inherit' ? (outcome === 'eldest' ? topBy(ad.filter(m => sib(m, true)), m => m.ambition, 1) : topBy(ad.filter(m => sib(m, false) && !sib(m, true)), m => m.status, 1))
    : kind === 'blood' ? (outcome === 'wergild' ? topBy(ad.filter(m => m.feud && !m.feud.done).concat(ad.filter(m => m.age < 35)), m => m.ambition, 1) : topBy(ad.filter(m => m.age > 45), m => m.coop, 1))
    : topBy(ad, m => outcome === 'ban' ? m.coop : 1 - m.coop, 1);
  return pick.filter(Boolean);
}
// who judges: the leader, or the assembly; returns the ruling the judge leans to without a custom
function judge(S, g, kind) {
  const L = S._a.get(g.leader), assembly = g.gov === 'assembly';
  if (kind === 'inherit') return rnd(S) < (assembly ? 0.6 : 0.15 + 0.5 * ((L && L.norm) || 0.5)) ? 'share' : 'eldest';
  return null;
}
/* heirs quarrel over the house: called from households when the eldest child inherits */
function inheritDispute(S, g, house, heir, owner, deathEv) {
  const sibs = g.members.map(id => S._a.get(id)).filter(m => m && m !== heir && m.age >= 16 && ((heir.mother && m.mother === heir.mother) || (heir.father && m.father === heir.father)));
  if (!sibs.length) return;
  const c = sibs.map(m => [m, m.ambition + (bondW(m, heir) < 0 ? 0.3 : 0) + (m.spouse ? 0.15 : 0)]).sort((p, q) => q[1] - p[1])[0];
  if (c[1] < 0.6 || rnd(S) > 0.6) return;
  const sib = c[0], L = S._a.get(g.leader), custom = (g.customs || {}).inherit;
  const outcome = custom && rnd(S) < 0.85 ? custom : judge(S, g, 'inherit');
  const byCustom = custom === outcome;
  const who = g.gov === 'assembly' ? `вече «${g.name}»` : L && L !== heir && L !== sib ? `вождь ${L.name}` : 'старейшины';
  const ownerName = nameCase(owner, 'genitive');
  let text, why;
  if (outcome === 'eldest') {
    text = `Спор за дом ${ownerName} в «${g.name}»: ${who} ${byCustom ? 'по обычаю ' : ''}отдаёт дом ${fem(heir, 'старшему', 'старшей')}, ${nameCase(heir, 'dative')}`;
    why = sent([`${sib.name} считает, что ${fem(sib, 'имеет', 'имеет')} на дом не меньше прав`, byCustom ? 'так решают здесь давно' : 'судья держится старшинства', `${sib.name} уходит ни с чем и затаивает обиду`]);
    sib.res = clamp(sib.res + 0.3, 0, 1);
  } else {
    const part = Math.max(3, heir.wealth * 0.3); heir.wealth -= part; sib.wealth += part;
    text = `Спор за дом ${ownerName} в «${g.name}»: ${who} ${byCustom ? 'по обычаю ' : ''}велит ${nameCase(heir, 'dative')} поделиться с ${nameCase(sib, 'instrumental')}`;
    why = sent([`дом остаётся старшему, но ${sib.name} получает долю зерна: ${qty(part, 'food')}`, byCustom ? 'так решают здесь давно' : 'судья не хочет ссоры в деревне', 'обида меньше, но и старший недоволен']);
  }
  const ev = log(S, 'case', text, house.x, house.y, g.hue, { why, who: [heir.id, sib.id].concat(L ? [L.id] : []), gs: [g.id], causes: deathEv ? [deathEv] : undefined });
  if (outcome === 'eldest') { bond(S, sib, heir, 'rival', `${fem(heir, 'забрал', 'забрала')} дом ${ownerName} себе`, 0.6, false, ev.id); houseGoal(S, sib, heir, g, house, owner, ev.id); }
  else bond(S, heir, sib, 'rival', `${fem(sib, 'отсудил', 'отсудила')} долю отцовского добра`, 0.3, false, ev.id);
  bio(S, sib, 'dispute', outcome === 'eldest' ? `Спорит с ${nameCase(heir, 'instrumental')} за дом ${ownerName} и проигрывает` : `Спорит с ${nameCase(heir, 'instrumental')} за дом ${ownerName} и получает долю`, ev.id);
  bio(S, heir, 'dispute', outcome === 'eldest' ? `Отстаивает дом ${ownerName} в споре с ${nameCase(sib, 'instrumental')}` : `Отдаёт ${nameCase(sib, 'dative')} долю за дом ${ownerName}`, ev.id);
  ruling(S, g, 'inherit', outcome, ev.id);
}
/* the moment of revenge inside a village: elders and the leader may talk the killer's kin into paying blood money.
   Returns true if the feud is settled and the killing does not happen. */
function bloodOrWergild(S, g, avenger, killer) {
  const L = S._a.get(g.leader), custom = (g.customs || {}).blood === 'wergild';
  const kinK = kinOf(S, killer).filter(o => o.group === g.id);
  // blood money is a bargain: the killer's kin pay what they can, the community adds from the common store
  // (by custom it must); by custom even a token price closes the feud, without one it must be a real price
  const kinPurse = Math.max(0, killer.wealth) + kinK.reduce((s, o) => s + Math.max(0, o.wealth - 2), 0);
  const help = custom || (L && L.coop > 0.5) ? Math.max(0, Math.min(12 - kinPurse, g.treasury * (custom ? 0.5 : 0.25))) : 0;
  const price = Math.min(12, kinPurse + help);
  const vendetta = (g.customs || {}).blood === 'revenge'; // where blood for blood is the custom, taking money is shameful
  const p = price < (custom ? 4 : 7) ? 0 : custom ? 0.8 : vendetta ? 0.05 : clamp(0.2 + 0.4 * elders(S, g) + 0.25 * ((L && L.coop) || 0.4) - 0.15 * avenger.ambition, 0, 0.6);
  if (rnd(S) > p) return false;
  // pay: the killer first, then the kin
  let due = price; const take = (o, cap) => { const x = Math.min(due, Math.max(0, cap)); o.wealth -= x; due -= x; };
  take(killer, killer.wealth); for (const o of kinK) if (due > 0) take(o, o.wealth - 2);
  const common = Math.min(due, help); g.treasury -= common; due -= common;
  avenger.wealth += price - due;
  const f = avenger.feud, src = f.ev;
  f.done = S.tick; f.settled = true; f.out = 'settled';
  const text = `${killer.name} платит виру за ${feudVictim(f)}: ${avenger.name} принимает выкуп и не мстит`;
  const why = sent([`${avenger.name} ${yrs(Math.max(1, Math.round((S.tick - f.t) / 360)))} ${fem(avenger, 'ждал', 'ждала')} мести за ${feudKin(f)}`, custom ? `в «${g.name}» обычай: за кровь платят` : `старейшины и ${L ? (L.sex === 'f' ? 'вождь ' : 'вождь ') + L.name : 'община'} уговаривают взять выкуп`, `родня ${nameCase(killer, 'genitive')} собирает ${qty(price - due - common, 'food')}`, common >= 1 ? `община добавляет из амбара ${qty(common, 'food')}` : '', 'цепочка мести обрывается, но обида остаётся']);
  const ev = log(S, 'case', text, avenger.x, avenger.y, g.hue, { why, who: [avenger.id, killer.id].concat(L ? [L.id] : []), gs: [g.id], causes: src ? [src] : undefined });
  f.endEv = cite(S, ev.id);
  bio(S, avenger, 'wergild', `Принимает виру за ${feudKin(f)} от ${nameCase(killer, 'genitive')}`, ev.id);
  bio(S, killer, 'wergild', `Платит виру родне ${feudVictim(f, 'genitive')}, чтобы оборвать месть`, ev.id);
  bond(S, avenger, killer, 'rival', `${fem(killer, 'заплатил', 'заплатила')} виру за ${feudKin(f)}`, 0.4, false, ev.id);
  ruling(S, g, 'blood', 'wergild', ev.id);
  return true;
}
// after a revenge killing: a ruling 'revenge'. Two bloody turns force the elders to choose: blood money (it breaks the chain)
// or blood for blood as the custom; the more the old and the leader value peace, the likelier blood money
function bloodShed(S, g, ev) {
  ruling(S, g, 'blood', 'revenge', ev);
  if ((g.customs || {}).blood) return;
  const recent = (g.cases || []).filter(c => c[0] === 'blood' && c[1] === 'revenge' && S.tick - c[2] < 360 * 30);
  if (recent.length < 2) return;
  const L = S._a.get(g.leader), causes = recent.map(c => c[3]).filter(Boolean), span = yrs(Math.max(1, Math.round((S.tick - recent[0][2]) / 360)));
  if (rnd(S) < 0.2 + 0.35 * ((L && L.coop) || 0.4) + 0.5 * elders(S, g))
    setCustom(S, g, 'blood', 'wergild', causes, `за ${span} кровь пролилась ${recent.length} ${pl(recent.length, 'раз', 'раза', 'раз')}, и каждая месть рождает новую; старейшины решают платить, а не мстить`);
  else setCustom(S, g, 'blood', 'revenge', causes, `за ${span} кровь пролилась ${recent.length} ${pl(recent.length, 'раз', 'раза', 'раз')}; в деревне решают, что выкуп — позор, а за кровь платят кровью`);
}
// customs spread the way other institutions do: a village takes up a neighbour's custom (trade, alliance, marriages)
function customsYear(S) {
  for (const g of S.groups) {
    if (!g.home || g.dead || g.members.length < 5) continue;
    for (const kind of ['blood', 'inherit']) {
      if ((g.customs || {})[kind]) continue;
      const im = imitP(S, g, o => !!(o.customs || {})[kind]);
      if (!im.from || rnd(S) > im.p * 6) continue;
      const o = im.from, outcome = o.customs[kind];
      const text = kind === 'blood' ? `«${g.name}» перенимает у «${o.name}» ${outcome === 'wergild' ? 'обычай виры: за кровь платят' : 'обычай мести: кровь за кровь'}` : `«${g.name}» перенимает у «${o.name}» обычай наследства: ${CASE_LABEL.inherit[outcome]}`;
      g.customs = g.customs || {}; g.customs[kind] = outcome; S.stats.customs = (S.stats.customs || 0) + 1; S.stats.customsCopied = (S.stats.customsCopied || 0) + 1;
      const L = S._a.get(g.leader);
      const A = L || topBy(adultsOf(S, g), m => m.age, 1)[0]; if (!A) continue;
      const src = (o.customEv || {})[kind] ? [o.customEv[kind]] : undefined;
      const old = topBy(adultsOf(S, g).filter(m => m !== A), m => m.age, 1);
      const ev = enact(S, g, { kind: 'custom', author: A, against: old, cause: src && src[0] ? src[0] : null, text, propose: 'чужой обычай вводит', extra: { gs: [g.id, o.id] },
        why: [`у «${o.name}» так заведено, и соседи видят, что это работает`, `связи между деревнями: торговля, союз или браки`], authorLine: `Вводит в «${g.name}» обычай, перенятый у «${o.name}»`, lostLine: p => `Старики «${g.name}» не хотят чужого обычая, но их не слушают`, grudge: 'ввёл чужой обычай' });
      g.customEv = g.customEv || {}; g.customEv[kind] = cite(S, ev.id);
    }
  }
}
