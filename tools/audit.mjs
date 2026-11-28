// Audit of demography, island history and chronicle links.
// Usage: node tools/audit.mjs [worlds=6] [years=80] [--offset=N] [--save]
//   --offset=N  start at island N (seeds 5000 + (i + N)·7919): a second set of islands, to measure the noise
//   --save      write the key numbers to docs/audits/<model>-<worlds>x<years>[-oN].json (see tools/audits-table.mjs)
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isMainThread } from 'node:worker_threads';
import { runIslands } from './islands.mjs';
const require = createRequire(import.meta.url);
const SIM = require('../dist/sim.cjs');
const ARGS = process.argv.slice(2), NUMS = ARGS.filter(x => /^\d+$/.test(x));
const W = +(NUMS[0] || 6), Y = +(NUMS[1] || 80), SAVE = ARGS.includes('--save');
const offArg = ARGS.find(x => x.startsWith('--offset='));
if (offArg) process.env.SOCIETY_ISLAND_OFFSET = offArg.split('=')[1]; // workers inherit it
const OFF = +(process.env.SOCIETY_ISLAND_OFFSET || 0);
const causes = ['death', 'sick', 'burnout', 'war', 'plague', 'drown', 'lostAtSea', 'killed'];
const label = { death: 'old age', sick: 'sickness', burnout: 'hunger', war: 'war', plague: 'plague', drown: 'drowning', lostAtSea: 'lost at sea', killed: 'murder' };
const med = a => { const x = a.slice().sort((p, q) => p - q); return x.length ? x[Math.floor((x.length - 1) / 2)] : 0; };

function newShelterLinks(S) {
  // Each memory-driven move increments aidMemoryMoves and emits one shelter event.
  // Inspect it on that day, before subsequent events can push it out of the feed.
  let linked = 0;
  for (const event of S.events) {
    if (event.t !== S.tick) break;
    if (event.type !== 'aid' || !event.text.includes('находит приют в')) continue;
    const helper = event.who?.[1];
    if (helper && event.causes?.some(id => {
      const source = SIM.eventById(S, id);
      return source?.type === 'aid' && source.t < event.t && source.who?.[0] === helper
        && (source.text.includes('посылает зерно') || source.text.includes('даёт зерно'));
    })) linked++;
  }
  return linked;
}

function tradeLinks(S) {
  return Object.values(S.routes).filter(route =>
    route.n >= 2 && S._g.has(route.a) && S._g.has(route.b)
  ).length;
}

const percent = (n, total) => total ? `${(100 * n / total).toFixed(1)} %` : 'н/д';
const coverage = (linked, cases) => `${linked}/${cases} (${percent(linked, cases)})`;

