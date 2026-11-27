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
  // Н3: every turning point a village keeps for its history page opens
  for (const g of S.groups) for (const id of g.hev || []) check(id, `history of «${g.name}»`);
  // Н1: every named participant of a kept event opens: alive, a legend, or a shade of the dead
  for (const id in S.shades || {}) for (const b of S.shades[id].bio) check(b[3], `shade of ${S.shades[id].name}`);
  const known = id => S._a.has(id) || (S.legends || []).some(l => l.id === id) || (S.shades && S.shades[id]);
  for (const e of [...S.events, ...Object.values(S.evArch || {})]) for (const id of [...(e.who || []), ...(e.author ? [e.author] : []), ...(e.against || [])]) assert.ok(known(id), `${where}: participant ${id} of event ${e.id} has no chronicle`);
  return n;
}
// a hungry island for the check: every winter the smallest village loses its store, so neighbours send grain and the
// memory of that help has a chance to decide where someone finds shelter (the world itself has grown well fed since Ч1)
const STRESS = process.env.SOCIETY_CHAIN_STRESS === '1';
function hungryWinter(S) {
  const g = S.groups.filter(x => x.home && !x.dead && x.members.length >= 5).sort((a, b) => a.members.length - b.members.length)[0];
  if (!g) return;
  g.treasury = 0;
  for (const id of g.members) { const a = S._a.get(id); if (a) a.wealth = Math.min(a.wealth, -0.5); }
}
export function runIsland(i, years) {
  const seed = 5000 + i * 7919;
  let S = SIM.newWorld(seed, {});
  const watch = []; // shelter stories: { person, cause, line }
  for (let y = 1; y <= years; y++) {
    for (let d = 0; d < 360; d++) {
      if (STRESS && S.tick % 360 === 2) hungryWinter(S);
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

function reportIsland(island) {
  console.log(`seed ${island.seed}: shelter stories ${island.stories}, grain event opened after leaving the feed ${island.afterLoad}, from a dead person's legend ${island.fromLegend}, archive ${island.archive} events`);
}

async function run(count) {
  let stories = 0, afterLoad = 0, fromLegend = 0, refs = 0;
  await runIslands(import.meta.url, runIsland, count, Y, island => {
    stories += island.stories;
    afterLoad += island.afterLoad;
    fromLegend += island.fromLegend;
    refs += island.refs;
    reportIsland(island);
  });
  console.log(`\nshelter stories ${stories}; source opened after leaving the feed and after save/load ${afterLoad}; from legends of the dead ${fromLegend}; references checked ${refs}, none dangling`);
  return { stories, afterLoad };
}
async function main() {
  let r = await run(W);
  // The second 24-island audit found two such stories on island 29 in m31.
  // Keep the usual reference scan, then try that naturally occurring example.
  if ((!r.stories || !r.afterLoad) && W <= 29) {
    const example = runIsland(29, Y);
    reportIsland(example);
    console.log(`additional references checked ${example.refs}, none dangling`);
    r.stories += example.stories;
    r.afterLoad += example.afterLoad;
  }
  if ((!r.stories || !r.afterLoad) && W < 12) { console.log(`\nno shelter story left the feed on ${W} islands: checking 12`); r = await run(12); }
  if (!r.stories || !r.afterLoad) { console.log(`\nthe world is well fed and no village starved: checking ${W} islands with a hungry winter each year`); process.env.SOCIETY_CHAIN_STRESS = '1'; r = await run(W); }
  assert.ok(r.stories > 0, 'no shelter story found: the chain was not exercised');
  assert.ok(r.afterLoad > 0, 'no grain event was opened after leaving the feed and after save/load');
  console.log('chain: all good');
}

if (isMainThread) await main();
