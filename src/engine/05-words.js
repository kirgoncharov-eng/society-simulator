/* ---------- plain words for traits and village indicators (Д6) ---------- */
// One dictionary for the chronicle, the person card, the village panel, the audit and the docs. Each trait or indicator
// has a human name, word levels (from low to high; [male, female] where the form differs), what it is and what it changes
// in the world. Texts use these words instead of percentages: «честолюбив», not «амбиции 62%».
const TRAITS = {
  skill: { name: 'Умелость', levels: [['неумел', 'неумела'], 'работник средней руки', ['толков в работе', 'толкова в работе'], 'мастер на все руки'],
    about: 'Насколько ловко человек работает руками.', affects: 'Сколько он делает за день и как скоро станет мастером.' },
  ambition: { name: 'Властолюбие', levels: ['не ищет власти', 'не прочь подняться', ['честолюбив', 'честолюбива'], 'рвётся к власти'],
    about: 'Тяга к власти и первенству.', affects: 'Метит ли в вожди, поднимает ли переворот и раскол, ведёт ли в поход; став вождём, сколько берёт себе.' },
  coop: { name: 'Уживчивость', levels: [['упрям и задирист', 'упряма и задириста'], ['неуступчив', 'неуступчива'], ['уживчив', 'уживчива'], ['миролюбив, всегда договорится', 'миролюбива, всегда договорится']],
    about: 'Готовность уступать и договариваться.', affects: 'Делится ли в голод, прощает ли долги и измену, берёт ли виру вместо мести, терпит ли вече.' },
  norm: { name: 'Чувство справедливости', levels: ['делить надо по заслугам и положению', 'кто больше значит, тому больше', 'делить надо почти поровну', 'всё делить поровну'],
    about: 'Как, по его мнению, надо делить общий урожай.', affects: 'Какой доли он ждёт (меньше — растёт недовольство), за какой свод правил стоит; деревня понемногу перенимает взгляды вождя.' },
  energy: { name: 'Силы', levels: [['изнурён', 'изнурена'], ['устал', 'устала'], 'в силе', 'полон сил'],
    about: 'Здоровье и силы.', affects: 'Сколько он успевает сделать; падают от голода, ран и тяжёлой работы; изнурённый может умереть.' },
  status: { name: 'Вес в деревне', levels: ['его не замечают', 'простой общинник', 'к его слову прислушиваются', 'из первых людей деревни'],
    about: 'Уважение и влияние: накапливается работой, мастерством, должностью и щедростью.', affects: 'Кто становится кандидатом в вожди, кому достаются поля при разделе, какая доля при дележе «по положению».' },
  res: { name: 'Недовольство вождём', levels: ['доволен', 'ворчит', 'недоволен', 'кипит от обиды'],
    about: 'Обида на то, как делят урожай и как правит вождь.', affects: 'Уйдёт ли он от вождя, поддержит ли переворот или раскол, потребует ли вече.' },
  rep: { name: 'Слава', levels: ['дурная слава', 'о нём шепчутся', 'обычная слава', 'добрая слава'],
    about: 'Что о человеке говорят соседи.', affects: 'Голоса на выборах, выбор жениха, изгнание из деревни.' }
};
const VILLAGE = {
  entropy: { name: 'Неурядица', levels: ['дела решаются легко', 'дела решаются туго', 'неурядица: спорят и тянут', 'всё вязнет в спорах'],
    about: 'Как трудно деревне договориться и наладить общую работу. Растёт с числом людей и ступеней власти, с недовольством, партиями и волокитой.', affects: 'Совместная работа даёт меньше и сильнее утомляет; при большой неурядице вождь наводит порядок, деревня записывает свод правил или отпочковывается.' },
  legit: { name: 'Признание власти', levels: ['власть шаткая', 'власть терпят', 'власть признана', 'власть крепка'],
    about: 'Насколько деревня признаёт право вождя править.', affects: 'Устоит ли вождь перед переворотом, восстанут ли данники.' },
  take: { name: 'Доля вождя', levels: ['скромная', 'заметная', 'тяжёлая', 'непосильная'], cut: [0.12, 0.25, 0.4],
    about: 'Какую часть общего урожая вождь берёт себе.', affects: 'Недовольство, слава вождя; в голод — «хлеб голодных».' },
  norm: { name: 'Обычай дележа', levels: ['делят по положению', 'больше тем, кто значит', 'почти поровну', 'всё поровну'],
    about: 'Как в деревне принято делить общий урожай.', affects: 'Кому сколько достаётся; при обычае «по положению» деревня скорее делит поля в собственность.' },
  room: { name: 'Свободная земля', levels: ['тесно', 'земли мало', 'земля есть', 'простор'],
    about: 'Сколько вокруг пригодной незанятой земли.', affects: 'Можно ли уйти от вождя, растёт ли деревня, подчиняют ли побеждённых (уйти некуда — подчиняются).' },
  bureau: { name: 'Волокита', levels: ['нет', 'немного', 'заметная', 'большая'], cut: [3, 10, 25],
    about: 'Накопленная с годами путаница в делах.', affects: 'Добавляет неурядицы; вождь, наводя порядок, её срезает.' }
};
// the level of a value 0..1 (or by the indicator's own cuts); a for the gendered form
function lvlIdx(def, v) { const c = def.cut || [0.25, 0.5, 0.75]; let i = 0; while (i < c.length && v >= c[i]) i++; return i; }
function word(kind, v, a, village) {
  const def = (village ? VILLAGE : TRAITS)[kind]; if (!def) return '';
  let w = def.levels[lvlIdx(def, v)];
  if (Array.isArray(w)) w = a && a.sex === 'f' ? w[1] : w[0];
  return w;
}
// status grows without a cap: squeeze it to 0..1 for the words
const statusLvl = a => a.status / (a.status + 10);
const repLvl = a => ((a.rep || 0) + 1) / 2;
// trust and enmity between people and villages, in words
function trustWord(v) { return v > 0.6 ? 'верят друг другу как себе' : v > 0.3 ? 'крепко доверяют друг другу' : v > 0.1 ? 'доверяют друг другу' : v > -0.1 ? 'присматриваются друг к другу' : 'не доверяют друг другу'; }
function hostWord(h) { return h > 1.2 ? 'лютая вражда' : h > 0.8 ? 'вражда' : h > 0.4 ? 'неприязнь' : 'холодок'; }
// how many steps of power stand between the leader and the rank and file
function stepsWord(depth) { return depth <= 1 ? 'вождь правит сам' : depth === 2 ? 'у вождя есть помощники' : depth === 3 ? 'у помощников вождя свои помощники' : `власть идёт через ${depth} ${pl(depth, 'ступень', 'ступени', 'ступеней')}`; }

