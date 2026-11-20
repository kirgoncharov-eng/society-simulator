// Acceptance check of the linked chronicle on one story: a village sends grain -> a person remembers the help ->
// years later that memory decides where they find shelter. From the shelter record the original grain event must open
// after it has left the 250-entry feed, after save and load, and from a dead person's saved biography.
// Usage: node tools/chain.mjs [islands=6] [years=80]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const SIM = require('../dist/sim.cjs');
const W = +(process.argv[2] || 6), Y = +(process.argv[3] || 80);
const inFeed = (S, id) => S.events.some(e => e.id === id);
// every reference anywhere in the world must open an event
function noDangling(S, where) {
  let n = 0;
  const check = (id, what) => { if (!id) return; n++; assert.ok(SIM.eventById(S, id), `${where}: dangling reference ${id} in ${what}`); };
  for (const a of S.agents) {
    for (const b of a.bio || []) check(b[3], `chronicle of ${a.name}`);
    for (const m of a.grainMemories || []) check(m.ev, `grain memory of ${a.name}`);
    for (const id in a.bonds || {}) check(a.bonds[id][5], `tie of ${a.name}`);
    if (a.feud && a.feud.ev && !a.feud.done) check(a.feud.ev, `feud of ${a.name}`);
  }
  for (const l of S.legends || []) for (const b of l.bio || []) check(b[3], `legend of ${l.name}`);
  for (const e of S.events) for (const c of e.causes || []) check(c, `causes of event ${e.id}`);
  return n;
}
let stories = 0, outOfFeed = 0, afterLoad = 0, fromLegend = 0, refs = 0;
for (let i = 0; i < W; i++) {
  const seed = 5000 + i * 7919;
  let S = SIM.newWorld(seed, {});
  const watch = []; // shelter stories: { person, cause, line }
  for (let y = 1; y <= Y; y++) {
    for (let d = 0; d < 360; d++) {
      SIM.step(S);
      const e = S.events[0];
      if (e && e.type === 'aid' && e.causes && /находит приют/.test(e.text) && !watch.some(w => w.shelter === e.id)) {
        const person = S._a.get(e.who[0]), line = person && person.bio.find(b => b[3] === e.causes[0] && /помог зерном/.test(b[2]));
        const src = SIM.eventById(S, e.causes[0]);
        assert.ok(src && /зерн/.test(src.text), `seed ${seed}: shelter ${e.id} cites a non-grain event`);
        if (line) watch.push({ shelter: e.id, cause: e.causes[0], person: person.id, name: person.name, line });
      }
    }
    if (y % 10 === 0) {
      // save and load the world on the way: references must survive
      S = SIM.restore(SIM.serialize(S));
      for (const w of watch) {
        const p = S._a.get(w.person), l = (S.legends || []).find(x => x.id === w.person);
        const b = (p ? p.bio : l ? l.bio : []).find(x => x[3] === w.cause);
        if (!b) continue;
        assert.ok(SIM.eventById(S, w.cause), `seed ${seed}: grain event ${w.cause} lost for ${w.name}`);
        if (!inFeed(S, w.cause)) { if (!w.out) { w.out = true; outOfFeed++; } if (!w.loaded) { w.loaded = true; afterLoad++; } }
        if (!p && l && !w.legend) { w.legend = true; fromLegend++; }
      }
    }
  }
  refs += noDangling(S, `seed ${seed}`);
  stories += watch.length;
  console.log(`seed ${seed}: shelter stories ${watch.length}, grain event opened after leaving the feed ${watch.filter(w => w.out).length}, from a dead person's legend ${watch.filter(w => w.legend).length}, archive ${Object.keys(S.evArch || {}).length} events`);
}
console.log(`\nshelter stories ${stories}; source opened after leaving the feed and after save/load ${afterLoad}; from legends of the dead ${fromLegend}; references checked ${refs}, none dangling`);
assert.ok(stories > 0, 'no shelter story found: the chain was not exercised');
assert.ok(afterLoad > 0, 'no grain event was opened after leaving the feed and after save/load');
console.log('chain: all good');
