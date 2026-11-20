/* ---------- bonds: named personal ties with a cause and a memory ---------- */
// a.bonds[id] = [kind, tick, strength, why]. Trust stays the everyday feeling; a bond is what people remember and act on.
// kinds: friend, sworn (blood brothers), love, rival, enemy, debt (owes gratitude), mentor, pupil
const BOND_W = { friend: 0.4, sworn: 0.6, love: 0.3, rival: -0.3, enemy: -0.7, debt: 0.35, mentor: 0.25, pupil: 0.15 };
const BOND_DECAY = { friend: 0.997, sworn: 0.999, love: 0.99, rival: 0.995, enemy: 0.9985, debt: 0.997, mentor: 0.998, pupil: 0.998 };
const BOND_MAX = 8;
function bondOf(a, b) { return a && b && a.bonds ? a.bonds[b.id] || null : null; }
// how much a's bond to b pulls a towards b in a decision (negative: against)
function bondW(a, b) { const x = bondOf(a, b); return x ? BOND_W[x[0]] * Math.min(1, x[2] * 1.5) : 0; }
const fem = (a, m, f) => a.sex === 'f' ? f : m;
function bond(S, a, b, k, why, s) {
  if (!a || !b || a === b || !S._a.has(a.id) || !S._a.has(b.id)) return null;
  s = s === undefined ? 0.6 : s;
  const B = a.bonds || (a.bonds = {}), cur = B[b.id];
  if (cur && cur[0] === k) { cur[2] = Math.min(1, cur[2] + s * 0.5); cur[1] = S.tick; if (why) cur[3] = why; return cur; }
  let said = false;
  if (cur && BOND_W[cur[0]] > 0.3 && BOND_W[k] < 0 && cur[2] > 0.25) {
    said = true;
    // a friend, a blood brother or a benefactor turning into a foe: a betrayal
    bio(S, a, 'betrayed', `${b.name}, ${cur[0] === 'sworn' ? fem(b, 'побратим', 'посестра') : cur[0] === 'debt' ? 'кому был' + fem(a, '', 'а') + ' обязан' + fem(a, '', 'а') : fem(b, 'друг', 'подруга')}, становится врагом: ${why}`);
    S.stats.betrayals = (S.stats.betrayals || 0) + 1;
  }
  if (cur && BOND_W[cur[0]] < 0 && BOND_W[k] > 0.3 && cur[2] > 0.3) bio(S, a, 'reconcile', `Мирится с ${b.name}: ${why}`);
  B[b.id] = [k, S.tick, Math.min(1, s), why];
  // enmities already have their own line in the chronicle (exile, coup, a kinsman killed); sworn brotherhood and love do not
  if (!said && (k === 'sworn' || k === 'love')) bio(S, a, k, k === 'sworn' ? `Братается с ${b.name}: ${why}` : `Любит ${b.name}: ${why}`);
  bump(a, b, BOND_W[k] * 0.4);
  const ids = Object.keys(B);
  if (ids.length > BOND_MAX) { ids.sort((p, q) => B[p][2] - B[q][2]); delete B[ids[0]]; }
  S.stats.ties = (S.stats.ties || 0) + 1;
  return B[b.id];
}
function bondLabel(a, o, k) {
  return ({ friend: fem(o, 'друг', 'подруга'), sworn: fem(o, 'побратим', 'посестра'), love: 'любовь', rival: fem(o, 'соперник', 'соперница'), enemy: fem(o, 'враг', 'врагиня'), debt: fem(a, 'обязан', 'обязана'), mentor: fem(o, 'учитель', 'учительница'), pupil: fem(o, 'ученик', 'ученица') })[k] || k;
}
function bondsMonth(S) {
  for (const a of S.agents) {
    // ties fade unless renewed; ties to the dead are kept only as memory in the chronicle
    if (a.bonds) for (const id in a.bonds) { const x = a.bonds[id]; x[2] *= BOND_DECAY[x[0]] || 0.997; if (x[2] < 0.08 || !S._a.has(+id)) delete a.bonds[id]; }
    // friendship: long mutual trust between neighbours who are not kin
    if (!a.group || a.age < 16 || Math.floor(S.tick / 30) % 3 !== a.id % 3) continue;
    // a grudge against one's own leader that has turned into enmity gets its reason written down
    const g0 = S._g.get(a.group), L0 = g0 && S._a.get(g0.leader);
    if (L0 && L0 !== a && (a.trust[L0.id] || 0) < -0.4 && !(a.bonds && a.bonds[L0.id])) {
      const nepo = g0.members.filter(id => { const m = S._a.get(id); return m && m !== L0 && kin(m, L0); }).length >= 2 && !kin(a, L0);
      const why = g0.take > 0.2 ? `${fem(L0, 'забирает', 'забирает')} себе ${Math.round(g0.take * 100)}% общего` : nepo ? 'раздаёт лучшее своей родне' : a.wealth < 0 ? 'при дележе оставляет голодным' : 'делит общее не по совести';
      bond(S, a, L0, 'rival', why, 0.4);
    }
    for (const id in a.trust) {
      // enmity with someone from a hostile village: the reason is the feud between the villages
      if (a.trust[id] < -0.4 && !(a.bonds && a.bonds[id])) {
        const o = S._a.get(+id), go = o && o.group && S._g.get(o.group);
        if (go && go.id !== a.group && (S.hostility[key(a.group, go.id)] || 0) > 0.4) bond(S, a, o, 'rival', `из враждебной «${go.name}»: стычки на промыслах`, 0.35);
        continue;
      }
      if (a.trust[id] < 0.45 || (a.bonds && a.bonds[id])) continue;
      const o = S._a.get(+id); if (!o || o.group !== a.group || o.age < 16 || kin(o, a) || (o.trust[a.id] || 0) < 0.45) continue;
      const g = S._g.get(a.group), same = o.job && o.job === a.job;
      const why = same ? `годами работают бок о бок${g ? ` в «${g.name}»` : ''}` : `давние соседи${g ? ` в «${g.name}»` : ''}`;
      bond(S, a, o, 'friend', why, 0.5); bond(S, o, a, 'friend', why, 0.5);
    }
  }
}
// children grow up into their parents' quarrels and friendships, a little weaker
function inheritBonds(S, a, parents) {
  for (const p of parents) {
    if (!p || !p.bonds) continue;
    for (const id in p.bonds) {
      const [k, , s, why] = p.bonds[id], o = S._a.get(+id); if (!o || o === a || kin(o, a)) continue;
      if (k === 'enemy' && s > 0.3) { a.bonds = a.bonds || {}; if (!a.bonds[id]) a.bonds[id] = ['enemy', S.tick, s * 0.5, `враг рода: ${why.replace(/меня/g, fem(p, 'отца', 'мать'))}`]; }
      else if ((k === 'friend' || k === 'sworn' || k === 'debt') && s > 0.35 && !(a.bonds && a.bonds[id])) { a.bonds = a.bonds || {}; a.bonds[id] = ['friend', S.tick, s * 0.4, `друг семьи: ${fem(o, 'дружил', 'дружила')} с ${fem(p, 'отцом', 'матерью')}`]; }
    }
  }
}
// sworn brothers: two who fought side by side and won, and already trusted each other
function swornAfterBattle(S, band, place) {
  let made = 0;
  for (let i = 0; i < band.length && made < 2; i++) for (let j = i + 1; j < band.length && made < 2; j++) {
    const a = band[i], b = band[j];
    if (kin(a, b) || bondOf(a, b) || (a.trust[b.id] || 0) < 0.3 || (b.trust[a.id] || 0) < 0.3 || rnd(S) > 0.35) continue;
    const why = `вместе бились у «${place}»`;
    bond(S, a, b, 'sworn', why, 0.7); bond(S, b, a, 'sworn', why, 0.7); made++;
  }
}
// childhood friends: a peer who grew up in the same village
function childhoodFriend(S, a) {
  if (!a.group) return;
  const g = S._g.get(a.group); if (!g) return;
  const peers = g.members.map(id => S._a.get(id)).filter(o => o && o !== a && !kin(o, a) && Math.abs(o.age - a.age) < 4 && o.age < 30);
  if (!peers.length || rnd(S) > 0.6) return;
  const o = peers[Math.floor(rnd(S) * peers.length)], why = `вместе росли в «${g.name}»`;
  bond(S, a, o, 'friend', why, 0.5); bond(S, o, a, 'friend', why, 0.4);
}
// two who go to sea in one boat
function boatFriends(S, g, fishers) {
  for (let i = 0; i + 1 < fishers.length; i += 2) {
    const a = fishers[i], b = fishers[i + 1];
    if (kin(a, b) || bondOf(a, b) || rnd(S) > 0.04) continue;
    const why = `вместе ходят в море из «${g.name}»`;
    bond(S, a, b, 'friend', why, 0.5); bond(S, b, a, 'friend', why, 0.5);
  }
}
