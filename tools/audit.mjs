// Audit of demography, island history and chronicle links.
// Usage: node tools/audit.mjs [worlds=6] [years=80]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const SIM = require('../dist/sim.cjs');
const W = +(process.argv[2] || 6), Y = +(process.argv[3] || 80);
console.log(`model ${SIM.MODEL.v} (${SIM.MODEL.date}), ${W} islands x ${Y} years`);
const causes = ['death', 'sick', 'burnout', 'war', 'plague', 'drown', 'lostAtSea', 'killed'];
const label = { death: 'old age', sick: 'sickness', burnout: 'hunger', war: 'war', plague: 'plague', drown: 'drowning', lostAtSea: 'lost at sea', killed: 'murder' };
const refK = {}, bondRef = {}; let famN = 0, houseN = 0, villN = 0, roofN = 0, lodgerN = 0, customN = 0, customW = 0, customI = 0; const caseN = {};
const tot = {}; let B = 0, CD = 0, minPop = Infinity, bondN = 0, adultN = 0, feuds = 0, feudsNamed = 0; const bondK = {}; const allV = [], vMed = [], vSmall = [];
let st0;
const med = a => { const x = a.slice().sort((p, q) => p - q); return x.length ? x[Math.floor((x.length - 1) / 2)] : 0; };
let memoryMoves = 0, sponsoredMoves = 0, aidReturned = 0, aidChanged = 0;
const age = { deaths: 0, sum: 0, eligible: 0, reached: 0, left: 0 };
const lastBirthTick = Math.max(0, (Y - 60) * 360);
const islandHistory = [];
const arcs = { old: 0, lived: 0, closed: 0, linked: 0, open: 0, kinds: {} };

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

for (let i = 0; i < W; i++) {
  const seed = 5000 + i * 7919, S = SIM.newWorld(seed, {}), pops = [];
  const ages = S.ageAudit = { lastBirthTick, adultDeaths: 0, ageAtDeath: 0, reached60: 0, leftBefore60: 0 };
  let cohortBirths = 0, peakTradeLinks = 0, activeTradeLinks = 0;
  let shelterCases = 0, sheltersLinked = 0;
  for (let y = 1; y <= Y; y++) {
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
    if (y >= 10) minPop = Math.min(minPop, SIM.popOf(S));
  }
  const aliveAt60 = S.agents.filter(a => a.bornT > 0 && a.bornT <= lastBirthTick).length;
  age.deaths += ages.adultDeaths;
  age.sum += ages.ageAtDeath;
  age.eligible += cohortBirths - ages.leftBefore60;
  age.left += ages.leftBefore60;
  age.reached += ages.reached60 + aliveAt60;
  const st = S.stats; B += st.births || 0; CD += st.childDeaths || 0;
  const deaths = causes.reduce((total, kind) => total + (st[kind] || 0), 0);
  islandHistory.push({
    seed, deaths, hunger: st.burnout || 0, trades: st.trades || 0, activeTradeLinks, peakTradeLinks,
    wars: st.wars || 0, regimeChanges: S.evc?.regime || 0, states: st.states || 0,
    shelterCases, sheltersLinked,
  });
  memoryMoves += st.aidMemoryMoves || 0;
  sponsoredMoves += st.aidSponsoredMoves || 0;
  aidReturned += st.aidReturned || 0;
  aidChanged += st.aidMemoryChanged || 0;
  for (const k of causes) tot[k] = (tot[k] || 0) + (st[k] || 0);
  const adults = S.agents.filter(a => !a.kid), cbr = (st.births || 0) / Y / Math.max(1, pops.reduce((s, x) => s + x, 0) / pops.length) * 1000;
  const villages = S.groups.filter(g => g.home).map(g => g.members.length).sort((a, b) => b - a);
  for (const a of S.agents) { if (a.age < 16) continue; adultN++; const bs = a.bonds || {}; for (const id in bs) { bondN++; bondK[bs[id][0]] = (bondK[bs[id][0]] || 0) + 1; } for (const id in a.trust) if (a.trust[id] < -0.3 && S._a.has(+id)) { feuds++; if (bs[id] && (bs[id][0] === 'enemy' || bs[id][0] === 'rival') && bs[id][3]) feudsNamed++; } }
  for (const g of S.groups) if (g.home) { famN += g.wantH || 0; houseN += g.houses.filter(h => !h.ruined).length; for (const id of g.members) { const a = S._a.get(id); villN++; if (a.shel) roofN++; if (a.lodger) lodgerN++; } }
  for (const k in st0 = S.stats) if (k.startsWith('case_')) caseN[k] = (caseN[k] || 0) + st0[k];
  customN += S.stats.customs || 0; for (const g of S.groups) { if ((g.customs || {}).blood) customW++; if ((g.customs || {}).inherit) customI++; }
  // linked chronicle: share of lines and ties that point to the event behind them
  for (const B of S.agents.map(a => a.bio || []).concat((S.legends || []).map(l => l.bio))) for (const b of B) { const r = refK[b[1]] || (refK[b[1]] = [0, 0]); r[0]++; if (b[3]) r[1]++; }
  for (const a of S.agents) for (const id in a.bonds || {}) { const x = a.bonds[id]; if (x[4]) continue; const r = bondRef[x[0]] || (bondRef[x[0]] = [0, 0]); r[0]++; if (x[5]) r[1]++; }
  // goals and arcs: adults over 40 who lived through at least one finished arc (an ending other than death)
  for (const a of S.agents) if (a.age > 40) { arcs.old++; if ((a.goals || []).some(x => x.end && x.out !== 'died')) arcs.lived++; }
  for (const G of S.agents.map(a => a.goals || []).concat((S.legends || []).map(l => l.goals || []))) for (const x of G) {
    if (!x.end) { arcs.open++; continue; }
    arcs.closed++; if (x.ev && SIM.eventById(S, x.ev) && SIM.eventById(S, x.endEv)) arcs.linked++;
  }
  for (const k in st) if (k.startsWith('arc_')) { const [, kind, out] = k.split('_'); const o = arcs.kinds[kind] || (arcs.kinds[kind] = {}); o[out] = (o[out] || 0) + st[k]; }
  allV.push(...villages); vMed.push(med(villages)); vSmall.push(villages.filter(v => v < 5).length);
  console.log(`seed ${seed}: population by 20y ${pops.join('/')}, coups ${st.coups || 0}, wars ${st.wars || 0}, births/1000/yr ${cbr.toFixed(0)}, adults now ${adults.length}, villages ${villages.join(',')}`);
}
const sum = Object.values(tot).reduce((s, x) => s + x, 0) || 1;
console.log('\nadult deaths by cause: ' + causes.map(k => `${label[k]} ${Math.round(tot[k] / sum * 100)}%`).join(', '));
const sh = (...ks) => (ks.reduce((q, k) => q + (tot[k] || 0), 0) / sum * 100).toFixed(1);
console.log(`groups: war ${sh('war')}%, water and sea ${sh('drown', 'lostAtSea')}%, hunger ${sh('burnout')}%, old age + sickness ${sh('death', 'sick')}%; lowest island population after year 10: ${minPop}`);
console.log(`villages (adults): median over all islands ${med(allV)}, median by island ${vMed.join(' ')}; villages under 5 adults by island ${vSmall.join(' ')}`);
console.log(`households: living houses per family ${(houseN / Math.max(1, famN)).toFixed(2)} (${houseN} houses, ${famN} families); villagers under a roof ${Math.round(roofN / Math.max(1, villN) * 100)}%, living with kin or as hands ${Math.round(lodgerN / Math.max(1, villN) * 100)}%`);
{ const cs = {}; let cust = 0, villages = 0; for (const k of Object.keys(caseN)) cs[k] = caseN[k];
  console.log(`disputes: inheritance — house to the eldest ${cs.case_inherit_eldest || 0}, shared ${cs.case_inherit_share || 0}; blood — revenge ${cs.case_blood_revenge || 0}, blood money ${cs.case_blood_wergild || 0}; customs formed ${customN} (wergild ${customW}, inheritance ${customI})`); }
{ const pc = (o, k) => o[k] ? `${k} ${Math.round(o[k][1] / o[k][0] * 100)}%` : `${k} -`;
  console.log(`linked chronicle (share with a cause): ${['coup', 'deposed', 'exiled', 'quit', 'feud', 'revenge', 'marry', 'house', 'inheritHouse', 'dispute', 'wergild', 'aidReceived', 'client'].map(k => pc(refK, k)).join(', ')}; ties: ${['enemy', 'sworn', 'rival', 'debt', 'love', 'friend'].map(k => pc(bondRef, k)).join(', ')}`); }
