/* ---------- fates: life chronicle, memory, motives ---------- */
const BW = { theft: 1.5, quit: 1.5, affair: 3, jealousy: 3, dispute: 2, wergild: 3, enemy: 2, sworn: 2, love: 2, betrayed: 3, reconcile: 2, born: 1, marry: 1.5, child: 0.3, childDied: 0.6, spouseDied: 2, move: 1, found: 3, leader: 4, deposed: 4, coup: 4, schism: 3, exiled: 3, master: 2, client: 2, retainer: 2, bond: 3, freed: 2, battleW: 2, battleL: 2, wounded: 1, feud: 3, revenge: 5, murder: 5, elope: 5, plague: 2, orphan: 2, inherit: 1, returned: 4, goal: 1, goalTurn: 1.5, goalEnd: 2, law: 2, lawLost: 1.5, temper: 1.5, tyranny: 2.5, tax: 1, feedAll: 2, fedByLeader: 1, tribute: 1.5, apprentice: 1, death: 1, heir: 3, drowned: 2, famine: 1 };
// Drama counts turns of fate, not events. Everyday lines (a child born, a move, a house of one's own) are part of the
// chronicle but weigh nothing; the same turn again over the whole life weighs 1/(n+1)² of the first, so repeats add up to
// at most 1.64 of one turn; a turn that undoes an
// earlier one (the fall after the rise, the return after the exile, freedom after bondage) weighs half as much again.
const EVERYDAY = new Set(['born', 'child', 'move', 'house', 'apprentice', 'inherit', 'inheritHouse', 'aidReceived', 'aidReturned', 'death', 'goal']);
const RISE = ['leader', 'heir', 'coup', 'found', 'schism'], LOW = ['bond', 'client', 'orphan', 'exiled', 'deposed'];
const REVERSAL = { deposed: RISE, exiled: RISE, returned: ['exiled', 'quit'], freed: ['bond', 'client'], reconcile: ['enemy', 'rival', 'betrayed'], revenge: ['feud'], wergild: ['feud'], battleW: ['battleL'], leader: LOW, heir: LOW, coup: LOW, found: LOW, betrayed: ['sworn'], spouseDied: ['marry'] };
const turnKind = k => !EVERYDAY.has(k);
function turnWeight(a, k) {
  if (EVERYDAY.has(k)) return 0;
  const kc = a.kc || (a.kc = {}), n = kc[k] || 0;
  const back = REVERSAL[k] && REVERSAL[k].some(x => kc[x]);
  return (BW[k] || 1) / ((1 + n) * (1 + n)) * (back ? 1.5 : 1);
}
// ref: id of the event this line refers to (see the linked chronicle in 00-core)
function bio(S, a, k, s, ref) {
  if (!a) return;
  const b = a.bio || (a.bio = []);
  a.drama = (a.drama || 0) + turnWeight(a, k);
  const kc = a.kc || (a.kc = {}); kc[k] = (kc[k] || 0) + 1;
  b.push(ref ? [S.tick, k, s, cite(S, ref)] : [S.tick, k, s]);
  if (b.length > 46) b.splice(6, b.length - 46);
  temper(S, a, k, ref); // a turn of fate may change the character (Д6)
}
// the lives the Fates tab shows: the living and the legends of the dead, by the weight of their turns
const FATE_MIN = 9;
function topFates(S, n) {
  const alive = S.agents.filter(a => a.bio && (a.drama || 0) >= FATE_MIN).map(a => ({ id: a.id, name: a.name, sex: a.sex, bio: a.bio, goals: a.goals, drama: a.drama, alive: true, born: a.bornT !== undefined ? a.bornT : S.tick - a.age * 360, g: a.group }));
  const dead = (S.legends || []).map(l => Object.assign({ alive: false }, l));
  return alive.concat(dead).sort((x, y) => y.drama - x.drama).slice(0, n);
}
// how good the drama of the top lives is: how varied their turns, how many lived an arc to its end, how much repeats
function dramaMeasure(lives) {
  let lines = 0, repeats = 0, kindSum = 0, arcs = 0; const all = {};
  for (const p of lives) {
    const seen = new Set();
    for (const b of p.bio) { if (!turnKind(b[1])) continue; lines++; if (seen.has(b[1])) repeats++; seen.add(b[1]); all[b[1]] = (all[b[1]] || 0) + 1; }
    kindSum += seen.size;
    if ((p.goals || []).some(x => x.end && x.out !== 'died')) arcs++;
  }
  const top = Object.entries(all).sort((x, y) => y[1] - x[1])[0];
  // loops: a turn that comes back three times or more in one life shows where the world goes round in circles
  const loops = {}; for (const p of lives) { const c = {}; for (const b of p.bio) if (turnKind(b[1])) c[b[1]] = (c[b[1]] || 0) + 1; for (const k in c) if (c[k] >= 3) loops[k] = (loops[k] || 0) + 1; }
  return { loops, lives: lives.length, kinds: lives.length ? kindSum / lives.length : 0, distinct: Object.keys(all).length, repeats: lines ? repeats / lines : 0, arcs: lives.length ? arcs / lives.length : 0, topKind: top ? top[0] : null, topShare: top && lines ? top[1] / lines : 0 };
}
// attach a reference once the event exists: to a chronicle line written this very tick, or to a tie
function refLast(S, a, kind, id) { if (!a || !a.bio || !id) return; for (let i = a.bio.length - 1; i >= 0 && a.bio[i][0] === S.tick; i--) if (a.bio[i][1] === kind && !a.bio[i][3]) { a.bio[i][3] = cite(S, id); return; } }
function refBond(S, a, b, id) { const x = a && b && a.bonds && a.bonds[b.id]; if (x && id && !x[5]) { x[4] = x[4] || 0; x[5] = cite(S, id); } }
// what recently happened to this village that people would blame: famine, a lost battle, a plague, debts, an exodus
function recentCauses(S, g) { return S.events.filter(e => e.gs && e.gs.includes(g.id) && S.tick - e.t < 360 * 5 && ['famine', 'battle', 'conquest', 'debt', 'exodus', 'revolt', 'plague', 'case'].includes(e.type)).slice(0, 2).map(e => e.id); }
function groupName(S, id) { const g = S._g.get(id); return g ? g.name : (S.arch && S.arch[id] ? S.arch[id].name : 'исчезнувшей деревни'); }
const AID_MEMORY_MIN = 2 * 360, AID_MEMORY_MAX = 15 * 360;
// ev: the id of the event in which the grain was given; the memory, the chronicle line and the tie all point to it
function rememberGrain(S, a, helper, ev) {
  const memories = (a.grainMemories || []).filter(m => S.tick - m.tick <= AID_MEMORY_MAX);
  if (memories.some(m => m.helper === helper.id)) return;
  memories.push(ev ? { helper: helper.id, tick: S.tick, ev: cite(S, ev) } : { helper: helper.id, tick: S.tick });
  a.grainMemories = memories.slice(-4);
  bio(S, a, 'aidReceived', `В голод получает зерно. Помогает ${helper.name}`, ev);
  bond(S, a, helper, 'debt', `${fem(helper, 'прислал', 'прислала')} зерно в голод`, 0.6, false, ev);
}
function rememberedGrain(S, witness, villageId, minAge) {
  for (const memory of witness.grainMemories || []) {
    const age = S.tick - memory.tick;
    if (age < minAge || age > AID_MEMORY_MAX) continue;
    const helper = S._a.get(memory.helper);
    if (helper && helper.group === villageId) return { witness, helper, memory };
  }
  return null;
}
function grainObligation(S, village, leader, neighbour) {
  const own = rememberedGrain(S, leader, neighbour.id, AID_MEMORY_MIN);
  if (own) return own;
  for (const id of village.members) {
    if (id === leader.id) continue;
    const obligation = rememberedGrain(S, S._a.get(id), neighbour.id, AID_MEMORY_MIN);
    if (obligation) return obligation;
  }
  return null;
}
function repayGrain(S, village, obligation) {
  for (const id of village.members) {
    const a = S._a.get(id);
    if (a.grainMemories) a.grainMemories = a.grainMemories.filter(m => m.helper !== obligation.helper.id);
  }
  const { witness, helper, memory } = obligation;
  bio(S, witness, 'aidReturned', `Деревня делится зерном в ответ на давнюю помощь. Тогда зерно присылает ${helper.name}`, memory && memory.ev);
}
function kinOf(S, a) { return S.agents.filter(o => o !== a && kin(o, a) && o.spouse !== a.id || o.id === a.spouse); }
function legend(S, a, why) {
  if ((a.drama || 0) < 14 || !a.bio) return;
  S.legends = S.legends || [];
  S.legends.push({ id: a.id, name: a.name, sex: a.sex, born: a.bornT !== undefined ? a.bornT : S.tick - a.age * 360, died: S.tick, why, bio: a.bio.slice(), goals: a.goals ? JSON.parse(JSON.stringify(a.goals)) : undefined, drama: a.drama, mother: a.mother, father: a.father, group: a.group ? groupName(S, a.group) : null });
  S.legends.sort((x, y) => y.drama - x.drama);
  if (S.legends.length > 40) S.legends.length = 40;
}
function feudFor(S, victim, killers, how, killer, ev) {
  if (!killers) return;
  for (const o of S.agents) {
    if (o === victim || o.group === killers.id) continue;
    const rel = o.mother === victim.id || o.father === victim.id ? (victim.sex === 'f' ? 'мать' : 'отца') : victim.spouse === o.id ? (victim.sex === 'f' ? 'жену' : 'мужа') : (victim.mother && o.mother === victim.mother) || (victim.father && o.father === victim.father) ? (victim.sex === 'f' ? 'сестру' : 'брата') : null;
    if (!rel) continue;
    if (o.feud && S.tick - o.feud.t < 360 * 30) continue;
    o.feud = { ev: cite(S, ev), g: killers.id, gname: killers.name, L: killers.leader, Lname: (S._a.get(killers.leader) || {}).name || '', t: S.tick, v: victim.name, rel };
    const NOM = { 'отца': 'отец', 'мать': 'мать', 'жену': 'жена', 'мужа': 'муж', 'брата': 'брат', 'сестру': 'сестра' };
    bio(S, o, 'feud', `${how} гибнет ${NOM[rel]} ${victim.name}${killer ? ` от руки ${nameCase(killer, 'genitive')}` : ''}. ${o.name} клянётся отомстить «${killers.name}»`, ev);
    if (killer) bond(S, o, killer, 'enemy', `${fem(killer, 'убил', 'убила')} ${rel} ${nameCase(victim, 'accusative')} в бою`, 0.8, false, ev);
  }
}
function feudVictim(f, padezh = 'accusative') {
  const sex = { мать: 'f', жену: 'f', сестру: 'f', отца: 'm', мужа: 'm', брата: 'm' }[f.rel];
  return sex ? nameCase({ name: f.v, sex }, padezh) : `погибшего человека (${f.v})`;
}
function feudKin(f) {
  return f.rel === 'родича' ? `родича (${f.v})` : `${f.rel} ${feudVictim(f)}`;
}
function revengeDone(S, a, how) {
  if (!a.feud || a.feud.done) return;
  a.feud.done = S.tick; a.feud.out = 'done';
  bio(S, a, 'revenge', how, a.feud.ev && eventById(S, a.feud.ev) ? a.feud.ev : undefined);
  const first = !S.firstRevenge; S.firstRevenge = true;
  const ev = log(S, 'revenge', `${a.name} мстит за ${feudKin(a.feud)}: ${how.charAt(0).toLowerCase() + how.slice(1)}`, a.x, a.y, (S._g.get(a.group) || {}).hue || 0, { first, why: `${yrs(Math.max(1, Math.round((S.tick - a.feud.t) / 360)))} назад «${a.feud.gname}» убили ${a.feud.rel} ${nameCase(a, 'genitive')}. С тех пор ${a.sex === 'f' ? 'она' : 'он'} ждал${a.sex === 'f' ? 'а' : ''} своего часа.`, who: [a.id], causes: a.feud.ev && eventById(S, a.feud.ev) ? [a.feud.ev] : undefined });
  a.feud.endEv = cite(S, ev.id);
  return ev;
}
function fatesMonth(S) {
  for (const g of S.groups) {
    if (!g.home || g.dead) continue;
    const L = S._a.get(g.leader); if (!L) continue;
    // feud pressure on group relations
    for (const id of g.members) {
      const m = S._a.get(id); if (!m || !m.feud || m.feud.done) continue;
      const T = S._g.get(m.feud.g); if (m.feud.personal && !S._a.has(m.feud.L)) { m.feud.done = S.tick; m.feud.out = 'lost'; continue; }
      if (!T || T.dead) { if (S.tick - m.feud.t > 360 * 3 && !m.feud.done) { m.feud.done = S.tick; m.feud.out = 'faded'; bio(S, m, 'feud', `Обидчики из «${m.feud.gname}» сошли со сцены, и месть остаётся неисполненной`, m.feud.ev && eventById(S, m.feud.ev) ? m.feud.ev : undefined); } continue; }
      const k = key(g.id, T.id), w = m === L ? 0.035 : 0.004 * Math.min(3, 0.5 + m.status / 6);
      if (T !== g && !allied(S, g.id, T.id)) S.hostility[k] = Math.min(2, (S.hostility[k] || 0) + w);
      // killer's leader lives in this very village: blood for blood
      const KL = S._a.get(m.feud.L);
      if (KL && KL.group === g.id && KL !== m && m.ambition > 0.4 && m.age > 17 && rnd(S) < (m.feud.personal ? 0.02 : 0.012)) {
        // the elders may still turn blood into blood money
        if (bloodOrWergild(S, g, m, KL)) break;
        const wasL = KL === L;
        bio(S, KL, 'death', `${KL.sex === 'f' ? 'Убита' : 'Убит'}: ${m.name} мстит за ${feudVictim(m.feud)}`);
        const rev = revengeDone(S, m, `Убивает ${nameCase(KL, 'accusative')}${wasL ? `, вождя «${g.name}»` : ''}`), revId = rev && rev.id;
        bio(S, m, 'murder', `Своими руками убивает ${nameCase(KL, 'accusative')}`);
        S.stats.murders = (S.stats.murders || 0) + 1;
        for (const o of kinOf(S, KL)) bond(S, o, m, 'enemy', `${fem(m, 'убил', 'убила')} ${nameCase(KL, 'accusative')}`, 0.9, false, revId);
        for (const o of kinOf(S, KL)) if (!o.feud || o.feud.done) { o.feud = { g: g.id, gname: g.name, L: m.id, Lname: m.name, t: S.tick, v: KL.name, rel: o.mother === KL.id || o.father === KL.id ? (KL.sex === 'f' ? 'мать' : 'отца') : 'родича', personal: m.id, ev: cite(S, revId) }; bio(S, o, 'feud', `${m.name} убивает ${nameCase(KL, 'accusative')}. ${o.name} клянётся отомстить`, revId); }
        removeAgent(S, KL, 'killed');
        if (g.dead) break;
        bloodShed(S, g, revId);
        if (!wasL && m.group === g.id && L.coop > 0.4 && rnd(S) < 0.6) { leave(S, m, 'move'); m.x += 50; bio(S, m, 'exiled', `За убийство ${m.sex === 'f' ? 'изгнана' : 'изгнан'} из «${g.name}»`, revId); m.exiledFrom = g.id; (m.exiled = m.exiled || {})[g.id] = S.tick; returnGoal(S, m, g, L, revId, 'exile'); }
        break;
      }
    }
    if (g.dead) continue;
    // personal vengeance inside the village (killer is a person, not a village)
  }
  // apprentices
  for (const a of S.agents) {
    if (a.age > 25 || !a.group || a.master || a.teacher) continue;
    const g = S._g.get(a.group); if (!g) continue;
    const t = g.members.map(id => S._a.get(id)).find(m => m && m.master && m.master === a.job && m !== a);
    if (t) { a.teacher = t.id; a.teacherName = t.name; bump(a, t, 0.25); bump(t, a, 0.15); bond(S, a, t, 'mentor', 'учит ремеслу', 0.6); bond(S, t, a, 'pupil', 'учится ремеслу', 0.5); bio(S, a, 'apprentice', `Учится ремеслу у ${nameCase(t, 'genitive')}`); }
  }
}
function elope(S, f, m) {
  const gf = S._g.get(f.group), gm = S._g.get(m.group);
  leave(S, f, 'move'); leave(S, m, 'move');
  f.spouse = m.id; m.spouse = f.id; bump(f, m, 0.6); bump(m, f, 0.6);
  const eev = note(S, 'marriage', `${f.name} и ${m.name} бегут вместе против воли родни`, (f.x + m.x) / 2, (f.y + m.y) / 2, 0, { who: [f.id, m.id] }).id; f.marryEv = m.marryEv = cite(S, eev);
  matchWedding(S, f, m, eev, true);
  bond(S, f, m, 'love', 'бежали вместе против воли родни', 0.9, false, eev); bond(S, m, f, 'love', 'бежали вместе против воли родни', 0.9, false, eev);
  const ng = createGroup(S, m.ambition >= f.ambition ? m : f, [m.ambition >= f.ambition ? f : m]);
  f.escape = m.escape = true;
  ng.x0 = (f.x + m.x) / 2;
  for (const g of [gf, gm]) if (g && !g.dead) S.hostility[key(g.id, ng.id)] = 0.5;
  const txt = `Бегут вместе: «${gf ? gf.name : '?'}» и «${gm ? gm.name : '?'}» враждуют, свадьбы им не дали`;
  bio(S, f, 'elope', `${txt}. С ${nameCase(m, 'instrumental')} ${f.sex === 'f' ? 'она' : 'он'} основывает свою семью`, eev); bio(S, m, 'elope', `${txt}. С ${nameCase(f, 'instrumental')} основывает свою семью`, eev);
  S.stats.elopes = (S.stats.elopes || 0) + 1;
  log(S, 'elope', `${f.name} из «${gf ? gf.name : '?'}» и ${m.name} из «${gm ? gm.name : '?'}» бегут вместе и уходят жить своим домом`, (f.x + m.x) / 2, (f.y + m.y) / 2, ng.hue, { first: !S.firstElope, why: sent([`между деревнями ${hostWord(S.hostility[key(gf ? gf.id : 0, gm ? gm.id : 0)] || 0)}`, 'вожди не отдают своих людей за врагов', `${f.name} и ${m.name} доверяют друг другу больше, чем своим деревням`]), who: [f.id, m.id], gs: [ng.id] });
  S.firstElope = true;
}

