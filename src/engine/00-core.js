const SYL = ['ар','вен','ли','мир','та','ро','эл','ка','дан','ис','ор','ну','са','вел','ин','то','ри','ла','мэ','зор','ан','ви','лей','дар','ми','ту','ре','ол','фа','ям','бо','се','ха','ют'];
const T_EG = ['Круг','Община','Братство','Артель','Совет'];
const T_HI = ['Дом','Орден','Престол','Дело','Синдикат'];
// model version: bump on any change that alters how worlds unfold (the page shows it, cached atlases are dropped)
const MODEL = { v: 'm22', date: '2026-11-21', note: 'стройплощадки с доставкой и этапами, частокол по отдельным участкам' };
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
// ex.causes: ids of the events that led to this one (a linked chronicle); returns the event
function log(S, type, text, x, y, hue, ex) {
  S.evId = (S.evId || 0) + 1; S.evc = S.evc || {}; S.evc[type] = (S.evc[type] || 0) + 1;
  const ev = Object.assign({ id: S.evId, t: S.tick, type, text, x, y, hue }, ex || {});
  S.events.unshift(ev);
  if (S.events.length > 250) S.events.length = 250;
  if (ev.causes) for (const c of ev.causes) cite(S, c);
  if (x !== undefined) S.flashes.push({ id: S.flashId++, t: S.tick, type, x, y, hue });
  if (S.flashes.length > 60) S.flashes.splice(0, S.flashes.length - 60);
  return ev;
}


/* ---------- linked chronicle: events that something refers to outlive the 250-entry feed ---------- */
// a quiet event: it gets an id and can be cited, but does not appear in the feed (small, frequent deeds)
function note(S, type, text, x, y, hue, ex) {
  S.evId = (S.evId || 0) + 1;
  const ev = Object.assign({ id: S.evId, t: S.tick, type, text, x, y, hue, quiet: true }, ex || {});
  (S.evArch || (S.evArch = {}))[ev.id] = ev;
  return ev;
}
function eventById(S, id) {
  if (!id) return null;
  for (const e of S.events) if (e.id === id) return e;
  return (S.evArch && S.evArch[id]) || null;
}
// someone now refers to event id: keep it in the archive even after it falls out of the feed
function cite(S, id) {
  if (!id) return id;
  const A = S.evArch || (S.evArch = {});
  if (!A[id]) { const e = eventById(S, id); if (e) A[id] = e; }
  return id;
}
// once a year: drop archived events nobody refers to any more (people, ties, legends, other events)
function archiveGC(S) {
  const A = S.evArch; if (!A) return;
  const keep = new Set(), refs = b => { for (const x of b || []) if (x[3]) keep.add(x[3]); };
  for (const a of S.agents) {
    refs(a.bio);
    for (const m of a.grainMemories || []) if (m.ev) keep.add(m.ev);
    if (a.feud && a.feud.ev && !a.feud.done) keep.add(a.feud.ev);
    for (const id in a.bonds || {}) if (a.bonds[id][5]) keep.add(a.bonds[id][5]);
  }
  for (const l of S.legends || []) refs(l.bio);
  for (const id of S.secrets || []) keep.add(id);
  for (const g of S.groups) {
    for (const k in g.customEv || {}) keep.add(g.customEv[k]);
    for (const h of g.houses) if (h.deathEv) keep.add(h.deathEv);
  }
  for (const e of S.events) for (const c of e.causes || []) keep.add(c);
  const stack = [...keep];
  while (stack.length) { const e = A[stack.pop()]; for (const c of (e && e.causes) || []) if (!keep.has(c)) { keep.add(c); stack.push(c); } }
  for (const id in A) if (!keep.has(+id)) delete A[id];
}
