const OBSERVED_DAY_MS = 16000;
const dayClock = $('dayClock'), nightShade = $('nightShade');
let dailyRoutes = new Map();
const campfires = new Map();
let dayWatch = false, dailyNight = 0, routineWorld, dayRemainder = 0;

function advanceObservedClock(dt) {
  const elapsed = dayRemainder + dt * SIM.DAY_MINUTES / OBSERVED_DAY_MS;
  const minutes = Math.floor(elapsed);
  dayRemainder = elapsed - minutes;
  if (S.minute + minutes < SIM.DAY_MINUTES) {
    S.minute += minutes;
    return false;
  }
  S.minute = SIM.DAY_MINUTES - 1;
  return true;
}

function clockTime(minute) {
  return String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
}

function requestDailyView() {
  routineWorld = S;
  dailyRoutes.clear();
  campfires.clear();
  const opening = S;
  mainRunner.forecast(plans => {
    if (opening !== S || !dayWatch || !plans) {
      if (routineWorld === opening) routineWorld = null;
      return;
    }
    dailyRoutes = plans;
    for (const a of S.agents) {
      const plan = plans.get(a.id);
      if (plan && !plan.home && plan.leave !== null && a.group) campfires.set(a.group, plan.origin);
    }
    card();
  });
}

function updateDailyView() {
  const hour = dayWatch ? S.minute / 60 : 12;
  const light = dayWatch ? SIM.daylightHours(S.tick) : null;
  dailyNight = 0;
  if (light) {
    const untilDawn = light.sunrise - hour;
    const sinceDusk = hour - light.sunset;
    dailyNight = Math.max(0, Math.min(1, Math.max(untilDawn, sinceDusk) + 0.5));
    const name = hour < light.sunrise - 0.75 || hour >= light.sunset + 0.75 ? 'Ночь'
      : hour < light.sunrise + 2 ? 'Утро' : hour >= light.sunset - 2 ? 'Вечер' : 'День';
    const label = `${clockTime(S.minute)} · ${name}`;
    if (dayClock.textContent !== label) dayClock.textContent = label;
  }
  if (dayClock.hidden === dayWatch) dayClock.hidden = !dayWatch;
  const dark = dailyNight > 0;
  if (nightShade.hidden === dark) nightShade.hidden = !dark;
  if (dailyNight) nightShade.style.opacity = dailyNight * 0.48;
  if (dayWatch && S !== routineWorld) requestDailyView();
  if (D.size > S.agents.length) for (const id of D.keys()) if (!S._a.has(id)) D.delete(id);
  for (const a of S.agents) {
    let p = D.get(a.id);
    if (!p) { p = { x: a.x, y: a.y }; D.set(a.id, p); }
    const route = light && dailyRoutes.get(a.id);
    if (route) SIM.routinePosition(route, S.minute, p);
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
