/* ---------- search the retained chronicle ---------- */
const archiveQuery = $('archive-query');
const archiveStatus = $('archive-status');
const archiveCases = ['genitive', 'dative', 'accusative', 'instrumental', 'prepositional'];
const archiveResultLimit = 30;
let archiveSearch = null;

function resetArchiveSearch() {
  archiveSearch = null;
  archiveQuery.value = '';
  archiveStatus.textContent = '';
}

function buildArchiveIndex(events) {
  const now = clockNow();
  const records = new Map();
  for (const event of Object.values(S.evArch || {})) {
    if (SIM.eventTime(event) <= now) records.set(event.id, event);
  }
  for (const event of events) records.set(event.id, event);

  const people = new Map();
  for (const person of [...(S.legends || []), ...S.kids, ...S.agents]) people.set(person.id, person);
  const namesById = new Map();
  function names(id) {
    if (!namesById.has(id)) {
      const person = people.get(id);
      const forms = person?.name
        ? new Set([person.name, ...archiveCases.map(padezh => SIM.nameCase(person, padezh))])
        : [];
      namesById.set(id, [...forms].join(' '));
    }
    return namesById.get(id);
  }

  const index = new MiniSearch({
    fields: ['text', 'names', 'reason', 'type'],
    processTerm: term => term.toLowerCase().replaceAll('ё', 'е'),
    searchOptions: {
      combineWith: 'AND',
      boost: { text: 3, names: 2, type: 2 },
      fuzzy: term => term.length >= 8 ? 2 : term.length >= 4 ? 1 : false,
      prefix: (term, position, terms) => term.length >= 3 && position === terms.length - 1,
    },
  });
  index.addAll([...records.values()].map(event => ({
    id: event.id,
    text: event.text,
    names: [...new Set([...(event.who || []), event.author, ...(event.against || [])])]
      .map(names).filter(Boolean).join(' '),
    reason: event.why,
    type: TL[event.type],
  })));
  return { index, records };
}

function showArchiveSearch(events, query) {
  const stamp = [S.seed, S.evId, Math.floor(S.tick / 360), events[0]?.id].join(':');
  const now = performance.now();
  const changedQuery = archiveSearch?.query !== query;
  if (!archiveSearch || (stamp !== archiveSearch.stamp && (changedQuery || now >= archiveSearch.refreshAfter))) {
    archiveSearch = { ...buildArchiveIndex(events), stamp, refreshAfter: now + 750 };
  }
  if (archiveSearch.query === query) return;

  const { index, records } = archiveSearch;
  const results = index.search(query).sort((a, b) => b.score - a.score ||
    SIM.eventTime(records.get(b.id)) - SIM.eventTime(records.get(a.id)) || b.id - a.id);
  archiveSearch.query = query;
  archiveStatus.textContent = results.length
    ? `Найдено: ${results.length}${results.length > archiveResultLimit ? ` · показано ${archiveResultLimit}` : ''}`
    : 'В хронике ничего не найдено.';
  $('log').innerHTML = results.slice(0, archiveResultLimit).map(result => chronicleEntry(records.get(result.id))).join('');
}

archiveQuery.addEventListener('input', () => updateChronicle(true));
