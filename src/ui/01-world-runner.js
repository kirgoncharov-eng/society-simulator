// A single-file page can use the same engine in its workers, including when opened from disk.
function engineSource() { return $('sim-source').textContent; }
function stepWorlds(worlds, days, deadline = Infinity) {
  for (let day = 0; day < days; day++) {
    for (const world of worlds) SIM.step(world);
    if (performance.now() >= deadline) break;
  }
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
          postMessage({ revision: data.revision, plans });
          return;
        }
        let days = data.days;
        if (days > 0 && prepared && prepared.params === JSON.stringify(worlds[0].params)) {
          worlds[0] = prepared.end;
          days--;
        }
        prepared = null;
        stepWorlds(worlds, days);
        postMessage({ revision: data.revision, snapshots: worlds.map(SIM.serialize) });
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
          finish?.(data.plans);
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
        request.finish(true);
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
        finish(SIM.prepareDay(read()[0]).plans);
      }
    },
    advance(days, finish) {
      if (worker) {
        pending = { finish };
        worker.postMessage({ revision, days, params: read().map(world => world.params) });
      } else {
        stepWorlds(read(), days, performance.now() + 8);
        finish(true);
      }
    },
  };
}

const mainRunner = backgroundWorlds(() => [S], ([world]) => { S = world; });
