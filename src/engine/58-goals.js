/* ---------- goals and arcs: what a person wants, the road to it and how it ends ---------- */
// a.goals: [{ k, t, txt, ev, turns: [[t, txt, ev]], end, out, endTxt, endEv, ...data }]
//   k:   revenge (avenge kin), power (become a leader), return (go back where one was cast out or left kin),
//        match (marry a daughter into a leader's family), house (win back the family house lost in a dispute)
//   out: done, failed, settled (revenge bought off), abandoned (given up with age or a new life), died
// The opening, the turns and the ending each point to a chronicle event; an ending with no event of its own gets a quiet
// one whose cause is the opening, so the chain «завязка → развязка» can be followed after the feed forgets both.
const GOAL_NAME = { revenge: 'Месть', power: 'Власть', return: 'Возвращение', match: 'Выгодная партия', house: 'Отцовский дом' };
const GOAL_OUT = { done: 'сбылось', failed: 'не сбылось', settled: 'кончилось выкупом', abandoned: 'оставлено', died: 'оборвалось со смертью' };
function goalOf(a, k, pred) { for (const x of (a && a.goals) || []) if (x.k === k && !x.end && (!pred || pred(x))) return x; return null; }
// open a goal; bioLine: also write the opening into the life chronicle (when no other line already tells it)
function goalOpen(S, a, k, txt, ev, data, bioLine) {
  if (!a || goalOf(a, k)) return null;
  // a road just ended is not taken up again at once
  if ((a.goals || []).some(y => y.k === k && y.end && S.tick - y.end < 360 * 6)) return null;
  const x = Object.assign({ k, t: S.tick, txt }, data || {});
  if (ev && eventById(S, ev)) x.ev = cite(S, ev);
  const G = a.goals || (a.goals = []);
  G.push(x);
  // keep every open goal and the latest closed ones
  while (G.length > 6) { const i = G.findIndex(y => y.end); if (i < 0) break; G.splice(i, 1); }
  if (bioLine) bio(S, a, 'goal', txt, x.ev);
  S.stats['goal_' + k] = (S.stats['goal_' + k] || 0) + 1;
  return x;
}
function goalTurn(S, a, x, txt, ev) {
  const T = x.turns || (x.turns = []);
  T.push(ev ? [S.tick, txt, cite(S, ev)] : [S.tick, txt]);
  if (T.length > 3) T.shift();
  bio(S, a, 'goalTurn', txt, ev);
}
// close a goal; quiet: another chronicle line already tells the ending, so only the arc records it
function goalEnd(S, a, x, out, txt, ev, quiet) {
  if (!x || x.end) return;
  x.end = S.tick; x.out = out; x.endTxt = txt;
  if (!ev || !eventById(S, ev)) { const g = S._g.get(a.group); ev = note(S, 'arc', `${a.name}: ${txt}`, a.x, a.y, g ? g.hue : 0, { who: [a.id], gs: g ? [g.id] : [], causes: x.ev ? [x.ev] : undefined }).id; }
  x.endEv = cite(S, ev);
  if (!quiet) bio(S, a, 'goalEnd', txt, ev);
  const k = 'arc_' + x.k + '_' + out; S.stats[k] = (S.stats[k] || 0) + 1;
}
// a life ends (or leaves the island): what was still wanted stays undone
function goalsOnDeath(S, a, why, ev) {
  const away = why === 'emigr' || why === 'move';
  for (const x of a.goals || []) if (!x.end) {
    if (away) {
      goalEnd(S, a, x, 'abandoned', 'уплывает с острова, так и не добившись своего', ev, true);
    } else {
      x.end = S.tick;
      if (ev) x.endEv = cite(S, ev);
      x.out = 'died';
      x.endTxt = 'умирает, так и не добившись своего';
      const key = 'arc_' + x.k + '_died';
      S.stats[key] = (S.stats[key] || 0) + 1;
    }
  }
}
// the event of the line just written about a.leadership (a coup, a succession, a founding): the ending of a road to power
function lastRef(a, kinds, since) { for (let i = (a.bio || []).length - 1; i >= 0 && a.bio[i][0] >= since; i--) if (kinds.includes(a.bio[i][1]) && a.bio[i][3]) return a.bio[i][3]; return null; }
const isLeaderKin = (S, m) => { if (!m) return null; if (m.role === 'leader') return m; for (const pid of [m.father, m.mother]) { const p = pid && S._a.get(pid); if (p && p.role === 'leader') return p; } return null; };

