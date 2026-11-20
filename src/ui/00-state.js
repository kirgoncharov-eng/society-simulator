const $ = id => document.getElementById(id);
const cv = $('cv'), plate = $('plate');
let ctx = cv.getContext('2d');
const rv = $('rv'), rctx = rv.getContext('2d'), riverBox = $('river');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let S, speed = 1, playing = true, acc = 0, last = performance.now(), lastUi = 0, sel = null, forkSnap = null, forkLabel = '';
let D = new Map(), F = [], lastFlash = 0, lastEvt = null, seenEv = 0, lastStop = -1e9, lastStopTick = -1e9;
let focusEv = null, view = { x: 500, y: 500, z: 1 }, vt = { x: 500, y: 500, z: 1 }, T = { k: 1, ox: 0, oy: 0 };
let riverKey = '', riverHit = { dots: [], bands: [] };
const C = {};
const CTL = [
  ['scarcity', 'Дефицит ресурсов', 'Как медленно восстанавливаются источники'],
  ['inflow', 'Приток новичков', 'Рождения в группах и пришельцы. Ноль — замкнутый мир'],
  ['synergy', 'Синергия', 'Насколько группа продуктивнее одиночек'],
  ['memory', 'Память', 'Как долго помнят доверие и обиды'],
  ['ambition', 'Амбиции новичков', 'Средняя амбициозность новых агентов']
];
const TL = { boat: 'Лодка', emigr: 'Уплывают', drought: 'Засуха', thirst: 'Жажда', well: 'Колодец', revenge: 'Месть', elope: 'Побег', bridge: 'Мост', drown: 'Утонул', marriage: 'Брачный союз', plague: 'Мор', plagueEnd: 'Мор', abandon: 'Деревня брошена', state: 'Государство', money: 'Деньги', debt: 'Долги', land: 'Земля', gov: 'Правление', border: 'Граница', era: 'Итоги десятилетия', regime: 'Смена строя', faith: 'Вера', law: 'Закон', war: 'Поход', battle: 'Битва', conquest: 'Завоевание', ransom: 'Откуп', aid: 'Помощь', case: 'Суд', rumor: 'Слух', revolt: 'Восстание', raid: 'Грабёж', trade: 'Торговля', route: 'Торговый путь', market: 'Рынок', tech: 'Новшество', settle: 'Поселение', famine: 'Голодная зима', coup: 'Переворот', schism: 'Раскол', crisis: 'Кризис преемственности', merge: 'Слияние', reform: 'Реформа', exodus: 'Исход', conflict: 'Стычка', alliance: 'Союз', break: 'Конец союза', found: 'Новая группа', colony: 'Дочерняя деревня', collapse: 'Распад', succession: 'Смена лидера', milestone: 'Рост иерархии', shock: 'Шок', genesis: 'Начало', fork: 'Развилка' };
const MAJOR = new Set(['drought', 'thirst', 'revenge', 'plague', 'coup', 'schism', 'crisis', 'merge', 'reform', 'exodus', 'famine', 'battle', 'conquest', 'revolt', 'era', 'regime', 'state']);
const isMajor = e => MAJOR.has(e.type) || (e.type === 'conflict' && e.big) || ((e.type === 'boat' || e.type === 'emigr' || e.type === 'well' || e.type === 'elope' || e.type === 'bridge' || e.type === 'drown' || e.type === 'marriage' || e.type === 'settle' || e.type === 'tech' || e.type === 'trade' || e.type === 'faith' || e.type === 'land' || e.type === 'gov' || e.type === 'money' || e.type === 'debt') && e.first);
const KEY = new Set(['state', 'money', 'debt', 'land', 'gov', 'era', 'regime', 'faith', 'law', 'war', 'battle', 'ransom', 'case', 'rumor', 'conquest', 'revolt', 'coup', 'schism', 'crisis', 'merge', 'famine', 'shock', 'genesis', 'fork']);
const isKey = e => KEY.has(e.type) || e.first || isMajor(e);
let logAll = false; const RC = new Map();
const SHORT = { 'Кочевая ватага': 'кочевники', 'Хутор': 'хутор', 'Теократия': 'теократия', 'Держава данников': 'держава', 'Наследственное княжество': 'княжество', 'Родовая община': 'родовая община', 'Купеческая олигархия': 'олигархия купцов', 'Вольная торговая община': 'торговая община', 'Военная деспотия': 'деспотия', 'Воинское братство': 'воинское братство', 'Вождество': 'вождество', 'Община равных': 'община равных', 'Земледельческая община': 'земледельцы', 'Торговая республика': 'торговая республика', 'Вечевая республика': 'вечевая республика', 'Феодальное княжество': 'феодалы', 'Земельная знать': 'земельная знать' };
const JOB = { home: 'сидит у дома, присматривает за детьми и огородом', fish: 'ловит рыбу в море', herd: 'пасёт коз', water: 'носит воду', farm: 'пашет поле', wood: 'рубит лес', build: 'строит', gather: 'собирает и охотится', lead: 'управляет', stone: 'добывает камень', craft: 'ремесленник', trade: 'торгует', guard: 'стоит на страже', war: 'в походе', pray: 'служит в святилище' };
const TITLE = { farm: 'мастер-земледелец', wood: 'мастер-лесоруб', build: 'мастер-строитель', stone: 'каменотёс', craft: 'мастер-ремесленник', gather: 'опытный охотник', trade: 'опытный купец', guard: 'опытный воин' };
const TC = { g: ['#dfe7cc', '#1a2620'], r: ['#cfe0b0', '#1c2b1f'], f: ['#c4d7af', '#16281d'], h: ['#e3ddce', '#25261f'], w: ['#a9cbe0', '#1c3a4e'], s: ['#9cc3dc', '#15303f'], b: ['#ece2c4', '#2c2a22'] };
let terr = document.createElement('canvas'), terrAt = 0, terrKey = '';

