// The most dramatic lives of one world, for judging the drama by eye.
// Usage: node tools/stories.mjs [seed=5000] [years=80] [top=5]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const SIM = require('../dist/sim.cjs');
const seed = +(process.argv[2] || 5000), Y = +(process.argv[3] || 80), TOP = +(process.argv[4] || 5);
const S = SIM.newWorld(seed, {});
for (let d = 0; d < 360 * Y; d++) SIM.step(S);
console.log(`model ${SIM.MODEL.v}, seed ${seed}, ${Y} years`);
const lives = (S.legends || []).map(l => ({ ...l, dead: true })).concat(S.agents.map(a => ({ name: a.name, bio: a.bio || [], drama: a.drama || 0, dead: false, age: a.age })));
lives.sort((a, b) => b.drama - a.drama);
for (const l of lives.slice(0, TOP)) {
  console.log(`\n=== ${l.name} (${l.dead ? 'умер(ла)' : `жив(а), ${Math.floor(l.age)}`}), драма ${l.drama.toFixed(0)}`);
  for (const [t, , s] of l.bio) console.log(`  г.${Math.floor(t / 360)}  ${s}`);
}
const kinds = {};
for (const l of lives) for (const [, k] of l.bio) kinds[k] = (kinds[k] || 0) + 1;
console.log('\nturns of fate over all lives: ' + Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