console.log(`bonds: ${(bondN / Math.max(1, adultN)).toFixed(1)} per adult (${Object.entries(bondK).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}); enmities (trust < -0.3) with a named cause ${Math.round(feudsNamed / Math.max(1, feuds) * 100)}% of ${feuds}`);
{ const K = arcs.kinds, line = Object.keys(K).sort().map(k => `${k} ${Object.entries(K[k]).sort((p, q) => q[1] - p[1]).map(([o, n]) => `${o} ${n}`).join('/')}`).join('; ');
  console.log(`arcs: adults over 40 with a finished arc ${percent(arcs.lived, arcs.old)} (${arcs.lived}/${arcs.old}); kept arcs with opening and ending in the chronicle ${coverage(arcs.linked, arcs.closed)}, still open ${arcs.open}; by kind and outcome: ${line}`); }
console.log(`child mortality before 15 (deaths/births in window): ${(CD / Math.max(1, B)).toFixed(2)}`);
console.log(`grain memories: ${memoryMoves} moves changed (${sponsoredMoves} through sponsorship), ${aidReturned} gifts returned (${aidChanged} decisions changed)`);
console.log(`mean adult age at death (15+): ${age.deaths ? (age.sum / age.deaths).toFixed(1) + ' years, n=' + age.deaths : 'n/a'}`);
console.log(age.eligible
  ? `survived to 60 (island-born): ${(100 * age.reached / age.eligible).toFixed(1)}% (${age.reached}/${age.eligible}; ${age.left} left before 60)`
  : 'survived to 60 (island-born): n/a (no eligible birth cohort)');
console.log('targets: child mortality 0.30-0.50; war 5-12%; water and sea < 5%; hunger < 10%; old age + sickness > 60%; births 30-50 per 1000 per year; no island dies out; median village >= 15 adults, at most 2 villages under 5 per island; 2-5 bonds per adult, >= 30% of enmities with a cause; 0.8-1.2 living houses per family; >= 30% of adults over 40 with a finished arc');

console.log('\nИстория островов');
let sheltersLinked = 0;
for (const island of islandHistory) {
  const { seed, deaths, hunger, trades, activeTradeLinks, peakTradeLinks, wars, regimeChanges, states, shelterCases } = island;
  sheltersLinked += island.sheltersLinked;
  console.log(`сид ${seed}: голод ${percent(hunger, deaths)} (${hunger}/${deaths}), сделки ${trades}, повторные торговые связи ${activeTradeLinks} (пик ${peakTradeLinks}), войны ${wars}, смены строя ${regimeChanges}, новые государства ${states}, приют со ссылкой ${coverage(island.sheltersLinked, shelterCases)}`);
}
console.log(`Приют после помощи зерном с подтверждённой ссылкой: ${coverage(sheltersLinked, memoryMoves)}`);
