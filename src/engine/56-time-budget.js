/* ---------- the family's time budget (Ч2): how many hours a day are left for work ---------- */
// Work hours = daylight − the walk to work and back (from the day plan, Ч1) − care of small children ± Chayanov's balance.
// Chayanov (1925): a peasant family works until the drudgery of more work outweighs the need it meets; where a worker
// feeds many mouths, or the house goes hungry, people work longer; where they are fed and few, they stop earlier.
// Johnson (1975, the Machiguenga) and later time-allocation studies: work, travel, childcare and the rest share one day.
// Output and fatigue follow the hours. Water is not counted here: the village's water carriers already carry it, and a
// well frees them for the fields (50-water.js).
const WORK_REF = 10.5; // the hours of an average working day over the year: at these hours output is what it was before Ч2
const hm = h => { const m = Math.round(h * 60), H = Math.floor(m / 60), M = m % 60; return H && M ? `${H} ч ${M} мин` : H ? `${H} ч` : `${M} мин`; };
// mouths and hands per house, for the village, once a day
function householdLoad(S, g) {
  const byHouse = new Map(), get = id => { let x = byHouse.get(id); if (!x) byHouse.set(id, x = { hands: 0, mouths: 0, food: 0, infants: new Set(), small: new Set() }); return x; };
  for (const id of g.members) { const a = S._agentsById[id]; if (!a || !a.house) continue; const x = get(a.house); x.mouths++; x.food += Math.max(0, a.wealth); if (a.age < 60) x.hands++; }
  for (const k of S.kids || []) {
    const mo = k.mo && S._agentsById[k.mo]; if (!mo || mo.group !== g.id || !mo.house) continue;
    const x = get(mo.house), age = (S.tick - k.t) / 360; x.mouths += age < 5 ? 0.4 : 0.7;
    if (age < 2) x.infants.add(mo.id); else if (age < 6) x.small.add(mo.id);
  }
  return byHouse;
}
// the day of one adult: the parts of the budget, the hours left for work and the factor for output and fatigue
function dayBudget(S, g, a, light, homes) {
  const day = light.sunset - light.sunrise, road = (a.commute || 0) / 60;
  const h = a.house && homes.get(a.house);
  // a mother of an infant gives it two and a half hours of the light, of a small child an hour
  const kids = h ? (h.infants.has(a.id) ? 2.5 : h.small.has(a.id) ? 1 : 0) : 0;
  let extra = 0;
  if (h && h.hands) {
    const ratio = h.mouths / h.hands, perMouth = h.food / Math.max(1, h.mouths);
    const need = clamp((ratio - 1.2) / 1.5 + (perMouth < 1 ? 0.4 : 0), 0, 1);
    extra = 2 * need - (need < 0.2 && perMouth > 6 ? 1 : 0);
  }
  // the drudgery of work (Chayanov): the worn out rest; below half their strength people work less, not themselves to death
  const tired = a.energy < 0.5 ? a.energy / 0.5 : 1;
  const work = clamp((day - road - kids + extra) * tired, 0, day - road);
  return { day, road, kids, extra, tired, work, f: work / WORK_REF };
}
// the day in words, for the person card: «Сегодня светло 9 ч: дорога 1 ч 20 мин, ребёнок 2 ч 30 мин; на работу 5 ч 10 мин»
function dayWords(a) {
  const b = a._day; if (!b) return '';
  const parts = [b.road >= 1 / 60 ? `дорога ${hm(b.road)}` : '', b.kids ? `${b.kids >= 2 ? 'младенец' : 'малый ребёнок'} ${hm(b.kids)}` : '', b.extra > 0.2 ? `ради семьи сверх обычного ${hm(b.extra)}` : b.extra < -0.2 ? `сыты и рано заканчивают: на ${hm(-b.extra)} меньше` : '', b.tired < 0.95 ? 'выбился из сил и отдыхает' : ''].filter(Boolean);
  return `Сегодня светло ${hm(b.day)}${parts.length ? `: ${parts.join(', ')}` : ''}; на работу ${hm(b.work)}${b.f < 0.6 ? ' — меньше, чем у соседей' : b.f > 1.25 ? ' — долгий день' : ''}.`;
}
