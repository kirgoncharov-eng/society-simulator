const MODE_DAY_MS = { scene: 600000, days: 1000, years: 30000 / 360, centuries: 1500 / 360 };
const WALK_LIMIT_PX = 18;
const dayClock = $('dayClock'), nightShade = $('nightShade');
const campfires = new Map(), markedFlashes = new Set();
const clockNow = () => S.tick * SIM.DAY_MINUTES + S.minute;
let viewMode = 'years', effectiveMode = viewMode, clockCredit = 0;
let routineWorld, routineTick, projection, dailyRoutes = new Map();
let dailyNight = 0, dayWatch = false, directed, ignoredDirection, followVillage = null;
let chronicle, flashFloor = 0;

function clockTime(minute) {
  return String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
}

function eventDate(event) {
  const time = SIM.eventTime(event);
  return SIM.date(Math.floor(time / SIM.DAY_MINUTES)) +
    (Number.isInteger(event.minute) ? ' · ' + clockTime(time % SIM.DAY_MINUTES) : '');
}

function visibleEvents() {
  const time = clockNow();
  const today = projection?.events || [];
  const shown = today.filter(e => SIM.eventTime(e) <= time);
  if (chronicle?.world === S && chronicle.tick === S.tick && chronicle.id === S.evId &&
      chronicle.projection === projection && chronicle.shown === shown.length) return chronicle.events;
  const events = new Map();
  for (const e of S.events) if (SIM.eventTime(e) <= time) events.set(e.id, e);
  for (const e of shown) events.set(e.id, e);
  const ordered = [...events.values()].sort((a, b) => SIM.eventTime(b) - SIM.eventTime(a) || b.id - a.id);
  chronicle = { world: S, tick: S.tick, id: S.evId, projection, shown: shown.length, events: ordered };
  return ordered;
}

function visibleEvent(id) {
  const event = SIM.eventById(S, id) || projection?.events.find(e => e.id === id);
  return event && SIM.eventTime(event) <= clockNow() ? event : null;
}

function addFlashes(entries, now) {
  for (const entry of entries) {
    const time = SIM.eventTime(entry);
    if (time <= flashFloor || time > clockNow() || markedFlashes.has(entry.id)) continue;
    markedFlashes.add(entry.id);
    if (entry.x != null) F.push({ ...entry, born: now });
  }
  if (markedFlashes.size > 512) {
    for (const id of markedFlashes) {
      markedFlashes.delete(id);
      if (markedFlashes.size <= 256) break;
    }
  }
  F = F.filter(f => now - f.born < 1400).slice(-40);
}

function resetPlayback() {
  routineWorld = undefined;
  projection = chronicle = directed = ignoredDirection = null;
  dailyRoutes = new Map();
  campfires.clear();
  markedFlashes.clear();
  flashFloor = clockNow();
  clockCredit = 0;
}

function watchTarget() {
  if (!follow || !$('director').checked) return null;
  const time = clockNow(), ignored = ignoredDirection;
  if (followVillage != null && S._g.has(followVillage)) return { village: followVillage, time, ignored };
  return S._a.has(sel) ? { person: sel, time, ignored } : null;
}

function followedPlace() {
  if (!follow) return null;
  return S._g.get(followVillage)?.home || D.get(sel);
}

function considerDirection(event) {
  if (!event || directed || !watchedEvent(event, watchTarget())) return;
  const time = SIM.eventTime(event);
  const dawn = Math.floor(time / SIM.DAY_MINUTES) * SIM.DAY_MINUTES;
  directed = { event, days: Math.max(dawn, time - 120), scene: Math.max(dawn, time - 30),
    end: time + 30, camera: false };
}

function directionTime(target) {
  if (!directed) return target;
  const now = clockNow();
  for (const mark of [directed.days, directed.scene, directed.end]) {
    if (now < mark && mark <= target) return mark;
  }
  return target;
}

function directedCamera() { return !!directed?.camera; }

function syncMode() {
  if (directed && (!watchTarget() || clockNow() >= directed.end)) directed = null;
  let mode = viewMode;
  if (directed && clockNow() >= directed.days) {
    if (clockNow() >= directed.scene) {
      mode = 'scene';
      if (!directed.camera) {
        directed.camera = true;
        const { x, y } = directed.event;
        if (x != null && y != null) {
          const z = Math.max(2.2, vt.z);
          vt = { x, y, z };
          fly3D(x, y);
        }
      }
    } else if (MODE_DAY_MS[mode] < MODE_DAY_MS.days) mode = 'days';
  }
  if (mode !== effectiveMode) {
    effectiveMode = mode;
    clockCredit = 0;
    if (!reduce) plate.animate([{ opacity: 0.67 }, { opacity: 1 }], { duration: 600, easing: 'ease-out' });
  }
  dayWatch = mode === 'scene';
  plate.dataset.mode = mode;
  const hint = $('directorMode');
  const label = directed && clockNow() >= directed.days ? (dayWatch ? 'Режиссёр · Сцена' : 'Режиссёр · Дни') : '';
  if (hint.textContent !== label) hint.textContent = label;
}

