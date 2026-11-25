/* ---------- observer: the causes recorded for an event ---------- */
const CAUSE_MAP_LIMIT = 7;

function collectCauses(root) {
  const events = new Map([[root.id, root]]);
  const edges = [];
  let clipped = false;
  for (const effect of events.values()) {
    for (const id of new Set(effect.causes || [])) {
      const cause = visibleEvent(id);
      if (!cause || cause.id >= effect.id) continue;
      if (!events.has(id)) {
        if (events.size >= CAUSE_MAP_LIMIT) { clipped = true; continue; }
        events.set(id, cause);
      }
      edges.push({ cause: id, effect: effect.id });
    }
  }
  return { events, edges, clipped };
}

function drawCauseMap(viewport, root, active) {
  const { events, edges, clipped } = collectCauses(root);
  const graph = new causeDagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'BT', ranksep: 26, nodesep: 12, marginx: 8, marginy: 8 });
  graph.setDefaultEdgeLabel(() => ({}));
  const width = Math.min(184, Math.max(134, Math.floor((viewport.clientWidth - 28) / 2)));
  for (const ev of events.values()) graph.setNode(String(ev.id), { width, height: 78 });
  for (const edge of edges) graph.setEdge(String(edge.cause), String(edge.effect));
  causeDagre.layout(graph);

  const size = graph.graph();
  const lines = graph.edges().map(edge => {
    const points = graph.edge(edge).points.map(p => p.x + ',' + p.y).join(' ');
    return '<polyline points="' + points + '" marker-end="url(#causeArrow)"></polyline>';
  }).join('');
  const cards = [...events.values()].map(ev => {
    const id = String(ev.id);
    const n = graph.node(id);
    return `<button type="button" class="cause-node" data-cause-node="${id}" ${ev.id === active.id ? 'aria-current="step"' : ''}
      style="left:${n.x - n.width / 2}px;top:${n.y - n.height / 2}px;width:${n.width}px;height:${n.height}px"
      title="${esc(ev.text)}"><time>${eventDate(ev)}</time><span>${esc(ev.text)}</span></button>`;
  }).join('');

  viewport.innerHTML = `<div class="cause-diagram" style="width:${size.width}px;height:${size.height}px">
    <svg aria-hidden="true" width="${size.width}" height="${size.height}">
      <defs><marker id="causeArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L8 4 L0 8 Z"></path></marker></defs>
      ${lines}</svg>${cards}</div>`;
  const info = viewport.parentElement.querySelector('.cause-more');
  info.hidden = !clipped;
  const selected = viewport.querySelector('[aria-current="step"]');
  if (selected) {
    viewport.scrollLeft = selected.offsetLeft + (selected.offsetWidth - viewport.clientWidth) / 2;
    viewport.scrollTop = Math.min(selected.offsetTop, Math.max(0, selected.offsetTop + selected.offsetHeight - viewport.clientHeight));
  }
}