/* ---------- character changes with life (Д6; MISSION: «потери и удачи меняют характер и планы») ---------- */
// A turn of fate nudges a trait. When the nudge changes the word for it, the chronicle says so, pointing to the same event.
const TEMPER = {
  betrayed: ['coop', -0.1, 'после предательства'], jealousy: ['coop', -0.06, 'после измены'], exiled: ['coop', -0.08, 'после изгнания'],
  deposed: ['ambition', -0.12, 'после свержения'], lawLost: ['coop', -0.04, 'проиграв на сходе'], revenge: ['coop', -0.05, 'отомстив'],
  leader: ['ambition', 0.08, 'став вождём'], heir: ['ambition', 0.06, 'получив власть по наследству'], coup: ['ambition', 0.06, 'захватив власть'], found: ['ambition', 0.05, 'основав свою деревню'],
  battleW: ['ambition', 0.03, 'после победы'], wergild: ['coop', 0.06, 'взяв виру вместо крови'], reconcile: ['coop', 0.06, 'помирившись'],
  tyranny: ['norm', 0.08, 'после голодной зимы'], fedByLeader: ['norm', 0.05, 'накормленный в голод'], aidReceived: ['norm', 0.04, 'получив зерно в голод'],
  spouseDied: ['ambition', -0.04, 'овдовев']
};
const TEMPER_VERB = {
  coop: [['ожесточается', 'ожесточается'], ['становится уживчивее', 'становится уживчивее']],
  ambition: [['остывает к власти', 'остывает к власти'], ['входит во вкус власти', 'входит во вкус власти']],
  norm: [['начинает думать, что делить надо по заслугам', 'начинает думать, что делить надо по заслугам'], ['начинает думать, что делить надо поровну', 'начинает думать, что делить надо поровну']]
};
function temper(S, a, k, ref) {
  const t = TEMPER[k]; if (!t || !a || a.age < 16) return;
  const [trait, d, when] = t, before = lvlIdx(TRAITS[trait], a[trait]);
  a[trait] = clamp(a[trait] + d, 0, 1);
  if (lvlIdx(TRAITS[trait], a[trait]) === before) return;
  // the chronicle notes a trait at most once in three years: the change itself always happens
  const tt = a.tempT || (a.tempT = {}); if (S.tick - (tt[trait] || -1e9) < 360 * 3) return; tt[trait] = S.tick;
  const lv = lvlIdx(TRAITS[trait], a[trait]);
  // a milder word for a small step down: «становится жёстче: теперь уживчив», «ожесточается: теперь неуступчив»
  const verb = trait === 'coop' && d < 0 && lv >= 2 ? 'становится жёстче' : TEMPER_VERB[trait][d > 0 ? 1 : 0][a.sex === 'f' ? 1 : 0];
  const lead = when.charAt(0).toUpperCase() + when.slice(1) + (when.startsWith('после') ? '' : ',');
  S.stats.tempers = (S.stats.tempers || 0) + 1;
  bio(S, a, 'temper', `${lead} ${verb}: теперь ${word(trait, a[trait], a)}`, ref);
}
// with age the hunger for power cools: once, past fifty-five
function ageTemper(S, a) {
  if (a.age < 55 || a.agedT) return;
  a.agedT = S.tick; const before = lvlIdx(TRAITS.ambition, a.ambition);
  a.ambition = clamp(a.ambition - 0.12, 0, 1);
  if (lvlIdx(TRAITS.ambition, a.ambition) !== before) bio(S, a, 'temper', `С годами остывает к власти: теперь ${word('ambition', a.ambition, a)}`);
}

