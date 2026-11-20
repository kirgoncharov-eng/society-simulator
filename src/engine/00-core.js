const SYL = ['ар','вен','ли','мир','та','ро','эл','ка','дан','ис','ор','ну','са','вел','ин','то','ри','ла','мэ','зор','ан','ви','лей','дар','ми','ту','ре','ол','фа','ям','бо','се','ха','ют'];
const T_EG = ['Круг','Община','Братство','Артель','Совет'];
const T_HI = ['Дом','Орден','Престол','Дело','Синдикат'];
// model version: bump on any change that alters how worlds unfold (the page shows it, cached atlases are dropped)
const MODEL = { v: 'm17', date: '2026-11-20', note: 'личные связи с памятью: друзья, побратимы, соперники, враги, должники, учителя; у вражды есть имя и причина, она переходит к детям' };
const SEASON = ['зима','весна','лето','осень'];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function rnd(S) {
  let t = (S.rng = (S.rng + 0x6D2B79F5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const gauss = S => (rnd(S) + rnd(S) + rnd(S) - 1.5) / 1.5;
const pick = (S, arr) => arr[Math.floor(rnd(S) * arr.length)];
function mkName(S) {
  const s1 = pick(S, SYL); let s2 = pick(S, SYL); if (s2 === s1) s2 = SYL[(SYL.indexOf(s1) + 7) % SYL.length];
  let n = s1 + s2;
  if (rnd(S) < 0.2) n += pick(S, SYL);
  return n[0].toUpperCase() + n.slice(1);
}
const one = n => n % 10 === 1 && n % 100 !== 11;
const cells = d => { const n = Math.max(1, Math.round(d / 20)); return `${n} ${one(n) ? 'клетке' : 'клетках'}`; };
const pl = (n, a, b, c) => one(n) ? a : (n % 10 > 1 && n % 10 < 5 && (n % 100 < 12 || n % 100 > 14)) ? b : c;
const yrs = n => `${n} ${one(n) ? 'год' : (n % 10 > 1 && n % 10 < 5 && (n % 100 < 12 || n % 100 > 14)) ? 'года' : 'лет'}`;
const P0 = v => Math.round(v * 100) + '%';
const avg = (arr, f) => arr.length ? arr.reduce((s, m) => s + f(m), 0) / arr.length : 0;
const sent = parts => { const t = parts.filter(Boolean).join('; '); return t ? t[0].toUpperCase() + t.slice(1) + '.' : ''; };
const key = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const date = t => `г.${Math.floor(t / 360)} · ${SEASON[Math.floor((t % 360) / 90)]}`;

function index(S) {
  S._a = new Map(S.agents.map(a => [a.id, a]));
  S._g = new Map(S.groups.map(g => [g.id, g]));
}
function log(S, type, text, x, y, hue, ex) {
  S.evId = (S.evId || 0) + 1; S.evc = S.evc || {}; S.evc[type] = (S.evc[type] || 0) + 1;
  S.events.unshift(Object.assign({ id: S.evId, t: S.tick, type, text, x, y, hue }, ex || {}));
  if (S.events.length > 250) S.events.length = 250;
  if (x !== undefined) S.flashes.push({ id: S.flashId++, t: S.tick, type, x, y, hue });
  if (S.flashes.length > 60) S.flashes.splice(0, S.flashes.length - 60);
}