function requestDailyView() {
  routineWorld = S;
  routineTick = S.tick;
  projection = null;
  dailyRoutes = new Map();
  campfires.clear();
  const opening = S, tick = S.tick;
  mainRunner.forecast(result => {
    if (opening !== S || tick !== S.tick || !result) {
      if (routineWorld === opening && routineTick === tick) routineWorld = null;
      return;
    }
    projection = result;
    dailyRoutes = result.plans;
    for (const a of S.agents) {
      const plan = dailyRoutes.get(a.id);
      if (plan && !plan.home && plan.leave !== null && a.group) campfires.set(a.group, plan.origin);
    }
    considerDirection(result.events.find(e => watchedEvent(e, watchTarget())));
    card();
  });
}

function hasDailyView() { return routineWorld === S && routineTick === S.tick && !!projection; }

function advanceViewClock(dt) {
  syncMode();
  if (!playing) return;
  const time = clockNow();
  clockCredit = Math.min(30 * SIM.DAY_MINUTES, clockCredit + dt * SIM.DAY_MINUTES / MODE_DAY_MS[effectiveMode]);
  if (mainRunner.busy) return;
  const target = directionTime(time + Math.floor(clockCredit));
  if (target <= time) return;
  const targetDay = Math.floor(target / SIM.DAY_MINUTES);
  if (targetDay === S.tick) {
    if (!hasDailyView()) return;
    S.minute = target % SIM.DAY_MINUTES;
    clockCredit = Math.max(0, clockCredit - (target - time));
    syncMode();
    return;
  }

  // Keep the stop-frame checkpoints while fast modes calculate in batches.
  const days = Math.min(targetDay - S.tick, 30 - S.tick % 30);
  const startDay = S.tick, minute = S.minute;
  mainRunner.advance(days, (completed, result) => {
    if (!completed) return;
    routineWorld = null;
    projection = null;
    if (startDay === S.tick) S.minute = minute;
    clockCredit = Math.max(0, clockCredit - (clockNow() - time));
    considerDirection(result?.event);
    addFlashes(result?.flashes || [], performance.now());
    if (S.tick !== startDay) dayAdvanced(true);
  }, { watch: directed ? null : watchTarget() });
}

function routePixels(a) {
  if (V3.on && V3.ready) {
    const eye = V3.cam.position;
    const distance = Math.max(1, Math.hypot(a.x - eye.x, eye.y, a.y - eye.z));
    return plate.clientHeight / (2 * distance * Math.tan(V3.cam.fov * Math.PI / 360));
  }
  return Math.min(plate.clientWidth, plate.clientHeight) * view.z / 1000;
}

function drawAgentPosition(a, plan, p) {
  if (!plan) { p.x = a.x; p.y = a.y; return; }
  const travelling = plan.kind === 'caravan' || plan.kind === 'war' || plan.kind === 'relocation' || plan.kind === 'escape';
  const leg = S.minute >= (plan.leave ?? Infinity) ? plan.finish - plan.leave : plan.arrive - plan.depart;
  const pixelsPerSecond = plan.distance * routePixels(a) * (SIM.DAY_MINUTES * 1000 / MODE_DAY_MS[effectiveMode]) / Math.max(1, leg);
  if ((dayWatch || effectiveMode === 'days' && travelling) && plan.route && pixelsPerSecond <= WALK_LIMIT_PX) {
    SIM.routinePosition(plan, S.minute, p);
  } else {
    const at = dayWatch && (S.minute < plan.arrive || (plan.leave !== null && S.minute >= plan.finish))
      ? plan.origin : plan.destination;
    p.x = at.x;
    p.y = at.y;
  }
}

function updateDailyView(now) {
  if (!mainRunner.busy && (routineWorld !== S || routineTick !== S.tick)) requestDailyView();
  const hour = dayWatch ? S.minute / 60 : 12;
  const light = SIM.daylightHours(S.tick);
  dailyNight = Math.max(0, Math.min(1, Math.max(light.sunrise - hour, hour - light.sunset) + 0.5));
  const name = hour < light.sunrise - 0.75 || hour >= light.sunset + 0.75 ? 'Ночь'
    : hour < light.sunrise + 2 ? 'Утро' : hour >= light.sunset - 2 ? 'Вечер' : 'День';
  const label = dayWatch ? `${clockTime(S.minute)} · ${name}` : '';
  if (dayClock.textContent !== label) dayClock.textContent = label;
  dayClock.hidden = !dayWatch;
  nightShade.hidden = dailyNight <= 0;
  nightShade.style.opacity = dailyNight * 0.48;
  if (D.size > S.agents.length) for (const id of D.keys()) if (!S._a.has(id)) D.delete(id);
  for (const a of S.agents) {
    let p = D.get(a.id);
    if (!p) { p = { x: a.x, y: a.y }; D.set(a.id, p); }
    const plan = (dayWatch || effectiveMode === 'days') && hasDailyView() && dailyRoutes.get(a.id);
    if (effectiveMode === 'years') {
      const village = S._g.get(a.group), house = a.house && village?.houses.find(h => h.id === a.house && !h.ruined);
      const here = house || village?.home || a;
      p.x = here.x; p.y = here.y;
    } else drawAgentPosition(a, plan, p);
  }
  addFlashes(S.flashes, now);
  if (projection) addFlashes(projection.flashes, now);
  if (visibleEvents()[0]?.id !== lastEvt) updateChronicle();
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
