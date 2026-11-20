// Realism audit: demography and causes of death over several island worlds.
// Usage: node tools/audit.mjs [worlds=6] [years=80]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const SIM = require('../dist/sim.cjs');
const W = +(process.argv[2] || 6), Y = +(process.argv[3] || 80);
const causes = ['death', 'sick', 'burnout', 'war', 'plague', 'drown', 'lostAtSea', 'killed'];
const label = { death: 'old age', sick: 'sickness', burnout: 'hunger', war: 'war', plague: 'plague', drown: 'drowning', lostAtSea: 'lost at sea', killed: 'murder' };
const tot = {}; let B = 0, CD = 0;
for (let i = 0; i < W; i++) {
  const seed = 5000 + i * 7919, S = SIM.newWorld(seed, {}), pops = [];
  for (let y = 1; y <= Y; y++) { for (let d = 0; d < 360; d++) SIM.step(S); if (y % 20 === 0) pops.push(SIM.popOf(S)); }
  const st = S.stats; B += st.births || 0; CD += st.childDeaths || 0;
  for (const k of causes) tot[k] = (tot[k] || 0) + (st[k] || 0);
  const adults = S.agents.filter(a => !a.kid), cbr = (st.births || 0) / Y / Math.max(1, pops.reduce((s, x) => s + x, 0) / pops.length) * 1000;
  const villages = S.groups.filter(g => g.home).map(g => g.members.length).sort((a, b) => b - a);
  console.log(`seed ${seed}: population by 20y ${pops.join('/')}, coups ${st.coups || 0}, wars ${st.wars || 0}, births/1000/yr ${cbr.toFixed(0)}, adults now ${adults.length}, villages ${villages.join(',')}`);
}
const sum = Object.values(tot).reduce((s, x) => s + x, 0) || 1;
console.log('\nadult deaths by cause: ' + causes.map(k => `${label[k]} ${Math.round(tot[k] / sum * 100)}%`).join(', '));
console.log(`child mortality before 15 (deaths/births in window): ${(CD / Math.max(1, B)).toFixed(2)}`);
console.log('targets: child mortality 0.30-0.50; hunger < 20% of adult deaths; old age + sickness > 50%; births 35-50 per 1000 per year');