export function runIsland(i, years) {
  const arcs = { old: 0, lived: 0, closed: 0, linked: 0, open: 0, lost: 0, kinds: {} };
  const refK = {}, bondRef = {}, bondK = {};
  let famN = 0, houseN = 0, villN = 0, roofN = 0, lodgerN = 0;
  let customW = 0, customI = 0, minPop = Infinity, bondN = 0, adultN = 0, feuds = 0, feudsNamed = 0;
  const seed = 5000 + (i + OFF) * 7919, S = SIM.newWorld(seed, {}), pops = [];
  const lastBirthTick = Math.max(0, (years - 60) * 360);
  const ages = S.ageAudit = { lastBirthTick, adultDeaths: 0, ageAtDeath: 0, reached60: 0, leftBefore60: 0 };
  let cohortBirths = 0, peakTradeLinks = 0, activeTradeLinks = 0;
  let shelterCases = 0, sheltersLinked = 0;
  // power (П1): village-years from year 40 with hereditary rule, an assembly, an overlord or a vassal; and whether the
  // struggles for power (elections, coups, splits) name the sides that stood behind each man
  const power = { vy: 0, hered: 0, assembly: 0, above: 0, fights: 0, named: 0, byLine: 0 };
  // laws (П2): every law event, and how many name an author, an opponent and a cause; reforms in the chronicle
  const laws = { n: 0, author: 0, against: 0, cause: 0, viaPower: 0, reforms: 0, kinds: {} };
  // power in daily life (П3): village-years with dependants (clients of someone other than the leader, bondsmen)
  const life = { vy: 0, dep: 0, old: 0, pol: 0 };
  // the time budget (Ч2): work hours by the walk to work, and productive hours per adult in villages with and without a well
  const tb = { near: [0, 0], far: [0, 0], well: [0, 0], nowell: [0, 0] };
  // regime as history (П4): regime changes with a cause or drifting; dynasties and subjection: how long they last
  const hist = { changes: 0, caused: 0, drift: 0, villageYears: 0, dynLen: [], dynGen: [], vassLen: [] }; const dynOn = new Map(), vassOn = new Map();
  let seenEv = 0;
  // the observer (Н2): rites and skirmishes of the first 40 years in the common feed; family events in «my story»
  const obs = { feed: 0, shown: 0, famEv: 0, famIn: 0, dau: 0, dauIn: 0 };
  // memory (К1): years of enmity within 15 years after a battle with dead
  const grudge = { years: 0, hot: 0 };
  // cultures (К3): the chance that two neighbouring villages (weighted by people) are of one people, from year 20
  const kin = { pairs: 0, same: 0 };
  for (let y = 1; y <= years; y++) {
    for (let d = 0; d < 360; d++) {
      SIM.step(S);
      const cases = S.stats.aidMemoryMoves || 0;
      if (cases !== shelterCases) {
        sheltersLinked += newShelterLinks(S);
        shelterCases = cases;
      }
    }
    activeTradeLinks = tradeLinks(S);
    peakTradeLinks = Math.max(peakTradeLinks, activeTradeLinks);
    if (S.tick === lastBirthTick) cohortBirths = S.stats.births || 0;
    if (y % 20 === 0) pops.push(SIM.popOf(S));
    if (y >= 20) { const vs = S.groups.filter(g => g.home && g.people); for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) { if (Math.hypot(vs[i].home.x - vs[j].home.x, vs[i].home.y - vs[j].home.y) > 320) continue; const w = vs[i].members.length * vs[j].members.length; kin.pairs += w; if (vs[i].people === vs[j].people) kin.same += w; } }
    for (const [k, t] of S.stats.bloodPairs || []) if (S.tick - t > 0 && S.tick - t <= 360 * 15) { grudge.years++; if ((S.hostility[k] || 0) >= 0.2) grudge.hot++; }
    if (y <= 40) for (const e of S.events) { if (e.id <= seenEv) break; if (e.type === 'rite' || e.type === 'border' || e.type === 'conflict') { obs.feed++; if (!e.minor) obs.shown++; } }
    if (y === 40) for (const a of S.agents.filter(p => p.age >= 30).slice(0, 60)) {
      const story = new Set(SIM.storyOf(S, a.id, 1e9).map(x => x.ev.id)), fam = SIM.familyOf(S, a);
      for (const [id, rel] of fam) { const p = SIM.personOf(S, id); if (!p || rel === 'self') continue;
        for (const b of p.bio || []) if (b[3] && SIM.eventById(S, b[3])) { const e = SIM.eventById(S, b[3]); if (![...(e.who || []), e.author, ...(e.against || [])].includes(id)) continue; obs.famEv++; if (story.has(b[3])) obs.famIn++;
          if (rel === 'child' && p.sex === 'f' && b[1] === 'marry') { obs.dau++; if (story.has(b[3])) obs.dauIn++; } } }
    }
    for (const g of S.groups) { if (!g.home) continue; if (g.members.length >= 6) hist.villageYears++;
      if (g.dynasty && !dynOn.has(g.id)) dynOn.set(g.id, S.tick); if (!g.dynasty && dynOn.has(g.id)) { hist.dynLen.push((S.tick - dynOn.get(g.id)) / 360); hist.dynGen.push(g.dynGen || 1); dynOn.delete(g.id); }
      if (g.lord && !vassOn.has(g.id)) vassOn.set(g.id, S.tick); if (!g.lord && vassOn.has(g.id)) { hist.vassLen.push((S.tick - vassOn.get(g.id)) / 360); vassOn.delete(g.id); } }
    for (const e of S.events) { if (e.id <= seenEv) break; if (e.type === 'regime') { hist.changes++; if (e.drift) hist.drift++; else if (e.causes && e.causes.length) hist.caused++; } if (e.type === 'reform') laws.reforms++; if (e.type === 'law' || e.type === 'gov' || e.law) { laws.n++; laws.kinds[e.law || e.type] = (laws.kinds[e.law || e.type] || 0) + 1; if (e.author) laws.author++; if (e.against && e.against.length) laws.against++; if (e.causes && e.causes.length) laws.cause++; if (e.via === 'power') laws.viaPower++; } if (e.type === 'coup' || e.type === 'schism' || e.type === 'crisis' || (e.type === 'succession' && !/По праву/.test(e.text))) { power.fights++; if (e.sides) power.named++; } }
    if (S.events[0]) seenEv = Math.max(seenEv, S.events[0].id);
    if (y >= 20) for (const g of S.groups) { if (!g.home || g.dead || g.members.length < 5) continue; let hrs = 0, ad = 0; for (const id of g.members) { const a = S._a.get(id); if (!a || a.age < 16) continue; ad++; const b = a._day; if (!b) continue; if (a.job !== 'water') hrs += b.work; const r = b.road < 0.5 ? tb.near : b.road > 1.5 ? tb.far : null; if (r) { r[0] += b.work; r[1]++; } } const w = g.well ? tb.well : tb.nowell; w[0] += hrs; w[1] += ad; }
    if (y >= 40) for (const g of S.groups) { if (!g.home || g.dead || g.members.length < 5) continue; life.vy++; if (g.members.some(id => { const m = S._a.get(id); return m && (m.bond || (m.patron && m.patron !== g.leader)); })) life.dep++; }
    if (y >= 40) for (const g of S.groups) { if (!g.home || g.dead || g.members.length < 5) continue; power.vy++; if (g.dynasty) power.hered++; if (g.dynasty && g.dynLin) power.byLine++; if (g.gov === 'assembly') power.assembly++; if (g.lord || S.groups.some(o => o.lord === g.id)) power.above++; }
    if (y >= 10) minPop = Math.min(minPop, SIM.popOf(S));
  }
  const aliveAt60 = S.agents.filter(a => a.bornT > 0 && a.bornT <= lastBirthTick).length;
  const age = {
    deaths: ages.adultDeaths, sum: ages.ageAtDeath, eligible: cohortBirths - ages.leftBefore60,
    left: ages.leftBefore60, reached: ages.reached60 + aliveAt60,
  };
  const st = S.stats;
  const deaths = causes.reduce((total, kind) => total + (st[kind] || 0), 0);
  const history = {
    seed, deaths, hunger: st.burnout || 0, trades: st.trades || 0, activeTradeLinks, peakTradeLinks,
    wars: st.wars || 0, regimeChanges: S.evc?.regime || 0, states: st.states || 0,
    shelterCases, sheltersLinked,
  };
  const adults = S.agents.filter(a => !a.kid), cbr = (st.births || 0) / years / Math.max(1, pops.reduce((s, x) => s + x, 0) / pops.length) * 1000;
  const villages = S.groups.filter(g => g.home).map(g => g.members.length).sort((a, b) => b - a);
  for (const a of S.agents) { if (a.age < 16) continue; adultN++; const bs = a.bonds || {}; for (const id in bs) { bondN++; bondK[bs[id][0]] = (bondK[bs[id][0]] || 0) + 1; } for (const id in a.trust) if (a.trust[id] < -0.3 && S._a.has(+id)) { feuds++; if (bs[id] && (bs[id][0] === 'enemy' || bs[id][0] === 'rival') && bs[id][3]) feudsNamed++; } }
  for (const g of S.groups) if (g.home) { famN += g.wantH || 0; houseN += g.houses.filter(h => !h.ruined).length; for (const id of g.members) { const a = S._a.get(id); villN++; if (a.shel) roofN++; if (a.lodger) lodgerN++; } }
  for (const g of S.groups) { if ((g.customs || {}).blood) customW++; if ((g.customs || {}).inherit) customI++; }
  // linked chronicle: share of lines and ties that point to the event behind them
  for (const B of S.agents.map(a => a.bio || []).concat((S.legends || []).map(l => l.bio))) for (const b of B) { const r = refK[b[1]] || (refK[b[1]] = [0, 0]); r[0]++; if (b[3]) r[1]++; }
  for (const a of S.agents) for (const id in a.bonds || {}) { const x = a.bonds[id]; if (x[4]) continue; const r = bondRef[x[0]] || (bondRef[x[0]] = [0, 0]); r[0]++; if (x[5]) r[1]++; }
  // goals and arcs: adults over 40 who lived through at least one finished arc (an ending other than death)
  for (const a of S.agents) if (a.age > 40) { arcs.old++; if ((a.goals || []).some(x => x.end && x.out !== 'died')) arcs.lived++; }
  for (const G of S.agents.map(a => a.goals || []).concat((S.legends || []).map(l => l.goals || []))) for (const x of G) {
    if (!x.end) { arcs.open++; continue; }
    if (x.out === 'died' && !x.endEv) { arcs.lost++; continue; } // died at sea or murdered: no funeral to point at
    arcs.closed++; if (x.ev && SIM.eventById(S, x.ev) && SIM.eventById(S, x.endEv)) arcs.linked++;
  }
  // adults over 30 with a political line that points to its cause, leaving out quitting a leader and joining a war band
  const POL = new Set(['leader', 'heir', 'coup', 'deposed', 'schism', 'found', 'exiled', 'client', 'bond', 'freed', 'law', 'lawLost', 'tyranny', 'tax', 'feedAll', 'fedByLeader', 'tribute']);
  // regimes at the end: how many kinds, and how many reached by a change that names its cause
  { const now = S.groups.filter(g => g.home && g.members.length >= 6 && g.rtype); hist.kinds = [...new Set(now.map(g => g.rtype))]; hist.kindsCaused = [...new Set(now.filter(g => (g.regimes || []).length && SIM.eventById(S, g.regimes[g.regimes.length - 1][2])?.causes?.length).map(g => g.rtype))]; }
  hist.states = Object.values(S.sarch || {}).map(s => [s.founded, s.end]);
  for (const a of S.agents) if (a.age > 40) { life.old40 = (life.old40 || 0) + 1; if ((a.bio || []).some(b => b[1] === 'temper')) life.tempered = (life.tempered || 0) + 1; }
  for (const a of S.agents) if (a.age > 30) { life.old++; if ((a.bio || []).some(b => POL.has(b[1]) && b[3])) life.pol++; }
  life.kept = st.breadKept || 0; life.broken = st.breadBroken || 0;
  // drama of the top 20 lives (the Fates tab): variety of turns, finished arcs, repeats and the loops behind them
  const drama = SIM.dramaMeasure(SIM.topFates(S, 20));
  for (const k in st) if (k.startsWith('arc_')) { const [, kind, out] = k.split('_'); const o = arcs.kinds[kind] || (arcs.kinds[kind] = {}); o[out] = (o[out] || 0) + st[k]; }
  return { history, st, arcs, drama, power, laws, life, hist, tb, pops, villages, cbr, adults: adults.length, age, minPop, memory: S.params.memory, obs, grudge, kin, peoples: (S.peoples || []).length, peopleVillages: S.groups.filter(g => g.home && g.people).length, villagesNow: S.groups.filter(g => g.home).length, places: (S.places || []).length, memAlive: S.groups.reduce((s, g) => s + (g.mem || []).length, 0),
    myth: (() => { const all = S.groups.flatMap(g => (g.myths || []).map(y => [g, y])), evs = {}; for (const [g, y] of all) for (const id of [y.ev, ...(y.merged || []).map(e => e[0])]) (evs[id] || (evs[id] = new Set())).add(y.text); // distinct tellings of one event
      return { n: all.length, linked: all.filter(([, y]) => SIM.eventById(S, y.ev)).length, diffs: all.reduce((s, [, y]) => s + y.diff.length, 0), withDiff: all.filter(([, y]) => y.diff.length).length, versions: Object.values(evs).filter(x => x.size > 1).length, steps: all.reduce((s, [, y]) => s + y.step, 0) }; })(),
    famN, houseN, villN, roofN, lodgerN, customW, customI, bondN, adultN, feuds, feudsNamed, refK, bondRef, bondK };
}

