/* ---------- secrets and rumours: an event not everybody knows, and people act on what they know ---------- */
// A secret is a quiet event with ev.secret (kind), ev.guilty, ev.know (ids of those who know). S.secrets keeps the open ones.
// Every month a knower may tell someone close; the one it concerns (a spouse, a village leader) acts when the news reaches them.
const SECRET_LIFE = { affair: 360 * 12, theft: 360 * 4 };
function openSecret(S, kind, text, x, y, hue, guilty, know, extra) {
  const ev = note(S, 'secret', text, x, y, hue, Object.assign({ secret: kind, guilty: guilty.map(a => a.id), know: know.map(a => a.id), who: guilty.map(a => a.id) }, extra || {}));
  (S.secrets || (S.secrets = [])).push(ev.id);
  S.stats['secret_' + kind] = (S.stats['secret_' + kind] || 0) + 1;
  return ev;
}
const knows = (ev, a) => ev.know.includes(a.id);
// someone learns the secret from a teller; returns true if this was news to them
function learn(S, ev, a, teller) {
  if (!a || knows(ev, a)) return false;
  ev.know.push(a.id);
  S.stats.rumours = (S.stats.rumours || 0) + 1;
  for (const id of ev.guilty) { const g = S._a.get(id); if (g && g !== a) bump(a, g, ev.secret === 'theft' ? -0.2 : -0.1); }
  if (ev.secret === 'theft') { const th = S._a.get(ev.guilty[0]); if (th) th.rep = clamp((th.rep || 0) - 0.03, -1, 1); }
  return true;
}
// who would a knower tell: people close to them (spouse, kin, friends, sworn); the guilty never tell, the guilty's enemies tell eagerly
function listeners(S, k) {
  const out = [];
  const sp = k.spouse && S._a.get(k.spouse); if (sp) out.push(sp);
  for (const id in k.bonds || {}) { const x = k.bonds[id]; if (x[0] === 'friend' || x[0] === 'sworn' || x[0] === 'love') { const o = S._a.get(+id); if (o) out.push(o); } }
  for (const pid of [k.mother, k.father]) { const p = pid && S._a.get(pid); if (p) out.push(p); }
  return out;
}
function gossipMonth(S) {
  if (!S.secrets || !S.secrets.length) return;
  const keep = [];
  for (const id of S.secrets) {
    const ev = S.evArch && S.evArch[id];
    if (!ev || S.tick - ev.t > (SECRET_LIFE[ev.secret] || 360 * 5) || ev.closed) continue;
    keep.push(id);
    const guilty = ev.guilty.map(g => S._a.get(g)).filter(Boolean);
    if (!guilty.length) { ev.closed = true; continue; }
    for (const kid of ev.know.slice()) {
      const k = S._a.get(kid); if (!k || ev.guilty.includes(kid)) continue;
      const hate = guilty.some(g => bondW(k, g) < 0), love = guilty.some(g => bondW(k, g) > 0.3 || kin(k, g));
      const talk = (0.03 + 0.06 * (1 - k.coop)) * (hate ? 2.5 : 1) * (love ? 0.3 : 1);
      for (const l of listeners(S, k)) {
        if (knows(ev, l) || ev.guilty.includes(l.id) || rnd(S) > talk) continue;
        if (!learn(S, ev, l, k)) continue;
        if (concerns(S, ev, l)) react(S, ev, l, k);
        if (ev.closed) break;
      }
      if (ev.closed) break;
    }
  }
  S.secrets = keep.filter(id => S.evArch[id] && !S.evArch[id].closed);
}
// does this secret concern the listener directly: a betrayed spouse, or the leader of the robbed village
function concerns(S, ev, l) {
  if (ev.secret === 'affair') return ev.betrayed && ev.betrayed.includes(l.id);
  if (ev.secret === 'theft') { const g = S._g.get(ev.victimG); return !!(g && g.leader === l.id); }
  return false;
}
// the spouse learns, the robbed village's leader learns: they act on it
function react(S, ev, l, teller) {
  const g = l.group && S._g.get(l.group);
  if (ev.secret === 'affair') {
    const partner = S._a.get(ev.guilty.find(id => S._a.get(id) && S._a.get(id).spouse === l.id) || ev.guilty[0]);
    const lover = S._a.get(ev.guilty.find(id => id !== (partner && partner.id)));
    if (!partner || !lover) { ev.closed = true; return; }
    const pf = clamp(0.25 + 0.35 * l.coop + Math.max(0, bondW(l, partner)) - 0.2 * l.ambition, 0.05, 0.8), pl2 = 0.35, r = rnd(S);
    let what, kill = false;
    if (r < pf) { what = `${fem(l, 'прощает', 'прощает')} ${nameCase(partner, 'accusative')}`; bump(l, partner, -0.15); S.stats.affairForgiven = (S.stats.affairForgiven || 0) + 1; }
    else if (r < pf + pl2 * (1 - pf)) {
      what = `уходит от ${fem(partner, 'мужа', 'жены')}`; l.spouse = null; if (partner.spouse === l.id) partner.spouse = null; l.house = null; l.lodger = false;
      S.stats.affairLeft = (S.stats.affairLeft || 0) + 1;
    } else {
      kill = l.ambition > 0.55 && rnd(S) < 0.15;
      what = kill ? `в драке убивает ${nameCase(lover, 'accusative')}` : `избивает ${nameCase(lover, 'accusative')}`;
      if (!kill) lover.energy = Math.max(0.1, lover.energy - 0.35);
      S.stats[kill ? 'affairKilled' : 'affairFight'] = (S.stats[kill ? 'affairKilled' : 'affairFight'] || 0) + 1;
    }
    const e = log(S, 'rumor', `${l.name} узнаёт от ${nameCase(teller, 'genitive')} об измене ${fem(partner, 'мужа', 'жены')} с ${nameCase(lover, 'instrumental')} и ${what}`, l.x, l.y, g ? g.hue : 0, {
      why: sent([`${partner.name} и ${lover.name} ${yrs(Math.max(1, Math.round((S.tick - ev.t) / 360)))} ${fem(partner, 'встречались', 'встречались')} тайком`, `${teller.name} ${bondW(teller, partner) < 0 || bondW(teller, lover) < 0 ? 'не любит виноватых и рассказывает охотно' : 'не может смолчать'}`, kill ? 'ревность кончается кровью: у убитого найдутся мстители' : '']),
      who: [l.id, teller.id, partner.id, lover.id], gs: g ? [g.id] : [], causes: [ev.id] });
    bio(S, l, 'jealousy', `Узнаёт от ${nameCase(teller, 'genitive')} об измене ${nameCase(partner, 'genitive')} с ${nameCase(lover, 'instrumental')} и ${what}`, e.id);
    bio(S, partner, 'jealousy', `Тайная связь с ${nameCase(lover, 'instrumental')} раскрыта: ${l.name} ${what}`, e.id);
    bond(S, l, lover, 'enemy', `${fem(lover, 'увёл', 'увела')} ${fem(partner, 'мужа', 'жену')}`, 0.7, false, e.id);
    if (kill) {
      for (const o of kinOf(S, lover)) if (!o.feud || o.feud.done) { o.feud = { g: l.group || 0, gname: g ? g.name : '', L: l.id, Lname: l.name, t: S.tick, v: lover.name, rel: o.mother === lover.id || o.father === lover.id ? (lover.sex === 'f' ? 'мать' : 'отца') : 'родича', personal: l.id, ev: cite(S, e.id) }; bio(S, o, 'feud', `${l.name} убивает ${nameCase(lover, 'accusative')} из ревности. ${o.name} клянётся отомстить`, e.id); }
      bio(S, l, 'murder', `Из ревности убивает ${nameCase(lover, 'accusative')}`, e.id);
      S.stats.murders = (S.stats.murders || 0) + 1;
      removeAgent(S, lover, 'killed');
    }
    ev.closed = true;
  } else if (ev.secret === 'theft') {
    const th = S._a.get(ev.guilty[0]), vg = S._g.get(ev.victimG); if (!th || !vg || !vg.home) { ev.closed = true; return; }
    const custom = (vg.customs || {}).theft, ban = custom ? custom === 'ban' : rnd(S) < 0.25 + 0.5 * (1 - l.coop);
    const fine = Math.min(Math.max(0, th.wealth), ev.amount * 2);
    if (!ban) { th.wealth -= fine; vg.treasury += fine; }
    else (th.exiled = th.exiled || {})[vg.id] = S.tick;
    if (th.group) { const k = key(th.group, vg.id); S.hostility[k] = Math.min(2, (S.hostility[k] || 0) + 0.08); }
    th.rep = clamp((th.rep || 0) - 0.15, -1, 1);
    const e = log(S, 'case', `Кража раскрыта: ${teller === l ? `${l.name} ${fem(l, 'сам', 'сама')} видит` : `${l.name} узнаёт от ${nameCase(teller, 'genitive')}`}, что амбар «${vg.name}» ${fem(th, 'обокрал', 'обокрала')} ${th.name}, и ${ban ? `запрещает ${fem(th, 'ему', 'ей')} показываться в деревне` : `требует вернуть вдвое (${qty(fine, 'food')})`}`, vg.home.x, vg.home.y, vg.hue, {
      why: sent([`${th.name} ${fem(th, 'крал', 'крала')} от голода ${yrs(Math.max(1, Math.round((S.tick - ev.t) / 360)))} назад`, custom ? 'так здесь заведено' : `${l.name} ${ban ? 'строг' + fem(l, '', 'а') : 'предпочитает вернуть своё'}`]),
      who: [l.id, teller.id, th.id], gs: [vg.id], causes: [ev.id] });
    bio(S, th, 'theft', ban ? `Кража раскрыта: «${vg.name}» закрывает перед ${fem(th, 'ним', 'ней')} ворота` : `Кража раскрыта: приходится вернуть вдвое`, e.id);
    ruling(S, vg, 'theft', ban ? 'ban' : 'fine', e.id);
    ev.closed = true;
  }
}
// a married person drifts into a secret affair: a love that was never answered, or a marriage gone cold and a close friend
function affairsMonth(S) {
  for (const a of S.agents) {
    if (!a.spouse || a.age < 18 || a.age > 55 || !a.group || (a.id + Math.floor(S.tick / 30)) % 4) continue;
    const sp = S._a.get(a.spouse); if (!sp) continue;
    if ((a.trust[sp.id] || 0) > 0.15 && !Object.values(a.bonds || {}).some(x => x[0] === 'love' && x[2] > 0.3)) continue;
    let o = null, best = 0;
    for (const id in a.bonds || {}) {
      const x = a.bonds[id], c = S._a.get(+id);
      if (!c || c === sp || c.sex === a.sex || c.group !== a.group || c.age < 18 || kin(c, a) || (x[0] !== 'love' && x[0] !== 'friend')) continue;
      const v = x[2] * (x[0] === 'love' ? 2 : 1) + (c.trust[a.id] || 0); if (v > best) { best = v; o = c; }
    }
    if (!o || best < 0.6 || rnd(S) > 0.04) continue;
    const g = S._g.get(a.group), betrayed = [sp.id].concat(o.spouse ? [o.spouse] : []);
    if ((S.secrets || []).some(id => { const e = S.evArch && S.evArch[id]; return e && e.secret === 'affair' && e.guilty.includes(a.id); })) continue;
    const ev = openSecret(S, 'affair', `${a.name} и ${o.name} тайно сходятся в «${g.name}»`, a.x, a.y, g.hue, [a, o], [a, o], { betrayed });
    bond(S, a, o, 'love', 'тайная связь', 0.7, false, ev.id); bond(S, o, a, 'love', 'тайная связь', 0.7, false, ev.id);
    bio(S, a, 'affair', `Тайно сходится с ${nameCase(o, 'instrumental')}`, ev.id); bio(S, o, 'affair', `Тайно сходится с ${nameCase(a, 'instrumental')}`, ev.id);
    // someone may have seen them: a neighbour now carries the secret
    if (rnd(S) < 0.4) { const w = g.members.map(id => S._a.get(id)).filter(m => m && m !== a && m !== o && !betrayed.includes(m.id)); if (w.length) learn(S, ev, w[Math.floor(rnd(S) * w.length)], a); }
  }
}