/* ---------- why a person is unhappy with the leader: the reasons, each with its event where there is one ---------- */
function resWhy(S, a) {
  const g = a.group && S._g.get(a.group), L = g && S._a.get(g.leader), out = [];
  if (!g || !L || L === a) return out;
  if (g.take > 0.18) out.push([`вождь забирает себе ${P0(g.take)} общего урожая`]);
  if (a.norm > 0.6 && g.norm < 0.45) out.push([`здесь делят по положению, а ${fem(a, 'он', 'она')} считает, что делить надо поровну`]);
  else if (a.norm < 0.4 && g.norm > 0.6) out.push([`здесь делят поровну, а ${fem(a, 'он', 'она')} считает, что по заслугам`]);
  if (g.tyr && g.tyr.L === L.id && S.tick - g.tyr.t < 360 * 10) out.push([`в голод ${L.name} не уменьшил${fem(L, '', 'а')} своей доли`, g.tyr.ev]);
  if (g.lord && S._g.get(g.lord)) out.push([`деревня платит дань «${S._g.get(g.lord).name}»`]);
  if (g.lostT && S.tick - g.lostT < 360 * 3) out.push(['деревня недавно проиграла войну', g.lostEv]);
  if (g.home && !a.shel) out.push(['живёт без крыши']);
  if (a.bond) out.push([`в кабале за долги`]);
  if (g.land === 'private' && !g.fields.some(f => f.owner === a.id)) out.push(['своего поля нет, батрачит на чужом']);
  const b = a.bonds && a.bonds[L.id]; if (b && (b[0] === 'enemy' || b[0] === 'rival')) out.push([`с вождём ${b[0] === 'enemy' ? 'вражда' : 'соперничество'}: ${b[3]}`, b[5]]);
  return out.slice(0, 4);
}
