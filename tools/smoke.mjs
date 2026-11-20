// Smoke test: runs a few island worlds and checks invariants. Exit code 1 on any failure.
// Usage: node tools/smoke.mjs [worlds=3] [years=40]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const SIM = require('../dist/sim.cjs');

// A well-fed founder should regain some energy over a day.
{
  const S = SIM.newWorld(5000, {});
  const founder = S.agents[0];
  const tiredEnergy = 0.25;
  founder.energy = tiredEnergy;
  SIM.step(S);
  assert.ok(founder.energy > tiredEnergy, 'A well-fed founder did not recover energy');
}

const W = +(process.argv[2] || 3), Y = +(process.argv[3] || 40);
let fail = 0;
const bad = (seed, msg) => { fail++; console.error(`FAIL seed ${seed}: ${msg}`); };
for (let i = 0; i < W; i++) {
  const seed = 5000 + i * 7919, S = SIM.newWorld(seed, {}), t0 = Date.now();
  let wet = 0, samples = 0;
  try {
    for (let d = 0; d < 360 * Y; d++) {
      SIM.step(S);
      if (d % 90 === 0) for (const a of S.agents) {
        samples++;
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.wealth) || !Number.isFinite(a.energy)) { bad(seed, `NaN in agent ${a.id} at tick ${S.tick}`); d = 1e9; break; }
        const c = Math.floor(a.y / 20) * 50 + Math.floor(a.x / 20), t = S.ter[c];
        if (t === 's' || (t === 'w' && !S.bridge[c] && !S.ford[c] && !S.frozen)) wet++;
      }
    }
  } catch (e) { bad(seed, `exception: ${e.stack}`); continue; }
  const pop = SIM.popOf(S);
  if (pop <= 0) bad(seed, 'everyone died');
  if (wet / Math.max(1, samples) > 0.01) bad(seed, `${wet} of ${samples} agent samples stand in water`);
  if (!S.events.every(e => typeof e.text === 'string' && e.text.length)) bad(seed, 'event without text');
  const snap = SIM.serialize(S), R = SIM.restore(snap); for (let d = 0; d < 360; d++) SIM.step(R);
  console.log(`ok seed ${seed}: ${Y} years, population ${pop}, groups ${S.groups.length}, ${Date.now() - t0} ms`);
}
if (fail) { console.error(`${fail} failure(s)`); process.exit(1); }
console.log('smoke: all good');
