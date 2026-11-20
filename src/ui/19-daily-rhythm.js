const OBSERVED_DAY_MS = 16000;
const dayClock = $('dayClock'), nightShade = $('nightShade');
const dailyRoutes = new Map(), campfires = new Map();
let dayWatch = false, dailyNight = 0, routineWorld, routineTick;

function dawnFraction() {
  return (SIM.daylightHours(S.tick).sunrise - 0.75) / 24;
}

function updateDailyView() {
  const hour = dayWatch ? 24 * acc : 12;
  const light = dayWatch ? SIM.daylightHours(S.tick) : null;
  dailyNight = 0;
  if (light) {
    const untilDawn = light.sunrise - hour;
    const sinceDusk = hour - light.sunset;
    dailyNight = Math.max(0, Math.min(1, Math.max(untilDawn, sinceDusk) + 0.5));
    const minutes = Math.floor(hour * 60 / 5) * 5;
    const time = String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
    const name = hour < light.sunrise - 0.75 || hour >= light.sunset + 0.75 ? 'Ночь'
      : hour < light.sunrise + 2 ? 'Утро' : hour >= light.sunset - 2 ? 'Вечер' : 'День';
    const label = `${time} · ${name}`;
    if (dayClock.textContent !== label) dayClock.textContent = label;
  }
  if (dayClock.hidden === dayWatch) dayClock.hidden = !dayWatch;
  const dark = dailyNight > 0;
  if (nightShade.hidden === dark) nightShade.hidden = !dark;
  if (dailyNight) nightShade.style.opacity = dailyNight * 0.48;
  if (S !== routineWorld || S.tick !== routineTick) {
    dailyRoutes.clear();
    campfires.clear();
    routineWorld = S;
    routineTick = S.tick;
  }
  if (D.size > S.agents.length) for (const id of D.keys()) if (!S._a.has(id)) D.delete(id);
  for (const a of S.agents) {
    let p = D.get(a.id);
    if (!p) { p = { x: a.x, y: a.y }; D.set(a.id, p); }
    let route = null;
    if (light) {
      if (!dailyRoutes.has(a.id)) {
        const plan = SIM.dailyRoutine(S, a);
        dailyRoutes.set(a.id, plan);
        if (plan && !plan.home) campfires.set(a.group, plan.route[0]);
      }
      route = dailyRoutes.get(a.id);
    }
    if (route) SIM.routinePosition(route, hour, light, p);
    else {
      const ease = dayWatch ? 1 : .25;
      p.x += (a.x - p.x) * ease;
      p.y += (a.y - p.y) * ease;
    }
  }
}

function drawCampfires(px) {
  if (!dailyNight) return;
  for (const { x, y } of campfires.values()) {
    ctx.fillStyle = `rgba(243,140,48,${0.36 * dailyNight})`;
    ctx.beginPath(); ctx.arc(x, y, px(8), 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(255,207,125,${dailyNight})`;
    ctx.beginPath(); ctx.arc(x, y, px(2), 0, 7); ctx.fill();
  }
}