/* --- openings called from where the story turns --- */
// lost an election and did not accept it
function powerLost(S, R, g, W, ev) {
  if (!R || R.ambition < 0.5 || R.age < 20 || R.age > 52) return;
  goalOpen(S, R, 'power', `Проигрывает ${W.name} выборы вождя «${g.name}», но не оставляет надежды на власть`, ev, { g: g.id }, true);
}
// a rival who openly aims at the leader's place
function powerAim(S, ch, L, g) {
  if (goalOf(ch, 'power') || ch.age > 55 || (ch.goals || []).some(y => y.k === 'power' && y.end && S.tick - y.end < 360 * 6)) return;
  const ev = note(S, 'arc', `${ch.name} ${fem(ch, 'метит', 'метит')} на место вождя «${g.name}» ${L.name}`, ch.x, ch.y, g.hue, { who: [ch.id, L.id], gs: [g.id] }).id;
  goalOpen(S, ch, 'power', `Метит на место вождя «${g.name}» ${L.name}`, ev, { g: g.id }, true);
  refBond(S, ch, L, ev); refBond(S, L, ch, ev);
}
// a deposed leader who stays wants the seat back
function powerDeposed(S, L, g, ev) { if (L.ambition > 0.45 && L.age < 56) goalOpen(S, L, 'power', `Хочет вернуть себе власть в «${g.name}»`, ev, { g: g.id, back: 1 }); }
// cast out, or left kin behind: wants to come back one day
function returnGoal(S, a, g, L, ev, how) { goalOpen(S, a, 'return', `Хочет вернуться в «${g.name}»`, ev, { g: g.id, gname: g.name, by: L ? L.id : null, byName: L ? L.name : '', how }); }
function kinLeftIn(S, a, g) { return g.members.map(id => S._a.get(id)).find(o => o && o !== a && o.id !== a.spouse && kin(o, a)) || null; }
// lost the family house in a dispute
function houseGoal(S, sib, heir, g, h, oname, ev) { goalOpen(S, sib, 'house', `Затаивает обиду: хочет вернуть себе дом ${oname}`, ev, { h: h.id, g: g.id, heir: heir.id, heirName: heir.name, oname }); }