function readColors() {
  const probe = document.createElement('span'); document.body.appendChild(probe);
  for (const k of ['bg', 'ink', 'muted', 'plate', 'rule', 'red', 'slate']) { probe.style.color = `var(--${k})`; C[k] = getComputedStyle(probe).color; }
  probe.remove();
  const m = C.bg.match(/\d+/g) || [255, 255, 255];
  C.dark = (+m[0] + +m[1] + +m[2]) / 3 < 128;
  riverKey = '';
}
const hueC = (h, a = 1, dl = 0) => `hsla(${h},62%,${(C.dark ? 62 : 42) + dl}%,${a})`;
const rgba = (c, a) => c.replace('rgb(', 'rgba(').replace(')', `,${a})`);
function typeColor(type, a = 1, hue) {
  if (type === 'plague' || type === 'plagueEnd') return C.dark ? `rgba(170,190,150,${a})` : `rgba(70,90,50,${a})`;
  if (type === 'conflict' || type === 'shock' || type === 'exodus' || type === 'famine' || type === 'market' || type === 'war' || type === 'battle' || type === 'raid' || type === 'border' || type === 'debt') return rgba(C.red, a);
  if (type === 'settle' && hue !== undefined) return hueC(hue, a);
  if (type === 'alliance' || type === 'reform' || type === 'merge' || type === 'tech' || type === 'trade' || type === 'route' || type === 'regime' || type === 'money') return rgba(C.slate, a);
  if (type === 'faith' && hue !== undefined) return hueC(hue, a);
  if (type === 'collapse' || type === 'break' || type === 'genesis' || type === 'fork') return rgba(C.muted, a);
  if (type === 'found' && hue !== undefined) return hueC(hue, a);
  return rgba(C.ink, a);
}

function sizeCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(plate.clientWidth * dpr); cv.height = Math.round(plate.clientHeight * dpr);
  rv.width = Math.round(riverBox.clientWidth * dpr); rv.height = Math.round(riverBox.clientHeight * dpr);
  riverKey = '';
}
new ResizeObserver(sizeCanvas).observe(plate);
new ResizeObserver(sizeCanvas).observe(riverBox);

function world(seed) {
  const params = S ? S.params : undefined;
  S = SIM.newWorld(seed, params);
  resetView();
}
function resetView() {
  D = new Map(); F = []; sel = null; closeFocus(true);
  acc = dayWatch ? dawnFraction() : 0;
  lastFlash = S.flashes.reduce((m, f) => Math.max(m, f.id), 0);
  seenEv = S.evId || 0; lastEvt = null; riverKey = ''; syncCtls(); ui(true);
  $('seedline').textContent = `Мир №${S.seed}. Модель на правилах, без языковых моделей: доверие, обиды, распределение добычи, иерархия по охвату управления, энтропия от размера, уровней, обид и бюрократии.`;
}

