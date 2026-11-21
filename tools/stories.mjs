// The most dramatic lives of one world, for judging the drama by eye.
// Usage: node tools/stories.mjs [seed=5000] [years=80] [top=5]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const SIM = require('../dist/sim.cjs');
const seed = +(process.argv[2] || 5000), Y = +(process.argv[3] || 80), TOP = +(process.argv[4] || 5);
const S = SIM.newWorld(seed, {});
for (let d = 0; d < 360 * Y; d++) SIM.step(S);
console.log(`model ${SIM.MODEL.v}, seed ${seed}, ${Y} years`);
const lives = SIM.topFates(S, Math.max(TOP, 20)).map(p => ({ ...p, dead: !p.alive, age: (S.tick - p.born) / 360 }));
for (const l of lives.slice(0, TOP)) {
  console.log(`\n=== ${l.name} (${l.dead ? 'умер(ла)' : `жив(а), ${Math.floor(l.age)}`}), драма ${l.drama.toFixed(0)}`);
  for (const [t, , s] of l.bio) console.log(`  г.${Math.floor(t / 360)}  ${s}`);
  for (const x of l.goals || []) if (x.end) console.log(`  дуга «${SIM.GOAL_NAME[x.k]}»: г.${Math.floor(x.t / 360)} ${x.txt}${(x.turns || []).map(t => ` → г.${Math.floor(t[0] / 360)} ${t[1]}`).join('')} → г.${Math.floor(x.end / 360)} ${x.endTxt} (${SIM.GOAL_OUT[x.out]})`);
}
const m = SIM.dramaMeasure(lives.slice(0, 20));
console.log(`\ntop ${m.lives}: ${m.kinds.toFixed(1)} kinds of turn per life, ${m.distinct} across them; repeats ${Math.round(m.repeats * 100)}%; finished arc ${Math.round(m.arcs * 100)}%; loops (3+ in one life): ${Object.entries(m.loops).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`);
const kinds = {};
for (const l of lives) for (const [, k] of l.bio) kinds[k] = (kinds[k] || 0) + 1;
console.log('turns of fate over the top lives: ' + Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
