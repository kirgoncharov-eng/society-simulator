// Acceptance check of the linked chronicle on one story: a village sends grain -> a person remembers the help ->
// years later that memory decides where they find shelter. From the shelter record the original grain event must open
// after it has left the 250-entry feed, after save and load, and from a dead person's saved biography.
// Usage: node tools/chain.mjs [islands=6] [years=80]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { isMainThread } from 'node:worker_threads';
import { runIslands } from './islands.mjs';
const require = createRequire(import.meta.url);
const SIM = require('../dist/sim.cjs');
const W = +(process.argv[2] || 6), Y = +(process.argv[3] || 80);
const inFeed = (S, id) => S.events.some(e => e.id === id);
// every reference anywhere in the world must open an event
function noDangling(S, where) {
  let n = 0;
  const check = (id, what) => { if (!id) return; n++; assert.ok(SIM.eventById(S, id), `${where}: dangling reference ${id} in ${what}`); };
  // an arc's opening, turns and ending all open their events
  const goals = (G, what) => {
    for (const x of G || []) {
      if (x.end && x.out !== 'died') assert.ok(x.endEv, `${where}: ${what} has an ending without a chronicle reference`);
      check(x.ev, what);
      check(x.endEv, what);
      for (const t of x.turns || []) check(t[2], what);
    }
  };
  for (const a of S.agents) {
    for (const b of a.bio || []) check(b[3], `chronicle of ${a.name}`);
    for (const m of a.grainMemories || []) check(m.ev, `grain memory of ${a.name}`);
    for (const id in a.bonds || {}) check(a.bonds[id][5], `tie of ${a.name}`);
    if (a.feud && a.feud.ev && !a.feud.done) check(a.feud.ev, `feud of ${a.name}`);
    goals(a.goals, `arcs of ${a.name}`);
  }
  for (const l of S.legends || []) { for (const b of l.bio || []) check(b[3], `legend of ${l.name}`); goals(l.goals, `arcs in the legend of ${l.name}`); }
  for (const e of S.events) for (const c of e.causes || []) check(c, `causes of event ${e.id}`);
  return n;
}
export function runIsland(i, years) {
  const seed = 5000 + i * 7919;
  let S = SIM.newWorld(seed, {});
  const watch = []; // shelter stories: { person, cause, line }
  for (let y = 1; y <= years; y++) {
    for (let d = 0; d < 360; d++) {
      SIM.step(S);
      for (const e of S.events) {
        if (e.t !== S.tick) break;
        if (e.type !== 'aid' || !e.causes || !/находит приют/.test(e.text)) continue;
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
        if (!inFeed(S, w.cause)) w.out = true;
        if (!p && l) w.legend = true;
      }
    }
  }
  return {
    seed, stories: watch.length, afterLoad: watch.filter(w => w.out).length,
    fromLegend: watch.filter(w => w.legend).length,
    refs: noDangling(S, `seed ${seed}`), archive: Object.keys(S.evArch || {}).length,
  };
}

// shelter stories are rare and chaotic (17 to 35 on 24 islands between close model versions): when the first islands give
// no story that left the feed, look further, up to 12 islands; every island is still checked for dangling references
async function run(count) {
  let stories = 0, afterLoad = 0, fromLegend = 0, refs = 0;
  await runIslands(import.meta.url, runIsland, count, Y, island => {
    stories += island.stories;
    afterLoad += island.afterLoad;
    fromLegend += island.fromLegend;
    refs += island.refs;
    console.log(`seed ${island.seed}: shelter stories ${island.stories}, grain event opened after leaving the feed ${island.afterLoad}, from a dead person's legend ${island.fromLegend}, archive ${island.archive} events`);
  });
  console.log(`\nshelter stories ${stories}; source opened after leaving the feed and after save/load ${afterLoad}; from legends of the dead ${fromLegend}; references checked ${refs}, none dangling`);
  return { stories, afterLoad };
}
async function main() {
  let r = await run(W);
  if ((!r.stories || !r.afterLoad) && W < 12) { console.log(`\nno shelter story left the feed on ${W} islands: checking 12`); r = await run(12); }
  assert.ok(r.stories > 0, 'no shelter story found: the chain was not exercised');
  assert.ok(r.afterLoad > 0, 'no grain event was opened after leaving the feed and after save/load');
  console.log('chain: all good');
}

if (isMainThread) await main();
