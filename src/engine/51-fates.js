/* ---------- fates: life chronicle, memory, motives ---------- */
const BW = { theft: 1.5, quit: 1.5, born: 1, marry: 1.5, child: 0.3, childDied: 0.6, spouseDied: 2, move: 1, found: 3, leader: 4, deposed: 4, coup: 4, schism: 3, exiled: 3, master: 2, client: 2, retainer: 2, bond: 3, freed: 2, battleW: 2, battleL: 2, wounded: 1, feud: 3, revenge: 5, murder: 5, elope: 5, plague: 2, orphan: 2, inherit: 1, returned: 4, apprentice: 1, death: 1, heir: 3, drowned: 2, famine: 1 };
function bio(S, a, k, s) {
  if (!a) return;
  const b = a.bio || (a.bio = []);
  // the same turn of fate repeated within five years matters less each time
  let rep = 0; for (let i = b.length - 1; i >= 0 && S.tick - b[i][0] < 360 * 5; i--) if (b[i][1] === k) rep++;
  b.push([S.tick, k, s]);
  if (b.length > 46) b.splice(6, b.length - 46);
  a.drama = (a.drama || 0) + (BW[k] || 1) / (1 + rep);
}
function groupName(S, id) { const g = S._g.get(id); return g ? g.name : (S.arch && S.arch[id] ? S.arch[id].name : 'исчезнувшей деревни'); }
const AID_MEMORY_MIN = 2 * 360, AID_MEMORY_MAX = 15 * 360;
function rememberGrain(S, a, helper) {
  const memories = (a.grainMemories || []).filter(m => S.tick - m.tick <= AID_MEMORY_MAX);
  if (memories.some(m => m.helper === helper.id)) return;
  memories.push({ helper: helper.id, tick: S.tick });
  a.grainMemories = memories.slice(-4);
  bio(S, a, 'aidReceived', `В голод получает зерно. Помогает ${helper.name}`);
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
  const { witness, helper } = obligation;
  bio(S, witness, 'aidReturned', `Деревня делится зерном в ответ на давнюю помощь. Тогда зерно присылает ${helper.name}`);
}
function kinOf(S, a) { return S.agents.filter(o => o !== a && kin(o, a) && o.spouse !== a.id || o.id === a.spouse); }
function legend(S, a, why) {
  if ((a.drama || 0) < 14 || !a.bio) return;
  S.legends = S.legends || [];
  S.legends.push({ id: a.id, name: a.name, sex: a.sex, born: a.bornT !== undefined ? a.bornT : S.tick - a.age * 360, died: S.tick, why, bio: a.bio.slice(), drama: a.drama, mother: a.mother, father: a.father, group: a.group ? groupName(S, a.group) : null });
  S.legends.sort((x, y) => y.drama - x.drama);
  if (S.legends.length > 40) S.legends.length = 40;
}
function feudFor(S, victim, killers, how) {
  if (!killers) return;
  for (const o of S.agents) {
    if (o === victim || o.group === killers.id) continue;
    const rel = o.mother === victim.id || o.father === victim.id ? (victim.sex === 'f' ? 'мать' : 'отца') : victim.spouse === o.id ? (victim.sex === 'f' ? 'жену' : 'мужа') : (victim.mother && o.mother === victim.mother) || (victim.father && o.father === victim.father) ? (victim.sex === 'f' ? 'сестру' : 'брата') : null;
    if (!rel) continue;
    if (o.feud && S.tick - o.feud.t < 360 * 30) continue;
    o.feud = { g: killers.id, gname: killers.name, L: killers.leader, Lname: (S._a.get(killers.leader) || {}).name || '', t: S.tick, v: victim.name, rel };
    const NOM = { 'отца': 'отец', 'мать': 'мать', 'жену': 'жена', 'мужа': 'муж', 'брата': 'брат', 'сестру': 'сестра' };
    bio(S, o, 'feud', `${how} гибнет ${NOM[rel]} ${victim.name}. ${o.name} клянётся отомстить «${killers.name}»`);
  }
}
function revengeDone(S, a, how) {
  if (!a.feud || a.feud.done) return;
  a.feud.done = S.tick;
  bio(S, a, 'revenge', how);
  const first = !S.firstRevenge; S.firstRevenge = true;
  log(S, 'revenge', `${a.name} мстит за ${a.feud.rel} ${a.feud.v}: ${how.charAt(0).toLowerCase() + how.slice(1)}`, a.x, a.y, (S._g.get(a.group) || {}).hue || 0, { first, why: `${yrs(Math.max(1, Math.round((S.tick - a.feud.t) / 360)))} назад «${a.feud.gname}» убили ${a.feud.rel === 'мать' ? 'мать' : a.feud.rel === 'жену' ? 'жену' : a.feud.rel === 'сестру' ? 'сестру' : a.feud.rel === 'мужа' ? 'мужа' : a.feud.rel === 'брата' ? 'брата' : 'отца'} ${a.name}. С тех пор ${a.sex === 'f' ? 'она' : 'он'} ждал${a.sex === 'f' ? 'а' : ''} своего часа.`, who: [a.id] });
}
function fatesMonth(S) {
  for (const g of S.groups) {
    if (!g.home || g.dead) continue;
    const L = S._a.get(g.leader); if (!L) continue;
    // feud pressure on group relations
    for (const id of g.members) {
      const m = S._a.get(id); if (!m || !m.feud || m.feud.done) continue;
      const T = S._g.get(m.feud.g); if (m.feud.personal && !S._a.has(m.feud.L)) { m.feud.done = S.tick; continue; }
      if (!T || T.dead) { if (S.tick - m.feud.t > 360 * 3 && !m.feud.done) { m.feud.done = S.tick; bio(S, m, 'feud', `Обидчики из «${m.feud.gname}» сошли со сцены, и месть остаётся неисполненной`); } continue; }
      const k = key(g.id, T.id), w = m === L ? 0.035 : 0.004 * Math.min(3, 0.5 + m.status / 6);
      if (T !== g && !allied(S, g.id, T.id)) S.hostility[k] = Math.min(2, (S.hostility[k] || 0) + w);
      // killer's leader lives in this very village: blood for blood
      const KL = S._a.get(m.feud.L);
      if (KL && KL.group === g.id && KL !== m && m.ambition > 0.4 && m.age > 17 && rnd(S) < (m.feud.personal ? 0.02 : 0.012)) {
        const wasL = KL === L;
        bio(S, KL, 'death', `${KL.sex === 'f' ? 'Убита' : 'Убит'}: ${m.name} мстит за ${m.feud.v}`);
        revengeDone(S, m, `Убивает ${KL.name}${wasL ? `, вождя «${g.name}»` : ''}`);
        bio(S, m, 'murder', `Своими руками убивает ${KL.name}`);
        S.stats.murders = (S.stats.murders || 0) + 1;
        for (const o of kinOf(S, KL)) if (!o.feud || o.feud.done) { o.feud = { g: g.id, gname: g.name, L: m.id, Lname: m.name, t: S.tick, v: KL.name, rel: o.mother === KL.id || o.father === KL.id ? (KL.sex === 'f' ? 'мать' : 'отца') : 'родича', personal: m.id }; bio(S, o, 'feud', `${m.name} убивает ${KL.name}. ${o.name} клянётся отомстить`); }
        removeAgent(S, KL, 'killed');
        if (g.dead) break;
        if (!wasL && m.group === g.id && L.coop > 0.4 && rnd(S) < 0.6) { leave(S, m, 'move'); m.x += 50; bio(S, m, 'exiled', `За убийство ${m.sex === 'f' ? 'изгнана' : 'изгнан'} из «${g.name}»`); m.exiledFrom = g.id; (m.exiled = m.exiled || {})[g.id] = S.tick; }
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
    if (t) { a.teacher = t.id; a.teacherName = t.name; bump(a, t, 0.25); bump(t, a, 0.15); bio(S, a, 'apprentice', `Учится ремеслу у ${t.name}`); }
  }
}
function elope(S, f, m) {
  const gf = S._g.get(f.group), gm = S._g.get(m.group);
  leave(S, f, 'move'); leave(S, m, 'move');
  f.spouse = m.id; m.spouse = f.id; bump(f, m, 0.6); bump(m, f, 0.6);
  const ng = createGroup(S, m.ambition >= f.ambition ? m : f, [m.ambition >= f.ambition ? f : m]);
  ng.x0 = (f.x + m.x) / 2;
  for (const g of [gf, gm]) if (g && !g.dead) S.hostility[key(g.id, ng.id)] = 0.5;
  const txt = `Бегут вместе: «${gf ? gf.name : '?'}» и «${gm ? gm.name : '?'}» враждуют, свадьбы им не дали`;
  bio(S, f, 'elope', `${txt}. С ${m.name} ${f.sex === 'f' ? 'она' : 'он'} основывает свою семью`); bio(S, m, 'elope', `${txt}. С ${f.name} основывает свою семью`);
  S.stats.elopes = (S.stats.elopes || 0) + 1;
  log(S, 'elope', `${f.name} из «${gf ? gf.name : '?'}» и ${m.name} из «${gm ? gm.name : '?'}» бегут вместе и уходят жить своим домом`, (f.x + m.x) / 2, (f.y + m.y) / 2, ng.hue, { first: !S.firstElope, why: sent([`деревни враждуют: вражда ${P0(Math.min(1, S.hostility[key(gf ? gf.id : 0, gm ? gm.id : 0)] || 0))}`, 'вожди не отдают своих людей за врагов', `${f.name} и ${m.name} доверяют друг другу больше, чем своим деревням`]), who: [f.id, m.id], gs: [ng.id] });
  S.firstElope = true;
}

