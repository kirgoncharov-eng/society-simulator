/* Building projects reserve stock, then require work and supplies at the plot. */
const BUILD_FOOTPRINT = {
  house: [10, 10], workshop: [18, 13], granary: [10, 10], shrine: [10, 10], well: [9, 9], fboat: [12, 5],
};
const BUILD_PHASES = {
  house: [['ground', 0.22], ['frame', 0.65], ['roof', 1]],
  workshop: [['ground', 0.25], ['frame', 0.72], ['roof', 1]],
  granary: [['ground', 0.22], ['frame', 0.70], ['roof', 1]],
  shrine: [['ground', 0.25], ['frame', 0.72], ['roof', 1]],
  repair: [['clear', 0.25], ['frame', 0.65], ['roof', 1]],
  well: [['dig', 0.68], ['lining', 0.92], ['finish', 1]],
  bridge: [['ground', 0.22], ['supports', 0.68], ['deck', 1]],
  palisade: [['dig', 0.32], ['posts', 0.88], ['finish', 1]],
  fboat: [['ground', 0.16], ['frame', 0.70], ['finish', 1]],
};
function beginSite(S, g, site, wood = 0, stone = 0) {
  if (!site || g.site || g.wood < wood || (g.stone || 0) < stone) return false;
  if (wood) g.wood -= wood;
  if (stone) g.stone -= stone;
  const dims = BUILD_FOOTPRINT[site.kind];
  if (dims) site.footprint = { width: dims[0], depth: dims[1] };
  site.id = g.id + ':' + S.tick;
  site.started = S.tick;
  site.approvedBy = g.leader;
  site.materials = { wood, stone };
  site.delivered = { wood: 0, stone: 0 };
  site.phase = BUILD_PHASES[site.kind]?.[0][0];
  g.site = site;
  return true;
}
function siteMaterial(site) {
  if (!site.materials || site.prog < site.need * BUILD_PHASES[site.kind][0][1]) return null;
  return site.delivered.wood < site.materials.wood ? 'wood' : site.delivered.stone < site.materials.stone ? 'stone' : null;
}
function nearSite(a, point, radius = 11) { return Math.hypot(a.x - point.x, a.y - point.y) < radius; }
function siteTarget(g, worker) {
  const site = g.site, material = siteMaterial(site);
  if (!material) return site.kind === 'palisade' ? wallWorkPoint(site) : site;
  return worker.siteTrip?.id === site.id && worker.siteTrip.kind === material ? site : storeOf(g, material);
}
function wallWorkPoint(site) {
  const { segments } = site.layout;
  const active = Math.min(segments.length - 1, Math.floor(site.prog / site.need * segments.length));
  const { a, b } = segments[active];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function workSite(S, g, worker, effort) {
  const site = g.site;
  const material = siteMaterial(site);
  if (material) {
    if (worker.siteTrip?.id !== site.id || worker.siteTrip.kind !== material) {
      if (!nearSite(worker, storeOf(g, material), 7)) return false;
      worker.siteTrip = { id: site.id, kind: material };
    } else {
      if (!nearSite(worker, site, 7)) return false;
      site.delivered[material] = Math.min(site.materials[material], site.delivered[material] + CAP[material]);
      worker.siteTrip = null;
      updateSitePhase(site);
    }
    return true;
  }
  if (!nearSite(worker, siteTarget(g, worker))) return false;
  if (worker.siteTrip) worker.siteTrip = null;
  const phases = BUILD_PHASES[site.kind];
  if (!phases) { site.prog += effort; }
  else {
    const firstLimit = site.need * phases[0][1];
    const next = Math.min(site.need, site.prog + effort);
    site.prog = site.materials && site.prog < firstLimit ? Math.min(firstLimit, next) : next;
    updateSitePhase(site);
  }
  if (site.prog >= site.need) finishSite(S, g);
  return true;
}

function updateSitePhase(site) {
  const phases = BUILD_PHASES[site.kind];
  site.phase = siteMaterial(site) ? 'supply'
    : phases.find(([, end]) => site.prog < site.need * end)?.[0] || phases[phases.length - 1][0];
}
