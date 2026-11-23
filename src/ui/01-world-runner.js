// A single-file page can use the same engine in its workers, including when opened from disk.
function engineSource() { return $('sim-source').textContent; }
function stepWorlds(worlds, days, deadline = Infinity) {
  for (let day = 0; day < days; day++) {
    for (const world of worlds) SIM.step(world);
    if (performance.now() >= deadline) break;
  }
}

function timedDuringDay(entries, tick) {
  const start = tick * SIM.DAY_MINUTES;
  return entries.filter(e => e.t === tick + 1 && SIM.eventTime(e) < start + SIM.DAY_MINUTES)
    .sort((a, b) => SIM.eventTime(a) - SIM.eventTime(b) || a.id - b.id);
}

function watchedEvent(event, watch) {
  if (!watch || event.id === watch.ignored || SIM.eventTime(event) < watch.time) return false;
  const kind = event.kind || event.type;
  const gathering = ['assembly', 'council', 'wedding', 'funeral', 'battle'].includes(kind) ||
    ((kind === 'rite' || kind === 'gov') && /свадьб|похорон|провожа|сход|вече/u.test(event.text.toLowerCase()));
  return gathering && (event.who?.includes(watch.person) || event.gs?.includes(watch.village));
}

function stepPlayback(world, days, watch, predicted, deadline = Infinity) {
  const opening = watch ? SIM.serialize(world) : null;
  const flashes = [];
  for (let day = 0; day < days; day++) {
    const tick = world.tick;
    if (day === 0 && predicted) world = predicted;
    else SIM.step(world);
    if (watch) {
      const event = timedDuringDay(world.events, tick).find(e => watchedEvent(e, watch));
      if (event) {
        // A rare match needs one replay to stop at its day's opening snapshot.
        world = SIM.restore(opening);
        for (let passed = 0; passed < day; passed++) SIM.step(world);
        return { world, event, flashes };
      }
    }
    const start = tick * SIM.DAY_MINUTES, end = world.tick * SIM.DAY_MINUTES;
    for (const f of world.flashes) {
      const time = SIM.eventTime(f);
      if ((time > start && time <= end) || (f.t === world.tick && time === start)) flashes.push(f);
    }
    if (performance.now() >= deadline) break;
  }
  flashes.sort((a, b) => SIM.eventTime(a) - SIM.eventTime(b) || a.id - b.id);
  return { world, flashes };
}

function backgroundWorlds(read, display) {
  let worker, pending, forecast, revision = 0;
  function reset() {
    pending?.finish(false);
    pending = null;
    forecast?.(null);
    forecast = null;
    revision++;
    if (worker) worker.postMessage({ revision, snapshots: read().map(SIM.serialize) });
  }
  function fallback() {
    worker?.terminate();
    worker = null;
    pending?.finish(false);
    pending = null;
    forecast?.(null);
    forecast = null;
  }
  if (typeof Worker !== 'undefined') {
    const code = `
      let worlds, prepared;
      ${stepWorlds.toString()}
      ${timedDuringDay.toString()}
      ${watchedEvent.toString()}
      ${stepPlayback.toString()}
      onmessage = ({ data }) => {
        if (data.snapshots) {
          worlds = data.snapshots.map(SIM.restore);
          prepared = null;
          return;
        }
        worlds.forEach((world, i) => { world.params = data.params[i]; });
        if (data.forecast) {
          const { end, plans } = SIM.prepareDay(worlds[0]);
          prepared = { end, params: JSON.stringify(worlds[0].params) };
          const events = timedDuringDay(end.events, worlds[0].tick);
          const flashes = timedDuringDay(end.flashes, worlds[0].tick);
          postMessage({ revision: data.revision, plans, events, flashes });
          return;
        }
        let days = data.days;
        const predicted = prepared && prepared.params === JSON.stringify(worlds[0].params) && prepared.end;
        let playback;
        if (data.playback) {
          playback = stepPlayback(worlds[0], days, data.playback.watch, predicted);
          worlds[0] = playback.world;
        } else {
          if (days > 0 && predicted) { worlds[0] = predicted; days--; }
          stepWorlds(worlds, days);
        }
        prepared = null;
        postMessage({ revision: data.revision, snapshots: worlds.map(SIM.serialize),
          event: playback?.event, flashes: playback?.flashes });
      };
    `;
    const url = URL.createObjectURL(new Blob([engineSource(), code], { type: 'text/javascript' }));
    try {
      worker = new Worker(url);
      worker.onerror = fallback;
      worker.onmessageerror = fallback;
      worker.onmessage = ({ data }) => {
        if (data.revision !== revision) return;
        if (data.plans) {
          const finish = forecast;
          forecast = null;
          finish?.({ plans: data.plans, events: data.events, flashes: data.flashes });
          return;
        }
        if (!pending) return;
        const old = read();
        const worlds = data.snapshots.map((snapshot, i) => {
          const world = SIM.restore(snapshot);
          world.params = old[i].params;
          return world;
        });
        const request = pending;
        pending = null;
        display(worlds);
        request.finish(true, data);
      };
    } catch (error) { fallback(); }
    finally { URL.revokeObjectURL(url); }
  }
  return {
    reset,
    get busy() { return !!pending; },
    forecast(finish) {
      if (worker) {
        forecast = finish;
        worker.postMessage({ revision, forecast: true, params: read().map(world => world.params) });
      } else {
        const world = read()[0], { end, plans } = SIM.prepareDay(world);
        finish({ plans, events: timedDuringDay(end.events, world.tick), flashes: timedDuringDay(end.flashes, world.tick) });
      }
    },
    advance(days, finish, playback) {
      if (worker) {
        pending = { finish };
        worker.postMessage({ revision, days, playback, params: read().map(world => world.params) });
      } else {
        if (playback) {
          const result = stepPlayback(read()[0], days, playback.watch, null, performance.now() + 8);
          display([result.world]);
          finish(true, result);
        } else {
          stepWorlds(read(), days, performance.now() + 8);
          finish(true);
        }
      }
    },
  };
}

const mainRunner = backgroundWorlds(() => [S], ([world]) => { S = world; });