/* --- endings called from where they happen --- */
// a wedding settles a parent's plan for the daughter, one way or the other; eloping always breaks it
function matchWedding(S, f, m, wev, eloped) {
  for (const pid of [f.father, f.mother]) {
    const p = pid && S._a.get(pid), x = p && goalOf(p, 'match', y => y.d === f.id); if (!x) continue;
    const L = isLeaderKin(S, m);
    if (eloped) goalEnd(S, p, x, 'failed', `Дочь ${f.name} бежит с ${m.name} против воли родни: о сыне вождя можно забыть`, wev);
    else if (L) goalEnd(S, p, x, 'done', `Выдаёт дочь ${f.name} за ${m.name}${L === m ? `, вождя` : `, ${fem(m, 'сына', 'дочь')} вождя ${L.name}`}`, wev);
    else { goalEnd(S, p, x, 'failed', `Дочь ${f.name} выходит за ${m.name}, а не за сына вождя`, wev); bump(p, m, -0.05); }
  }
}
// in the marriage choice: a daughter whose parent wants a leader's son for her; returns the extra pull toward m
function matchPull(S, f, m) {
  for (const pid of [f.father, f.mother]) { const p = pid && S._a.get(pid); if (p && goalOf(p, 'match', y => y.d === f.id)) return isLeaderKin(S, m) ? 0.9 : -0.2; }
  return 0;
}
// a house whose owner is gone: the one who lost it in the dispute may take it back over the dead heir's family
function houseClaimant(S, g, h) {
  for (const id of g.members) { const a = S._a.get(id); if (a && goalOf(a, 'house', x => x.h === h.id)) return a; }
  return null;
}
function houseSettled(S, g, h, prevOwner, next, claimed, deathEv) {
  const x = next && goalOf(next, 'house', y => y.h === h.id);
  if (x) {
    const heirDead = !S._a.has(x.heir);
    const ev = claimed ? log(S, 'case', `${next.name} забирает назад дом ${x.oname} в «${g.name}»${heirDead ? ` после смерти ${x.heirName}` : ''}`, h.x, h.y, g.hue, { why: sent([`${yrs(Math.max(1, Math.round((S.tick - x.t) / 360)))} назад дом по суду ${fem(S._a.get(x.heir) || { sex: 'm' }, 'достался', 'достался')} ${x.heirName}`, `${next.name} так и не ${fem(next, 'смирился', 'смирилась')}`, 'семья умершего остаётся без своего крова']), who: [next.id], gs: [g.id], causes: [x.ev, deathEv].filter(Boolean) }).id : deathEv;
    goalEnd(S, next, x, 'done', `Возвращает себе дом ${x.oname}`, ev);
    // the claimant's own house goes free: the dead heir's family moves there
    if (claimed) for (const o of livingHouses(g)) if (o !== h && o.owner === next.id) { o.owner = null; o.oname = null; o.emptyT = S.tick; }
    if (claimed) for (const id of g.members) { const o = S._a.get(id); if (o && o !== next && (o.mother === x.heir || o.father === x.heir || o.spouse === x.heir || o.id === x.heir)) bond(S, o, next, 'enemy', `${fem(next, 'отнял', 'отняла')} наш дом`, 0.6, false, ev); }
    return;
  }
  // the heir's line keeps it: whoever hoped to win it back sees it pass on
  for (const id of g.members) {
    const a = S._a.get(id), y = a && goalOf(a, 'house', z => z.h === h.id);
    if (y && prevOwner === y.heir) goalEnd(S, a, y, 'failed', next ? `Дом ${y.oname} после ${y.heirName} переходит к ${next.name}, и вернуть его уже не выйдет` : `Дом ${y.oname} пустеет, и бороться больше не за что`, deathEv);
  }
}

