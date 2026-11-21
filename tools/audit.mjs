// Audit of demography, island history and chronicle links.
// Usage: node tools/audit.mjs [worlds=6] [years=80]
import { createRequire } from 'node:module';
import { isMainThread } from 'node:worker_threads';
import { runIslands } from './islands.mjs';
const require = createRequire(import.meta.url);
const SIM = require('../dist/sim.cjs');
const W = +(process.argv[2] || 6), Y = +(process.argv[3] || 80);
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
  const seed = 5000 + i * 7919, S = SIM.newWorld(seed, {}), pops = [];
  const lastBirthTick = Math.max(0, (years - 60) * 360);
  const ages = S.ageAudit = { lastBirthTick, adultDeaths: 0, ageAtDeath: 0, reached60: 0, leftBefore60: 0 };
  let cohortBirths = 0, peakTradeLinks = 0, activeTradeLinks = 0;
  let shelterCases = 0, sheltersLinked = 0;
  // power (П1): village-years from year 40 with hereditary rule, an assembly, an overlord or a vassal; and whether the
  // struggles for power (elections, coups, splits) name the sides that stood behind each man
  const power = { vy: 0, hered: 0, assembly: 0, above: 0, fights: 0, named: 0, byLine: 0 };
  // laws (П2): every law event, and how many name an author, an opponent and a cause; reforms in the chronicle
  const laws = { n: 0, author: 0, against: 0, cause: 0, viaPower: 0, reforms: 0, kinds: {} };
  let seenEv = 0;
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
    for (const e of S.events) { if (e.id <= seenEv) break; if (e.type === 'reform') laws.reforms++; if (e.type === 'law' || e.type === 'gov' || e.law) { laws.n++; laws.kinds[e.law || e.type] = (laws.kinds[e.law || e.type] || 0) + 1; if (e.author) laws.author++; if (e.against && e.against.length) laws.against++; if (e.causes && e.causes.length) laws.cause++; if (e.via === 'power') laws.viaPower++; } if (e.type === 'coup' || e.type === 'schism' || e.type === 'crisis' || (e.type === 'succession' && !/По праву/.test(e.text))) { power.fights++; if (e.sides) power.named++; } }
    if (S.events[0]) seenEv = Math.max(seenEv, S.events[0].id);
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
  // drama of the top 20 lives (the Fates tab): variety of turns, finished arcs, repeats and the loops behind them
  const drama = SIM.dramaMeasure(SIM.topFates(S, 20));
  for (const k in st) if (k.startsWith('arc_')) { const [, kind, out] = k.split('_'); const o = arcs.kinds[kind] || (arcs.kinds[kind] = {}); o[out] = (o[out] || 0) + st[k]; }
  return { history, st, arcs, drama, power, laws, pops, villages, cbr, adults: adults.length, age, minPop,
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
  console.log(`child mortality before 15 (deaths/births in window): ${(CD / Math.max(1, B)).toFixed(2)}`);
  console.log(`grain memories: ${memoryMoves} moves changed (${sponsoredMoves} through sponsorship), ${aidReturned} gifts returned (${aidChanged} decisions changed)`);
  console.log(`mean adult age at death (15+): ${age.deaths ? (age.sum / age.deaths).toFixed(1) + ' years, n=' + age.deaths : 'n/a'}`);
  console.log(age.eligible
    ? `survived to 60 (island-born): ${(100 * age.reached / age.eligible).toFixed(1)}% (${age.reached}/${age.eligible}; ${age.left} left before 60)`
    : 'survived to 60 (island-born): n/a (no eligible birth cohort)');
  console.log('targets: child mortality 0.30-0.50; war 5-12%; water and sea < 5%; hunger < 10%; old age + sickness > 60%; births 30-50 per 1000 per year; no island dies out; median village >= 15 adults, at most 2 villages under 5 per island; 2-5 bonds per adult, >= 30% of enmities with a cause; 0.8-1.2 living houses per family; >= 30% of adults over 40 with a finished arc; top 20 lives: >= 25 kinds of turn across them, repeats < 45%; hereditary rule 35-75% of village-years, assembly 10-35%, an overlord or vassals 20-60% (POLITICS.md); laws: >= 80% with an author and an opponent, >= 80% with a cause');

  console.log('\nИстория островов');
  let sheltersLinked = 0;
  for (const island of islandHistory) {
    const { seed, deaths, hunger, trades, activeTradeLinks, peakTradeLinks, wars, regimeChanges, states, shelterCases } = island;
    sheltersLinked += island.sheltersLinked;
    console.log(`сид ${seed}: голод ${percent(hunger, deaths)} (${hunger}/${deaths}), сделки ${trades}, повторные торговые связи ${activeTradeLinks} (пик ${peakTradeLinks}), войны ${wars}, смены строя ${regimeChanges}, новые государства ${states}, приют со ссылкой ${coverage(island.sheltersLinked, shelterCases)}`);
  }
  console.log(`Приют после помощи зерном с подтверждённой ссылкой: ${coverage(sheltersLinked, memoryMoves)}`);
}

if (isMainThread) await main();
