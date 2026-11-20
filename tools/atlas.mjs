// Recompute the shipped atlas: N worlds x Y years, writes src/ui/atlas-data.json. Slow (about a minute per 100-year world).
// Usage: node tools/atlas.mjs [worlds=100] [years=100]
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const SIM = require('../dist/sim.cjs');
const N = +(process.argv[2] || 100), Y = +(process.argv[3] || 100);
// reuse the exact in-browser runner (ATLW in src/ui/71-atlas-runner.js) so both paths match
const src = readFileSync(new URL('../src/ui/71-atlas-runner.js', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('const ATLW = `') + 14, src.indexOf('`;', src.indexOf('const ATLW = `')));
const { runWorld } = new Function('SIM', body + '\nreturn { runWorld };')(SIM);
const out = [];
for (let i = 0; i < N; i++) { const t = Date.now(); out.push(runWorld(1000 + i * 7919, Y, {})); console.log(`world ${i + 1}/${N} ${Date.now() - t} ms`); }
writeFileSync(new URL('../src/ui/atlas-data.json', import.meta.url), JSON.stringify(out));
console.log('written src/ui/atlas-data.json — run `npm run build` and update OLD/NEW notes in src/ui/70-atlas.js if the model changed');