/* --- every month: goals open from long states, move on and resolve --- */
function goalsMonth(S) {
  const sons = S.agents.filter(m => m.sex === 'm' && !m.spouse && m.age >= 15 && m.age < 35 && isLeaderKin(S, m));
  for (const a of S.agents.slice()) {
    if (!S._a.has(a.id)) continue;
    const g = a.group && S._g.get(a.group);
    // revenge follows the feud the person swore
    const f = a.feud;
    if (f && f.t !== a.feudGoalT) {
      const old = goalOf(a, 'revenge'); if (old) goalEnd(S, a, old, 'abandoned', 'Новая обида заслоняет старую месть');
      a.feudGoalT = f.t;
      if (!f.done) goalOpen(S, a, 'revenge', `Клянётся отомстить за ${f.rel} ${f.v}`, f.ev, { ft: f.t });
    }
    const rv = goalOf(a, 'revenge');
    if (rv) {
      if (f && f.t === rv.ft && f.done) {
        if (f.out === 'done') goalEnd(S, a, rv, 'done', `Месть за ${f.rel} ${f.v} свершилась`, f.endEv, true);
        else if (f.settled) goalEnd(S, a, rv, 'settled', `Берёт виру за ${f.rel} ${f.v} вместо крови`, f.endEv, true);
        else if (f.out === 'faded') goalEnd(S, a, rv, 'failed', `Обидчики из «${f.gname}» сошли со сцены`, null, true);
        else goalEnd(S, a, rv, 'failed', `${f.Lname || 'Обидчик'} умирает раньше, чем ${a.name} ${fem(a, 'успевает', 'успевает')} отомстить`);
      } else if (f && !f.done && (S.tick - f.t > 360 * 25 || a.age > 68)) {
        f.done = S.tick; f.out = 'abandoned';
        goalEnd(S, a, rv, 'abandoned', `${yrs(Math.round((S.tick - f.t) / 360))} ждёт мести за ${f.rel} ${f.v} и наконец отпускает обиду`);
      }
    }
    // power: reached by a coup, a succession, a founding or a split; lost to exile; given up with age
    const pw = goalOf(a, 'power');
    if (pw) {
      if (a.role === 'leader' && g && g.members.length >= 3 && S.tick > pw.t) {
        const ev = lastRef(a, ['leader', 'heir', 'coup', 'found', 'schism'], S.tick - 40);
        goalEnd(S, a, pw, 'done', pw.back ? (g.id === pw.g ? `Возвращает себе власть: снова во главе «${g.name}»` : `Снова у власти, теперь во главе «${g.name}»`) : `Добивается своего: во главе «${g.name}»`, ev, !!ev && !pw.back);
      } else if (a.exiled && Object.values(a.exiled).some(t => t > pw.t)) goalEnd(S, a, pw, 'failed', 'Изгнание кладёт конец надеждам на власть');
      else if (a.age > 62 || S.tick - pw.t > 360 * 25) goalEnd(S, a, pw, 'abandoned', 'Стареет и оставляет мечту о власти');
    }
    // return: back home once the one who drove them out is gone
    const rt = goalOf(a, 'return');
    if (rt) returnStep(S, a, rt);
    // a parent's plan for a daughter of marrying age
    if (a.age >= 32 && a.age < 62 && a.ambition > 0.55 && g && g.home && a.role !== 'leader' && sons.length && !goalOf(a, 'match')) {
      const d = S.agents.find(o => o.sex === 'f' && !o.spouse && o.age >= 15 && o.age < 17 && o.group === a.group && (o.father === a.id || o.mother === a.id) && !o.matchSeen);
      if (d) {
        d.matchSeen = 1;
        const kinL = isLeaderKin(S, d);
        if (!kinL && rnd(S) < 0.5) {
          const target = sons.filter(s => s.group === a.group || Math.hypot(s.x - a.x, s.y - a.y) < 320)[0];
          if (target) {
            const L = isLeaderKin(S, target);
            const ev = note(S, 'arc', `${a.name} задумывает выдать дочь ${d.name} за ${target === L ? `вождя ${L.name}` : `${target.name}, сына вождя ${L.name}`}`, a.x, a.y, g.hue, { who: [a.id, d.id, target.id], gs: [g.id] }).id;
            goalOpen(S, a, 'match', `Задумывает выдать дочь ${d.name} за сына вождя`, ev, { d: d.id, dName: d.name }, true);
          }
        }
      }
    }
    const mt = goalOf(a, 'match');
    if (mt) { const d = S._a.get(mt.d); if (!d) goalEnd(S, a, mt, 'failed', `Дочь ${mt.dName} умирает незамужней`); else if (d.age > 28) goalEnd(S, a, mt, 'abandoned', `Дочь ${d.name} так и остаётся без мужа`); }
    // the family house: given up when one moves away for good or grows old
    const hs = goalOf(a, 'house');
    if (hs) { const hg = S._g.get(hs.g), h = hg && houseOf(hg, hs.h); if (!h || h.ruined) goalEnd(S, a, hs, 'failed', `Дом ${hs.oname} разрушен, и спорить больше не о чем`); else if (a.group !== hs.g && !hs.away) hs.away = S.tick; else if (a.group === hs.g) hs.away = 0; if (!hs.end && ((hs.away && S.tick - hs.away > 360 * 4) || a.age > 66)) goalEnd(S, a, hs, 'abandoned', a.group !== hs.g ? `Обживается на новом месте и забывает о доме ${hs.oname}` : `Стареет и перестаёт спорить за дом ${hs.oname}`); }
  }
}
// one month on the road home: wait while the one who cast you out rules; then ask the new leader to take you back
function returnStep(S, a, x) {
  const g = S._g.get(x.g);
  if (a.group === x.g) { goalEnd(S, a, x, 'done', `Снова живёт в «${x.gname}»`); return; }
  if (!g || g.dead || !g.home) { goalEnd(S, a, x, 'failed', `«${x.gname}» больше нет: возвращаться некуда`); return; }
  if (a.role === 'leader') { const h = S._g.get(a.group); if (h && h.members.length >= 3) { goalEnd(S, a, x, 'abandoned', `Во главе «${h.name}» больше не думает о возвращении в «${x.gname}»`); return; } }
  if (S.tick - x.t > 360 * 25 || a.age > 70) { goalEnd(S, a, x, 'abandoned', `Так и не возвращается в «${x.gname}»`); return; }
  const wait = x.how === 'exile' ? 360 * 5 : 360 * 2;
  const L = S._a.get(g.leader);
  if (!L || S.tick - x.t < wait || L.id === x.by || S.tick - (x.ask || 0) < 360 * 2 || rnd(S) > 0.12) return;
  if (!reach(S, a.x, a.y, g.home.x, g.home.y)) return;
  x.ask = S.tick;
  const yes = bondW(L, a) > -0.2 && (L.trust[a.id] || 0) > -0.3 && rnd(S) < 0.35 + 0.4 * L.coop + (kinLeftIn(S, a, g) ? 0.15 : 0) - (x.how === 'exile' ? 0.15 : 0);
  if (!yes) {
    x.no = (x.no || 0) + 1;
    const e = note(S, 'exile', `${L.name} не пускает ${a.name} обратно в «${g.name}»`, a.x, a.y, g.hue, { who: [a.id, L.id], gs: [g.id], causes: x.ev ? [x.ev] : undefined }).id;
    if (x.no >= 2) { goalEnd(S, a, x, 'failed', `${L.name} второй раз не пускает в «${g.name}»: дороги назад нет`, e); bond(S, a, L, 'rival', `не пустил${fem(L, '', 'а')} меня обратно в «${g.name}»`, 0.4, false, e); }
    else goalTurn(S, a, x, `Просится назад в «${g.name}», но ${L.name} ${fem(L, 'отказывает', 'отказывает')}`, e);
    return;
  }
  const by = x.by && S._a.get(x.by), was = x.how === 'exile' ? `${fem(a, 'изгнан', 'изгнана')}` : `${fem(a, 'ушёл', 'ушла')}`;
  if (a.exiledFrom === g.id) a.exiledFrom = null;
  if (a.exiled) delete a.exiled[g.id]; if (a.quit) delete a.quit[g.id];
  const sp = a.spouse && S._a.get(a.spouse), old = a.group;
  join(S, a, g, L.id); a.x = g.home.x + gauss(S) * 12; a.y = g.home.y + gauss(S) * 12;
  if (sp && sp.group === old && sp.role !== 'leader' && rnd(S) < 0.7) { join(S, sp, g, L.id); sp.x = a.x; sp.y = a.y; }
  const kinB = kinLeftIn(S, a, g);
  const why = sent([`${yrs(Math.max(1, Math.round((S.tick - x.t) / 360)))} назад ${a.name} ${was} из «${g.name}»${x.byName ? ` при вожде ${x.byName}` : ''}`, by && by.group === g.id ? '' : x.byName ? `${x.byName} ${by ? 'больше не правит' : 'уже нет в живых'}` : '', `${L.name} ${fem(L, 'принимает', 'принимает')} ${fem(a, 'его', 'её')} обратно`, kinB ? `в деревне ${fem(a, 'его', 'её')} ждёт ${kinB.name}` : '']);
  const ev = (x.how === 'exile' ? log : note)(S, 'exile', `${a.name} возвращается в «${g.name}»${x.how === 'exile' ? ', откуда был' + fem(a, '', 'а') + ' изгнан' + fem(a, '', 'а') : ''}`, a.x, a.y, g.hue, { why, who: [a.id, L.id], gs: [g.id], causes: x.ev ? [x.ev] : undefined });
  S.stats.homecomings = (S.stats.homecomings || 0) + 1;
  bio(S, a, 'returned', `Возвращается в «${g.name}»: ${L.name} ${fem(L, 'принимает', 'принимает')} обратно`, ev.id);
  goalEnd(S, a, x, 'done', `Снова живёт в «${g.name}»`, ev.id, true);
}