function mergeRefs(totals, refs) {
  for (const [key, [count, linked]] of Object.entries(refs)) {
    const pair = totals[key] || (totals[key] = [0, 0]);
    pair[0] += count;
    pair[1] += linked;
  }
}

async function main() {
  console.log(`model ${SIM.MODEL.v} (${SIM.MODEL.date}), ${W} islands x ${Y} years`);
  const totals = { famN: 0, houseN: 0, villN: 0, roofN: 0, lodgerN: 0, customW: 0, customI: 0,
    bondN: 0, adultN: 0, feuds: 0, feudsNamed: 0 };
  const refK = {}, bondRef = {}, bondK = {}, caseN = {}, tot = {};
  const age = { deaths: 0, sum: 0, eligible: 0, reached: 0, left: 0 };
  const islandHistory = [], allV = [], vMed = [], vSmall = [];
  const arcs = { old: 0, lived: 0, closed: 0, linked: 0, open: 0, lost: 0, kinds: {} };
  const drama = { n: 0, kinds: 0, distinct: 0, repeats: 0, arcs: 0, loops: {}, worst: 0 };
  const power = { vy: 0, hered: 0, assembly: 0, above: 0, fights: 0, named: 0, byLine: 0 }; const heredBy = [];
  const laws = { n: 0, author: 0, against: 0, cause: 0, viaPower: 0, reforms: 0, kinds: {} };
  const life = { vy: 0, dep: 0, old: 0, pol: 0, kept: 0, broken: 0, old40: 0, tempered: 0 };
  const hist = { changes: 0, caused: 0, drift: 0, villageYears: 0, dynLen: [], dynGen: [], vassLen: [], kinds: [], kindsCaused: [], stLen: [], stBorn: 0, stFell: 0 };
  const tb = { near: [0, 0], far: [0, 0], well: [0, 0], nowell: [0, 0] };
  // the clock of events (Ч4): events with an hour, events by day of the month; how long things take
  const clock = { all: 0, timed: 0, day: new Array(30).fill(0) }, dur = {}; let memory = 0;
  const obs = { feed: 0, shown: 0, famEv: 0, famIn: 0, dau: 0, dauIn: 0 };
  const cul = { peoples: [], inPeople: 0, villages: 0, pairs: 0, same: 0 };
  const myth = { n: [], linked: 0, diffs: 0, withDiff: 0, versions: 0, steps: 0 };
  const mem = { places: [], alive: 0, grudgeYears: 0, grudgeHot: 0, life: { bare: [0, 0], place: [0, 0], mon: [0, 0] } }, memSt = {};
  let B = 0, CD = 0, minPop = Infinity, customN = 0;
  let memoryMoves = 0, sponsoredMoves = 0, aidReturned = 0, aidChanged = 0;
  await runIslands(import.meta.url, runIsland, W, Y, island => {
    const { history, st, pops, villages, cbr, adults } = island;
    islandHistory.push(history);
    for (const key of Object.keys(totals)) totals[key] += island[key];
    for (const key of Object.keys(age)) age[key] += island.age[key];
    for (const key of ['old', 'lived', 'closed', 'linked', 'open', 'lost']) arcs[key] += island.arcs[key];
    for (const [kind, outcomes] of Object.entries(island.arcs.kinds)) {
      const total = arcs.kinds[kind] || (arcs.kinds[kind] = {});
      for (const [outcome, count] of Object.entries(outcomes)) total[outcome] = (total[outcome] || 0) + count;
    }
    { const m = island.drama; drama.n++; drama.kinds += m.kinds; drama.distinct += m.distinct; drama.repeats += m.repeats; drama.arcs += m.arcs; drama.worst = Math.max(drama.worst, m.repeats); for (const k in m.loops) drama.loops[k] = (drama.loops[k] || 0) + m.loops[k]; }
    for (const k of ['n', 'author', 'against', 'cause', 'viaPower', 'reforms']) laws[k] += island.laws[k]; for (const k in island.laws.kinds) laws.kinds[k] = (laws.kinds[k] || 0) + island.laws.kinds[k];
    for (const k in life) life[k] += island.life[k] || 0;
    for (const k in tb) { tb[k][0] += island.tb[k][0]; tb[k][1] += island.tb[k][1]; }
    for (const k in obs) obs[k] += island.obs[k];
    cul.peoples.push(island.peoples); cul.inPeople += island.peopleVillages; cul.villages += island.villagesNow; cul.pairs += island.kin.pairs; cul.same += island.kin.same;
    myth.n.push(island.myth.n); for (const k of ['linked', 'diffs', 'withDiff', 'versions', 'steps']) myth[k] += island.myth[k];
    mem.places.push(island.places); mem.alive += island.memAlive; mem.grudgeYears += island.grudge.years; mem.grudgeHot += island.grudge.hot;
    for (const k of ['marPeopleSame', 'marPeopleDiff', 'cultChanges', 'cult_borrowed', 'cult_apart', 'cult_migrants', 'cult_enemy', 'cult_new', 'peoplesBorn', 'mythTravel', 'tabooBroken', 'myths', 'retold', 'mythMerged', 'mythRewritten', 'mythCarried', 'cursed', 'memories', 'forgotten', 'mounds', 'massGraves', 'stones', 'memorials', 'namedFor', 'grudgeHeld', 'dreadAvoided', 'unburied']) memSt[k] = (memSt[k] || 0) + (st[k] || 0);
    for (const k in st.memLife || {}) { mem.life[k][0] += st.memLife[k][0]; mem.life[k][1] += st.memLife[k][1]; }
    if (st.clock) { clock.all += st.clock.all; clock.timed += st.clock.timed; st.clock.day.forEach((n, d) => { clock.day[d] += n; }); }
    for (const k in st.dur || {}) { const x = dur[k] || (dur[k] = [0, 0]); x[0] += st.dur[k][0]; x[1] += st.dur[k][1]; }
    memory += island.memory / W;
    { const h = island.hist; for (const k of ['changes', 'caused', 'drift', 'villageYears']) hist[k] += h[k]; hist.dynLen.push(...h.dynLen); hist.dynGen.push(...h.dynGen); hist.vassLen.push(...h.vassLen); hist.kinds.push(h.kinds.length); hist.kindsCaused.push(h.kindsCaused.length);
      for (const [f, e] of h.states) { hist.stBorn++; if (e) { hist.stFell++; hist.stLen.push((e - f) / 360); } } }
    for (const k in power) power[k] += island.power[k]; heredBy.push(island.power.vy ? Math.round(100 * island.power.hered / island.power.vy) : 0);
    for (const key of causes) tot[key] = (tot[key] || 0) + (st[key] || 0);
    for (const key in st) if (key.startsWith('case_')) caseN[key] = (caseN[key] || 0) + st[key];
    for (const key in island.bondK) bondK[key] = (bondK[key] || 0) + island.bondK[key];
    mergeRefs(refK, island.refK);
    mergeRefs(bondRef, island.bondRef);
    B += st.births || 0;
    CD += st.childDeaths || 0;
    customN += st.customs || 0;
    minPop = Math.min(minPop, island.minPop);
    memoryMoves += st.aidMemoryMoves || 0;
    sponsoredMoves += st.aidSponsoredMoves || 0;
    aidReturned += st.aidReturned || 0;
    aidChanged += st.aidMemoryChanged || 0;
    allV.push(...villages);
    vMed.push(med(villages));
    vSmall.push(villages.filter(v => v < 5).length);
    console.log(`seed ${history.seed}: population by 20y ${pops.join('/')}, coups ${st.coups || 0}, wars ${st.wars || 0}, births/1000/yr ${cbr.toFixed(0)}, adults now ${adults}, villages ${villages.join(',')}`);
  });
  const { famN, houseN, villN, roofN, lodgerN, customW, customI, bondN, adultN, feuds, feudsNamed } = totals;
  const sum = Object.values(tot).reduce((s, x) => s + x, 0) || 1;
  console.log('\nadult deaths by cause: ' + causes.map(k => `${label[k]} ${Math.round(tot[k] / sum * 100)}%`).join(', '));
  const sh = (...ks) => (ks.reduce((q, k) => q + (tot[k] || 0), 0) / sum * 100).toFixed(1);
  const pc1 = (a, b) => b ? +(100 * a / b).toFixed(1) : null;
  const rec = { model: SIM.MODEL.v, date: new Date().toISOString().slice(0, 10), islands: W, years: Y, offset: OFF, deaths: { war: +sh('war'), waterSea: +sh('drown', 'lostAtSea'), hunger: +sh('burnout'), oldAgeSickness: +sh('death', 'sick') }, minPop };
  console.log(`groups: war ${sh('war')}%, water and sea ${sh('drown', 'lostAtSea')}%, hunger ${sh('burnout')}%, old age + sickness ${sh('death', 'sick')}%; lowest island population after year 10: ${minPop}`);
  console.log(`villages (adults): median over all islands ${med(allV)}, median by island ${vMed.join(' ')}; villages under 5 adults by island ${vSmall.join(' ')}`);
  console.log(`households: living houses per family ${(houseN / Math.max(1, famN)).toFixed(2)} (${houseN} houses, ${famN} families); villagers under a roof ${Math.round(roofN / Math.max(1, villN) * 100)}%, living with kin or as hands ${Math.round(lodgerN / Math.max(1, villN) * 100)}%`);
  { const cs = caseN;
    console.log(`disputes: inheritance — house to the eldest ${cs.case_inherit_eldest || 0}, shared ${cs.case_inherit_share || 0}; blood — revenge ${cs.case_blood_revenge || 0}, blood money ${cs.case_blood_wergild || 0}; customs formed ${customN} (wergild ${customW}, inheritance ${customI})`); }
  { const pc = (o, k) => o[k] ? `${k} ${Math.round(o[k][1] / o[k][0] * 100)}%` : `${k} -`;
    console.log(`linked chronicle (share with a cause): ${['coup', 'deposed', 'exiled', 'quit', 'feud', 'revenge', 'marry', 'house', 'inheritHouse', 'dispute', 'wergild', 'aidReceived', 'client'].map(k => pc(refK, k)).join(', ')}; ties: ${['enemy', 'sworn', 'rival', 'debt', 'love', 'friend'].map(k => pc(bondRef, k)).join(', ')}`); }
  console.log(`bonds: ${(bondN / Math.max(1, adultN)).toFixed(1)} per adult (${Object.entries(bondK).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}); enmities (trust < -0.3) with a named cause ${Math.round(feudsNamed / Math.max(1, feuds) * 100)}% of ${feuds}`);
  { const K = arcs.kinds, line = Object.keys(K).sort().map(k => `${k} ${Object.entries(K[k]).sort((p, q) => q[1] - p[1]).map(([o, n]) => `${o} ${n}`).join('/')}`).join('; ');
    console.log(`arcs: adults over 40 with a finished arc ${percent(arcs.lived, arcs.old)} (${arcs.lived}/${arcs.old}); kept arcs with opening and ending in the chronicle ${coverage(arcs.linked, arcs.closed)}, still open ${arcs.open}, cut short by a death with no funeral ${arcs.lost}; by kind and outcome: ${line}`); }
  { const d = drama, n = Math.max(1, d.n), loops = Object.entries(d.loops).sort((p, q) => q[1] - p[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(', ');
    console.log(`drama of the top 20 lives per island: ${(d.kinds / n).toFixed(1)} kinds of turn per life, ${(d.distinct / n).toFixed(0)} across the 20; repeats ${Math.round(d.repeats / n * 100)}% (worst island ${Math.round(d.worst * 100)}%); with a finished arc ${Math.round(d.arcs / n * 100)}%; loops (a turn 3+ times in one life, lives): ${loops || 'none'}`); }
  console.log(`power (village-years from year 40, villages of 5+): hereditary ${percent(power.hered, power.vy)} (by island ${heredBy.join(' ')}%; held by a line ${percent(power.byLine, power.hered)}), assembly ${percent(power.assembly, power.vy)}, an overlord or vassals ${percent(power.above, power.vy)}; struggles for power naming the sides ${coverage(power.named, power.fights)}`);
  console.log(`laws: ${laws.n} (${Object.entries(laws.kinds).sort((p, q) => q[1] - p[1]).map(([k, v]) => `${k} ${v}`).join(', ')}); with an author ${percent(laws.author, laws.n)}, with an opponent ${percent(laws.against, laws.n)}, with a cause ${percent(laws.cause, laws.n)} (of them only the ruler's way to power ${percent(laws.viaPower, laws.cause)}); reforms in the chronicle ${(laws.reforms / Math.max(1, W)).toFixed(1)} per island`);
  console.log(`power in daily life: adults over 30 with a political line and its cause (besides quitting and a war band) ${percent(life.pol, life.old)}; villages with dependants (clients, bondsmen) ${percent(life.dep, life.vy)} of village-years; hungry winters when the leader opened his store ${life.kept}, kept taking his share ${life.broken}; adults over 40 whose character changed with life ${percent(life.tempered, life.old40)}`);
  { const h = hist, m = a => a.length ? med(a).toFixed(0) : '-';
    console.log(`regime as history: changes ${h.changes} (with a cause ${h.caused}, drifting ten years ${h.drift}; drifting per village per 40 years ${(h.drift / Math.max(1, h.villageYears) * 40).toFixed(2)}); kinds of regime by island at the end ${h.kinds.join(' ')} (reached by a change with a cause ${h.kindsCaused.join(' ')}); dynasties ended ${h.dynLen.length}, median ${m(h.dynLen)} years, ${percent(h.dynGen.filter(x => x >= 3).length, h.dynGen.length)} after 3+ generations; subjection ended ${h.vassLen.length} times, median ${m(h.vassLen)} years; states born ${h.stBorn}, fell ${h.stFell}, median life ${m(h.stLen)} years`); }
  { const h = x => x[1] ? (x[0] / x[1]).toFixed(1) : '-';
    console.log(`time budget: work hours a day with a walk under 30 min ${h(tb.near)}, over 1.5 h ${h(tb.far)}; productive hours per adult in villages with a well ${h(tb.well)}, without ${h(tb.nowell)}`); }
  { const busiest = Math.max(...clock.day), bd = clock.day.indexOf(busiest), m = k => dur[k] && dur[k][1] ? Math.round(dur[k][0] / dur[k][1]) : '-';
    const half = Math.round(Math.log(0.5) / Math.log(1 - (0.01 + 0.07 * (1 - memory))));
    console.log(`observer (Н2): rites and skirmishes in the common feed over 40 years ${(obs.feed / W).toFixed(1)} per island, shown ${(obs.shown / W).toFixed(1)} (${obs.shown ? (obs.feed / obs.shown).toFixed(1) : '-'} times fewer); family events in «my story» ${percent(obs.famIn, obs.famEv)} of ${obs.famEv}; daughters' weddings ${percent(obs.dauIn, obs.dau)} of ${obs.dau}`);
    Object.assign(rec, { feedRites: +(obs.shown / W).toFixed(1), familyInStory: pc1(obs.famIn, obs.famEv), daughterWeddings: pc1(obs.dauIn, obs.dau) });
    { const per = k => ((memSt[k] || 0) / W).toFixed(1), life = k => mem.life[k][1] ? `${(mem.life[k][0] / mem.life[k][1]).toFixed(0)} y (${mem.life[k][1]})` : '-';
      console.log(`memory (К1): named places per island ${(mem.places.reduce((s, x) => s + x, 0) / W).toFixed(1)} (by island ${mem.places.join(' ')}); memories made ${per('memories')}, alive at the end ${(mem.alive / W).toFixed(1)}, forgotten ${per('forgotten')} per island; mounds ${per('mounds')}, mass graves ${per('massGraves')}, stones ${per('stones')}, memorial days kept ${per('memorials')}, named after the remembered ${per('namedFor')}, unburied ${per('unburied')}; enmity held by memory ${per('grudgeHeld')} village-pair months; settlers kept from a feared place ${per('dreadAvoided')}; years with enmity within 15 years after a battle with dead ${percent(mem.grudgeHot, mem.grudgeYears)}; memory lasted when forgotten: bare ${life('bare')}, with a place ${life('place')}, with a monument ${life('mon')}`);
      const nm = myth.n.reduce((s, x) => s + x, 0);
      console.log(`myths (К2): legends alive at the end ${(nm / W).toFixed(1)} per island (by island ${myth.n.join(' ')}), born ${per('myths')}, retold ${per('retold')}; opening the true event ${percent(myth.linked, nm)}; with listed differences from the truth ${percent(myth.withDiff, nm)} (${nm ? (myth.diffs / nm).toFixed(1) : '-'} per legend, mean retelling ${nm ? (myth.steps / nm).toFixed(1) : '-'}); events told in two or more different tellings ${(myth.versions / W).toFixed(1)} per island; merged into a Great War ${per('mythMerged')}, rewritten by a new ruler ${per('mythRewritten')}, carried to a daughter village ${per('mythCarried')}, haunted places ${per('cursed')}`);
      const ms = memSt.marPeopleSame || 0, md = memSt.marPeopleDiff || 0, np = cul.peoples.reduce((s, x) => s + x, 0);
      console.log(`cultures (К3): peoples at the end ${(np / W).toFixed(1)} per island (by island ${cul.peoples.join(' ')}), villages in a people ${percent(cul.inPeople, cul.villages)}; peoples born ${per('peoplesBorn')}; marriages between villages of known peoples within one people ${percent(ms, ms + md)} against ${percent(cul.same, cul.pairs)} by chance among neighbours; culture changes ${per('cultChanges')} per island (borrowed ${per('cult_borrowed')}, from newcomers ${per('cult_migrants')}, against an enemy ${per('cult_enemy')}, new ${per('cult_new')}), splits that changed the culture ${per('cult_apart')}; legends passed between villages of one people ${per('mythTravel')}; goat taboo broken in hunger ${per('tabooBroken')}`);
      Object.assign(rec, { peoplesPerIsland: +(np / W).toFixed(1), endogamy: pc1(ms, ms + md), endogamyChance: pc1(cul.same, cul.pairs) });
      Object.assign(rec, { mythsPerIsland: +(nm / W).toFixed(1), mythVersions: +(myth.versions / W).toFixed(1), mythWithDiff: pc1(myth.withDiff, nm) });
      Object.assign(rec, { placesPerIsland: +(mem.places.reduce((s, x) => s + x, 0) / W).toFixed(1), grudgeAfterBattle: pc1(mem.grudgeHot, mem.grudgeYears), namedFor: +per('namedFor') }); }
    console.log(`event clock: with an hour ${percent(clock.timed, clock.all)} of ${clock.all} events; busiest day of the month ${bd} with ${percent(busiest, clock.all)}`);
    console.log('durations (days, model | real reference):');
    for (const [name, v, ref] of [['pregnancy', m('preg'), '266 from conception'], ['house', m('build_house'), 'a hut or a log house by a family with help: 14-60'],
      ['well', m('build_well'), 'a hand-dug well: 7-30'], ['granary', m('build_granary'), '14-30'], ['workshop', m('build_workshop'), '14-45'], ['palisade', m('build_palisade'), 'a village stockade: 30-90'],
      ['bridge', m('build_bridge'), 'a timber footbridge: 14-60'], ['fishing boat', m('build_fboat'), 'a dugout or plank boat: 30-60'], ['war campaign', m('campaign'), 'a raid or a war party: 2-30'],
      ['mourning', '3 + a widow\'s year 360', 'burial on the third day; a year of mourning for a widow'], ['trust between people', `halves in ${half} months`, 'no single figure: fades without contact'],
      ['tyrant\'s line remembered', '30 years', 'about a generation']]) console.log(`  ${name}: ${v} | ${ref}`);
    Object.assign(rec, { timedEvents: pc1(clock.timed, clock.all), busiestDay: pc1(busiest, clock.all), pregnancy: m('preg'), houseDays: m('build_house'), campaignDays: m('campaign') }); }
  console.log(`child mortality before 15 (deaths/births in window): ${(CD / Math.max(1, B)).toFixed(2)}`);
  Object.assign(rec, { childMortality: +(CD / Math.max(1, B)).toFixed(2), medianVillage: med(allV), housesPerFamily: +(houseN / Math.max(1, famN)).toFixed(2),
    bondsPerAdult: +(bondN / Math.max(1, adultN)).toFixed(1), arcsOver40: pc1(arcs.lived, arcs.old), dramaRepeats: drama.n ? Math.round(drama.repeats / drama.n * 100) : null,
    hereditary: pc1(power.hered, power.vy), assembly: pc1(power.assembly, power.vy), overlord: pc1(power.above, power.vy),
    lawsAuthor: pc1(laws.author, laws.n), lawsOpponent: pc1(laws.against, laws.n), lawsCause: pc1(laws.cause, laws.n),
    politicalOver30: pc1(life.pol, life.old), dependants: pc1(life.dep, life.vy), characterChanged: pc1(life.tempered, life.old40),
    driftPer40: +(hist.drift / Math.max(1, hist.villageYears) * 40).toFixed(2), workNear: tb.near[1] ? +(tb.near[0] / tb.near[1]).toFixed(1) : null, workFar: tb.far[1] ? +(tb.far[0] / tb.far[1]).toFixed(1) : null });
  console.log(`grain memories: ${memoryMoves} moves changed (${sponsoredMoves} through sponsorship), ${aidReturned} gifts returned (${aidChanged} decisions changed)`);
  console.log(`mean adult age at death (15+): ${age.deaths ? (age.sum / age.deaths).toFixed(1) + ' years, n=' + age.deaths : 'n/a'}`);
  console.log(age.eligible
    ? `survived to 60 (island-born): ${(100 * age.reached / age.eligible).toFixed(1)}% (${age.reached}/${age.eligible}; ${age.left} left before 60)`
    : 'survived to 60 (island-born): n/a (no eligible birth cohort)');
  console.log('targets: child mortality 0.30-0.50; war 5-12%; water and sea < 5%; hunger < 10%; old age + sickness > 60%; births 30-50 per 1000 per year; no island dies out; median village >= 15 adults, at most 2 villages under 5 per island; 2-5 bonds per adult, >= 30% of enmities with a cause; 0.8-1.2 living houses per family; >= 30% of adults over 40 with a finished arc; top 20 lives: >= 25 kinds of turn across them, repeats < 45%; hereditary rule 35-75% of village-years, assembly 10-35%, an overlord or vassals 20-60% (POLITICS.md); laws: >= 80% with an author and an opponent, >= 80% with a cause; >= 50% of adults over 30 with a political line, dependants in 25-60% of villages; regime drifting at most once per village per 40 years, >= 2 kinds of regime per island');

  console.log('\nИстория островов');
  let sheltersLinked = 0;
  for (const island of islandHistory) {
    const { seed, deaths, hunger, trades, activeTradeLinks, peakTradeLinks, wars, regimeChanges, states, shelterCases } = island;
    sheltersLinked += island.sheltersLinked;
    console.log(`сид ${seed}: голод ${percent(hunger, deaths)} (${hunger}/${deaths}), сделки ${trades}, повторные торговые связи ${activeTradeLinks} (пик ${peakTradeLinks}), войны ${wars}, смены строя ${regimeChanges}, новые государства ${states}, приют со ссылкой ${coverage(island.sheltersLinked, shelterCases)}`);
  }
  console.log(`Приют после помощи зерном с подтверждённой ссылкой: ${coverage(sheltersLinked, memoryMoves)}`);
  if (SAVE) {
    const dir = new URL('../docs/audits/', import.meta.url);
    mkdirSync(dir, { recursive: true });
    const name = `${rec.model}-${W}x${Y}${OFF ? `-o${OFF}` : ''}.json`;
    writeFileSync(new URL(name, dir), JSON.stringify(rec, null, 2) + '\n');
    console.log(`saved docs/audits/${name}; rebuild the table with: node tools/audits-table.mjs`);
  }
}

if (isMainThread) await main();
