// A single-file page can use the same engine in its workers, including when opened from disk.
function engineSource() { return $('sim-source').textContent; }
function stepWorlds(worlds, days, deadline = Infinity) {
  for (let day = 0; day < days; day++) {
    for (const world of worlds) SIM.step(world);
    if (performance.now() >= deadline) break;
  }
}

function backgroundWorlds(read, display) {
  let worker, pending, revision = 0;
  function reset() {
    pending?.finish(false);
    pending = null;
    revision++;
    if (worker) worker.postMessage({ revision, snapshots: read().map(SIM.serialize) });
  }
  function fallback() {
    worker?.terminate();
    worker = null;
    pending?.finish(false);
    pending = null;
  }
  if (typeof Worker !== 'undefined') {
    const code = `
      let worlds;
      ${stepWorlds.toString()}
      onmessage = ({ data }) => {
        if (data.snapshots) {
          worlds = data.snapshots.map(SIM.restore);
          return;
        }
        worlds.forEach((world, i) => { world.params = data.params[i]; });
        stepWorlds(worlds, data.days);
        postMessage({ revision: data.revision, snapshots: worlds.map(SIM.serialize) });
      };
    `;
    const url = URL.createObjectURL(new Blob([engineSource(), code], { type: 'text/javascript' }));
    try {
      worker = new Worker(url);
      worker.onerror = fallback;
      worker.onmessageerror = fallback;
      worker.onmessage = ({ data }) => {
        if (data.revision !== revision || !pending) return;
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
