/* ---------- Н4: the household — what the regime means for one family ---------- */
// Four questions under the house line of the card: whose field, who takes a part, who judges, who owes whom.
// The words come from SIM.householdView; the regime is never named here, only what it does to this family.
// a name in the case the sentence needs: «вождю Эланюту», «у Эланюта»
const nmc = (id, name, padezh) => { const p = id && SIM.personOf(S, id); return esc(p ? SIM.nameCase(p, padezh) : name); };
const nameList = xs => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' и ' + xs[xs.length - 1];
function yardFields(v) {
  const groups = new Map(), other = [];
  for (const r of v.work) {
    if (!r.field) { if (r.job && r.job !== 'farm') other.push(`${esc(r.name)} ${JOB[r.job] || 'без дела'}`); continue; }
    const k = r.field.kind + ':' + (r.field.owner || '');
    if (!groups.has(k)) groups.set(k, { f: r.field, who: [] });
    groups.get(k).who.push(esc(r.name));
  }
  const lines = [...groups.values()].map(({ f, who }) => {
    const verb = who.length > 1 ? 'работают' : 'работает';
    if (f.kind === 'common') return `${nameList(who)} ${verb} на общем поле деревни: весь урожай идёт в общий амбар`;
    if (f.kind === 'own') return `${nameList(who)} ${verb} на своём поле: половина урожая себе, половина в общий амбар`;
    if (f.kind === 'family') return `${nameList(who)} ${verb} на поле семьи (${esc(f.owner)}): половина урожая в дом, половина в общий амбар`;
    return `${nameList(who)} ${verb} на чужом поле — у ${nmc(f.ownerId, f.owner, 'genitive')}${f.line ? ` из ${esc(f.line)}` : ''}: хозяину треть урожая, себе седьмая часть, половина в общий амбар`;
  });
  if (v.land === 'private') lines.push(v.owned ? `Семье принадлежит ${v.owned} ${plA(v.owned, 'поле', 'поля', 'полей')} из ${v.fields}` : `Своей земли у семьи нет (в деревне ${v.fields} ${plA(v.fields, 'поле', 'поля', 'полей')})`);
  return lines.concat(other);
}
function yardTake(v) {
  const out = [], landlords = new Map();
  for (const t of v.take) {
    if (t.kind === 'leader') out.push(`вождю ${nmc(t.nid, t.name, 'dative')} — ${Math.round(t.share * 100)} % общего амбара (${SIM.word('take', t.share, null, true)} доля)`);
    else if (t.kind === 'leaderHouse') out.push(`это дом вождя: себе он берёт ${Math.round(t.share * 100)} % общего амбара`);
    else if (t.kind === 'landlord') { if (!landlords.has(t.nid)) landlords.set(t.nid, { name: t.name, who: [] }); landlords.get(t.nid).who.push(esc(t.worker)); }
    else if (t.kind === 'tribute') out.push(`деревня платит дань «${esc(t.name)}»: около ${t.rate} % общего запаса в год`);
    else if (t.kind === 'client') out.push(`${esc(t.name)} — под покровительством ${nmc(t.nid, t.patron, 'genitive')}: каждый месяц отдаёт двадцатую часть своего запаса`);
    else if (t.kind === 'retainer') out.push(`${esc(t.name)} служит вождю ${nmc(t.nid, t.patron, 'dative')} и получает от него плату`);
  }
  for (const [nid, { name, who }] of landlords) out.splice(1, 0, `хозяину земли ${nmc(nid, name, 'dative')} — треть урожая с его поля, где ${who.length > 1 ? 'работают' : 'работает'} ${nameList(who)}`);
  return out;
}
function yardCourt(v) {
  const c = v.court; if (!c) return '';
  const cu = c.customs.map(x => (SIM.CASE_LABEL[x.kind] || {})[x.outcome]).filter(Boolean);
  const by = c.by === 'assembly' ? 'вече: решает собрание' : `вождь ${esc(c.leader || '?')}`;
  const blood = c.customs.some(x => x.kind === 'blood') ? '' : c.elders ? `; в кровной вражде старики (${c.elders}) и вождь уговаривают взять выкуп` : '';
  return cu.length ? `По обычаю деревни: ${esc(cu.join('; '))}. Где обычая нет, судит ${by}${blood}.` : `Обычаев ещё не сложилось: судит ${by}${blood}.`;
}
function yardDebts(v) {
  const out = [];
  for (const d of v.owes) out.push(`${esc(d.name)} ${d.bond ? `в кабале у ${nmc(d.nid, d.to, 'genitive')}` : `должен ${nmc(d.nid, d.to, 'dative')}`}: ${d.amount}${d.rate ? ` под ${d.rate} % в год` : ''}`);
  for (const d of v.owed) out.push(`${esc(d.name)} ${d.bond ? 'в кабале у семьи' : 'должен семье'} (${esc(d.to)}): ${d.amount}`);
  for (const d of v.obliged) out.push(`${esc(d.name)} обязан ${nmc(d.nid, d.to, 'dative')}: ${esc(d.why)}${evLink(d.ev)}`);
  return out.length ? out : ['Никому не должны, и им никто не должен.'];
}
function yardHtml(a) {
  const v = SIM.householdView(S, a.id);
  if (!v || !v.village) return '';
  const li = xs => xs.map(x => `<li>${x}</li>`).join('');
  return `<div class="yard"><b>Двор</b>
    <p class="yard-q">Чьё поле</p><ul>${li(yardFields(v))}</ul>
    <p class="yard-q">Кому отдают часть урожая</p><ul>${li(yardTake(v))}</ul>
    <p class="yard-q">К кому идут судиться</p><ul><li>${yardCourt(v)}</li></ul>
    <p class="yard-q">Долги и обязательства</p><ul>${li(yardDebts(v))}</ul></div>`;
}

// К1: what an old person saw with their own eyes and the village still remembers
function witnessTxt(a, g) {
  const seen = ((g && g.mem) || []).filter(m => m.wit.includes(a.id) && m.t < S.tick - 360 * 5).sort((x, y) => y.w0 - x.w0).slice(0, 3);
  return seen.length ? `<p class="rel">Помнит сам: ${seen.map(m => `${esc(m.what)} (г.${Math.floor(m.t / 360)})${evLink(m.ev)}`).join('; ')}.</p>` : '';
}
