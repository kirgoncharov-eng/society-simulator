/* ---------- myths: how what happened becomes what is told (К2, see docs/CULTURE.md) ---------- */
// A memory whose last witness has died becomes a legend. Every generation (about 25 years) retells it and the telling
// drifts (Bartlett 1932): numbers grow, the many shrink to one hero, causes turn moral, similar events merge into one
// (Vansina's telescoping), the ruling line claims the hero. A place whose story is forgotten but whose name lives on gets an
// explanation (an etiological myth). Gods, spirits and giants appear in the words only: the world has no magic.
// A new ruler may have a legend retold his way; the old version stays with the deposed line. Every legend keeps a link to
// the true event, and its differences from the truth are listed for the observer.
// g.myths: [{ id, ev, kind, tone, step, t, told, text, diff, hero, heroName, heroSex, heroLin, claimLin, villain, other,
//            otherName, place, placeName, merged, version, lin, src }]
const MYTH_STEP = 360 * 25;
const MYTH_MAX = 12;
const sexW = (sex, m, f) => sex === 'f' ? f : m;
function crowd(n, step) {
  if (step >= 3) return 'сотни';
  if (step === 2) return n > 1 ? 'многие' : 'многие';
  return n <= 1 ? 'один' : n === 2 ? 'двое' : n === 3 ? 'трое' : n === 4 ? 'четверо' : `${n} человек`;
}
const DEITY = { 'культ Реки': 'Река', 'культ Горы': 'Гора', 'культ Леса': 'Лес', 'культ Огня': 'Огонь', 'культ Предков': 'предки' };
const deityOf = src => DEITY[src.faith] || 'предки';
const angry = src => { const d = deityOf(src); return d === 'предки' ? 'гнев предков' : `гнев ${d === 'Река' ? 'Реки' : d === 'Гора' ? 'Горы' : d === 'Лес' ? 'Леса' : 'Огня'}`; };
// the hero as the subject of a sentence: «Исол, праматерь Миэличей,» — with the claimed line set off by commas
const subj = (h, claim, sex) => h ? `${h}${claim ? `, ${sexW(sex, 'предок', 'праматерь')} ${claim},` : ''}` : '';
const at = src => src.placeName ? `у места, что зовут ${src.placeName},` : '';
// how many were killed, in the accusative: «убили троих»
const killed = n => n <= 1 ? 'одного' : n === 2 ? 'двоих' : n === 3 ? 'троих' : n === 4 ? 'четверых' : `${n} человек`;

// the telling at a given step; returns { text, diff } — diff lists how the telling departs from the truth
function tellMyth(S, g, y) {
  const s = y.src, n = y.step, H = y.heroName, hs = y.heroSex, diff = [];
  const claim = y.claimLin && y.claimLin !== y.heroLin ? clanName(S, y.claimLin, true) : null;
  const heroOf = subj(H, claim, hs), heroTail = H ? `${H}${claim ? ` (${sexW(hs, 'предок', 'праматерь')} ${claim})` : ''}` : '';
  if (claim) diff.push(`${H} не был${sexW(hs, '', 'а')} из ${claim}: ${sexW(hs, 'его', 'её')} приписал себе правящий род`);
  let text = '';
  if (y.kind === 'name') {
    const p = s.placeName, k = s.placeKind;
    text = k === 'battle' ? `Говорят, ${p} зовут так потому, что здесь ${n >= 2 ? 'бились великаны и земля до сих пор красная' : 'когда-то пролилась кровь предков'}.`
      : k === 'plague' ? `${p} обходят стороной: говорят, там живёт мор, и кто разроет землю, тот его выпустит.`
      : k === 'sea' ? `Про ${p} рассказывают, что духи утонувших зовут оттуда рыбаков в туманные ночи.`
      : k === 'mound' ? `Говорят, в кургане спит ${n >= 2 ? 'великан' : 'древний царь'}, и пока его не тревожат, деревня стоит.`
      : `Говорят, ${p} поставили ${n >= 2 ? 'сами боги' : 'первые люди'}, но кто они были, никто не знает.`;
    diff.push(`на деле имя дано ${k === 'battle' ? 'по битве' : k === 'plague' ? 'по мору' : k === 'sea' ? 'по тем, кто не вернулся с моря' : k === 'mound' ? `по кургану вождя ${H || ''}` : 'в память об основании'} в г.${Math.floor(s.t / 360)}`);
    return { text, diff };
  }
  if (y.kind === 'war') {
    const years = y.merged.map(e => e[1]);
    text = `Рассказывают о Великой войне с «${s.otherName}»: ${n >= 3 ? 'она шла три поколения, и' : 'долго'} ${n >= 3 ? 'реки текли кровью' : 'обе стороны теряли лучших'}.${H ? ` Громче всех поют о ${H}.` : ''}`;
    diff.push(`на деле это ${years.length} ${pl(years.length, 'битва', 'битвы', 'битв')} в разные годы: г.${years.join(', г.')}`);
    return { text, diff };
  }
  if (y.kind === 'blood') {
    const dead = s.dead || 0, foe = s.foeDead || 0;
    if (s.tone === 'win') {
      text = n >= 3 ? `Говорят, у ${s.placeName || `стен «${s.otherName}»`} ${heroOf || 'наши'} ${H ? sexW(hs, 'стоял', 'стояла') : 'стояли'} против целого войска, и ${deityOf(s)} ${deityOf(s) === 'предки' ? 'встали' : 'встала'} на нашу сторону.`
        : n === 2 ? `Помнят, как ${heroOf || 'наши'} ${H ? sexW(hs, 'один', 'одна') + ' разбил' + sexW(hs, '', 'а') : 'разбили'} войско «${s.otherName}»${s.placeName ? ` у места ${s.placeName}` : ''}.`
        : `Старики рассказывают: ${s.placeName ? `${at(s)} ` : ''}наши ${s.att ? 'разбили' : 'отбили'} «${s.otherName}»${H ? `, а ${H} пал${sexW(hs, '', 'а')} ${sexW(hs, 'первым', 'первой')}` : ''}.`;
      if (n >= 2 && H) diff.push(`${H} не ${sexW(hs, 'побеждал', 'побеждала')} в одиночку: ${sexW(hs, 'он', 'она')} пал${sexW(hs, '', 'а')} в общей битве`);
      if (n === 1) diff.push(dead + foe ? `уже не говорят, что павших было ${dead + foe} с обеих сторон и кто вёл войско` : 'уже не говорят, что дошло лишь до стычки и добычи');
    } else {
      if (n === 1) diff.push(foe ? `уже не говорят, что и «${s.otherName}» потеряли ${foe}` : 'уже не говорят, что войско отбили');
      text = n >= 3 ? `С тех пор ${s.placeName ? `у места ${s.placeName}` : 'там'} по ночам слышны голоса павших: «${s.otherName}» убили сотни наших, потому что нас прогневили ${deityOf(s) === 'предки' ? 'предки' : deityOf(s)}.`
        : n === 2 ? (s.att ? `Помнят, как наши ходили на «${s.otherName}», и там погибли многие.` : `Помнят, как «${s.otherName}» пришли${s.placeName ? ` к месту ${s.placeName}` : ''} и убили многих.`) + ` ${s.unburied ? 'Наших оставили лежать без погребения — этого не прощают.' : `Это был ${angry(s)}.`}`
        : s.att ? `Рассказывают, как наши ходили войной на «${s.otherName}» и вернулись ни с чем${dead ? `, потеряв ${killed(dead)}` : ''}.${s.unburied ? ' Павших оставили там без погребения.' : ''}` : dead ? `Рассказывают, что ${s.placeName ? `${at(s)} ` : ''}«${s.otherName}» убили ${killed(dead)} наших.` : `Рассказывают, как «${s.otherName}» пришли к нам войной и взяли добычу.`;
      if (n >= 2) diff.push(`причина не ${angry(s)}: это был поход «${s.otherName}»`);
    }
    if (n >= 2) diff.push(dead + foe ? `павших было ${dead + foe} с обеих сторон, а в предании — ${crowd(dead + foe, n)}` : `в той битве никто не погиб, а в предании — ${crowd(2, n)}`);
    return { text, diff };
  }
  if (y.kind === 'woe') {
    const sea = s.sub === 'sea', plague = s.sub === 'plague';
    if (sea) {
      text = n >= 3 ? `Говорят, ${H || 'рыбак'} ушёл в море за край света, и с тех пор духи утонувших зовут рыбаков${s.placeName ? ` с места ${s.placeName}` : ''}.`
        : n === 2 ? `Помнят, как море забрало многих, и первым — ${H || 'лучшего рыбака'}.`
        : `Рассказывают, что ${H || 'рыбак'} ${sexW(hs, 'ушёл', 'ушла')} в море и не вернул${sexW(hs, 'ся', 'ась')}.`;
      diff.push(n >= 2 ? 'море забрало одну лодку, а не многих' : 'уже не помнят, в какое время года и зачем лодка вышла в море');
    } else if (plague) {
      const v = (g.myths || []).find(x => x.villain && x !== y);
      text = n >= 3 ? `Говорят, в ${s.placeName || 'яме у кладбища'} до сих пор живёт мор, и туда не ходят.`
        : n === 2 ? `Помнят мор, который унёс многих. Его наслали за ${v ? `жадность ${v.heroName}` : 'то, что забыли предков'}.`
        : `Рассказывают, как мор унёс ${killed(s.dead || 0)}.`;
      if (n === 1) diff.push('уже не помнят, откуда пришёл мор');
      if (n >= 2) diff.push(`умерло ${s.dead || 0}, а мор пришёл от соседей, а не как кара`);
    } else {
      text = n >= 2 ? `Помнят голодную зиму, которую наслал ${angry(s)}.` : `Рассказывают о голодной зиме, когда ели кору.`;
      diff.push(n >= 2 ? 'голод был от неурожая, а не от гнева богов' : 'коры не ели: в ту зиму кормились запасом деревни, его не хватило');
    }
    return { text, diff };
  }
  if (y.kind === 'origin') {
    const how = s.how;
    text = n >= 3 ? `Говорят, ${heroOf} ${sexW(hs, 'был сыном', 'была дочерью')} ${deityOf(s) === 'предки' ? 'первых предков' : deityOf(s) === 'Река' ? 'Реки' : deityOf(s) === 'Гора' ? 'Горы' : deityOf(s) === 'Лес' ? 'Леса' : 'Огня'}, и камень, что ${sexW(hs, 'он', 'она')} поставил${sexW(hs, '', 'а')}, до сих пор тёплый.`
      : n === 2 ? `Помнят, как ${heroOf} получил${sexW(hs, '', 'а')} знак от ${deityOf(s) === 'предки' ? 'предков' : deityOf(s) === 'Река' ? 'Реки' : deityOf(s) === 'Гора' ? 'Горы' : deityOf(s) === 'Лес' ? 'Леса' : 'Огня'} и ${how === 'landing' ? `привёл${sexW(hs, '', 'а')} первых людей из-за моря` : how === 'schism' ? `вывел${sexW(hs, '', 'а')} своих из несправедливой деревни${s.from ? ` «${s.from}»` : ''}` : `выбрал${sexW(hs, '', 'а')} это место`}.`
      : how === 'landing' ? `Рассказывают, что ${heroOf} пришёл${sexW(hs, '', 'а')} из-за моря и поставил${sexW(hs, '', 'а')} здесь первый дом.`
      : how === 'schism' ? `Рассказывают, что ${heroOf} увёл${sexW(hs, '', 'а')} своих от жадного вождя${s.from ? ` «${s.from}»` : ''} и основал${sexW(hs, '', 'а')} деревню.`
      : `Рассказывают, что деревню основал${sexW(hs, '', 'а')} ${heroTail}.`;
    if (n === 1) diff.push(how === 'schism' ? `«${s.from || 'прежняя деревня'}» была жадной только в глазах ушедших: раскол вырос из обид на вождя и борьбы за власть` : how === 'found' ? 'основали деревню двое, второго уже не называют' : how === 'colony' ? 'это была дочерняя деревня: в рассказе уже нет, откуда пришли' : 'в рассказе уже нет спутников основателя');
    if (n >= 2) diff.push(`никакого знака не было: ${how === 'schism' ? 'это был раскол из-за обид на вождя' : how === 'colony' ? 'это была дочерняя деревня, ушедшая на свободную землю' : 'люди искали землю и воду'}`);
    if (n >= 3) diff.push(`${H} — обычный человек, ${sexW(hs, 'сын', 'дочь')} своих родителей`);
    return { text, diff };
  }
  if (y.villain) {
    text = n >= 3 ? `Говорят, ${H} ${sexW(hs, 'был проклят', 'была проклята')} за то, что ел${sexW(hs, '', 'а')}, когда дети умирали, и род ${sexW(hs, 'его', 'её')} с тех пор несчастлив.`
      : n === 2 ? `Помнят, как ${H} ел${sexW(hs, '', 'а')} досыта, когда дети умирали от голода.`
      : `Рассказывают, что в голодную зиму ${H} не отдал${sexW(hs, '', 'а')} своей доли хлеба.`;
    if (n === 1) diff.push('уже не помнят, что в ту зиму голодали не все');
    if (n >= 2) diff.push(`${H} брал${sexW(hs, '', 'а')} обычную долю вождя; детей в ту зиму умерло не больше, чем в другие голодные годы`);
    if (n >= 3) diff.push('проклятия не было: о роде просто помнят дурное');
    return { text, diff };
  }
  if (y.kind === 'power') {
    if (s.mon === 'mound') {
      text = n >= 2 ? `Говорят, ${heroOf} правил${sexW(hs, '', 'а')} так мудро, что при ${sexW(hs, 'нём', 'ней')} не было голода, и потому над ${sexW(hs, 'ним', 'ней')} насыпали курган.`
        : `Рассказывают, что в кургане лежит ${heroTail}, ${sexW(hs, 'правивший', 'правившая')} ${s.years ? yrs(s.years) : 'долго'}.`;
      if (n === 1) diff.push('о том, как правил, уже не рассказывают: остался только курган');
      if (n >= 2) diff.push(`о мудрости ${sexW(hs, 'его', 'её')} правления в летописи ничего нет: её добавил пересказ`);
    } else {
      const ours = y.version !== 'old';
      text = ours ? `Рассказывают, что ${H || 'прежний вождь'} правил${sexW(hs, '', 'а')} жестоко, и деревню освободили.` : `Рассказывают, что ${H || 'законного вождя'} свергли изменой.`;
      diff.push(ours ? 'переворот подняли из-за обид и борьбы родов, жестокостью его объяснили потом' : 'свергнутого вождя поддерживала только часть деревни');
    }
    return { text, diff };
  }
  return { text: `Рассказывают ${s.what}.`, diff };
}

// a legend is born from a memory whose last witness has died
function newMyth(S, g, o) {
  const y = Object.assign({ id: (S.mythId = (S.mythId || 0) + 1), t: S.tick, told: S.tick, step: 1, merged: [] }, o);
  const t = tellMyth(S, g, y); y.text = t.text; y.diff = t.diff;
  (g.myths || (g.myths = [])).push(y);
  if (g.myths.length > MYTH_MAX) g.myths.shift();
  cite(S, y.ev);
  S.stats.myths = (S.stats.myths || 0) + 1;
  const first = !S.firstMyth; S.firstMyth = true;
  const ev = (first || o.kind === 'origin' ? log : note)(S, 'myth', `${first ? 'Первое предание в мире: ' : ''}в «${g.name}» рассказывают: ${y.text.charAt(0).toLowerCase()}${y.text.slice(1)}`, g.home ? g.home.x : g.cx, g.home ? g.home.y : g.cy, g.hue, { first, why: 'Последние, кто видел это сами, умерли; теперь это знают только по рассказам.', gs: [g.id], causes: [y.ev] });
  y.born = ev.id;
  return y;
}
// the next generation retells it; similar blood legends against one village merge into a Great War; the ruling line claims
// the hero of a proud legend
function retell(S, g, y) {
  if (y.step >= 3) return;
  y.step++; y.told = S.tick;
  const L = S._a.get(g.leader);
  if (y.step >= 2 && L && L.lin && y.heroName && (y.tone === 'win' || y.tone === 'pride') && y.heroLin !== L.lin && !y.claimLin) y.claimLin = L.lin;
  if (y.kind === 'blood' && y.step >= 2) {
    const same = g.myths.filter(x => x !== y && x.kind === 'blood' && x.other === y.other && x.version !== 'old');
    if (same.length) {
      y.kind = 'war'; y.merged = [y, ...same].map(x => [x.ev, Math.floor(x.src.t / 360)]).sort((a, b) => a[1] - b[1]);
      g.myths = g.myths.filter(x => !same.includes(x));
      S.stats.mythMerged = (S.stats.mythMerged || 0) + same.length;
    }
  }
  const t = tellMyth(S, g, y); y.text = t.text; y.diff = t.diff;
  // a legend that ends in a haunted place keeps people away even after the truth is gone
  if (y.step >= 3 && (y.tone === 'loss' || y.src.sub === 'sea' || y.src.sub === 'plague')) { const p = placeById(S, y.place); if (p && !p.cursed) { p.cursed = S.tick; S.stats.cursed = (S.stats.cursed || 0) + 1; } }
  S.stats.retold = (S.stats.retold || 0) + 1;
}
// the yearly round: legends are born from memories without witnesses and from forgotten names; old legends are retold
function mythYear(S, g) {
  if (!g.home) return;
  for (const m of g.mem || []) {
    if (m.myth || m.w < 0.3 || m.kind === 'good' || S.tick - m.t < 360 * 25) continue;
    // a memory turns into a legend once a generation has passed and few of those who saw it are left (a quarter, at most two)
    const live = witnesses(S, m); if (m.lastWit === null && live > Math.max(2, m.wit.length * 0.25)) continue;
    m.myth = true;
    newMyth(S, g, { ev: m.ev, kind: m.villain || m.mon === 'mound' ? 'power' : m.kind, tone: m.tone, villain: m.villain, hero: m.hero, heroName: m.heroName, heroSex: m.heroSex, heroLin: m.heroLin, other: m.other, otherName: m.otherName, place: m.place, placeName: m.placeName, lin: m.lin, src: m });
  }
  for (const m of g.memGone || []) {
    if (m.named || !m.place || S.tick - m.gone < 360 * 5) continue;
    const p = placeById(S, m.place); if (!p) continue;
    m.named = true;
    if ((g.myths || []).some(x => x.place === p.id)) continue;
    newMyth(S, g, { ev: m.ev, kind: 'name', tone: 'wonder', place: p.id, placeName: p.name, heroName: m.heroName, src: Object.assign({ placeName: p.name, placeKind: p.kind }, m) });
  }
  for (const y of g.myths || []) if (S.tick - y.told >= MYTH_STEP) retell(S, g, y);
}
// after a coup a new line has the proud legends retold its way; the old telling stays with the deposed line
function mythRewrite(S, g, oldL, newL, coupEv) {
  if (!oldL || !newL || !newL.lin || oldL.lin === newL.lin || !g.myths) return;
  let n = 0;
  for (const y of g.myths.slice()) {
    if (y.version === 'old' || (y.claimLin || y.heroLin) !== oldL.lin || !(y.tone === 'win' || y.tone === 'pride')) continue;
    const old = Object.assign({}, y, { id: (S.mythId = (S.mythId || 0) + 1), version: 'old', lin: oldL.lin });
    g.myths.push(old);
    y.claimLin = newL.lin; const t = tellMyth(S, g, y); y.text = t.text; y.diff = t.diff.concat([`после переворота г.${Math.floor(S.tick / 360)} героя стали считать предком ${clanName(S, newL.lin, true)}; род ${clanName(S, oldL.lin, true)} рассказывает по-старому`]);
    n++;
  }
  if (!n) return;
  while (g.myths.length > MYTH_MAX) g.myths.shift();
  S.stats.mythRewritten = (S.stats.mythRewritten || 0) + n;
  log(S, 'myth', `${newL.name} велит рассказывать по-новому: герои ${pl(n, 'старого предания', 'старых преданий', 'старых преданий')} «${g.name}» теперь предки ${clanName(S, newL.lin, true)}`, g.home ? g.home.x : g.cx, g.home ? g.home.y : g.cy, g.hue, { why: sent([`род ${clanName(S, oldL.lin, true)} рассказывает по-старому`, 'кто правит, тот и решает, чьи предки были героями']), who: [newL.id, oldL.id], gs: [g.id], causes: [coupEv] });
}
// a proud legend whose hero the line claims: the line's right to rule is firmer (like two remembered mounds)
function mythAncestor(S, g, lin) { return lin && (g.myths || []).find(y => y.version !== 'old' && (y.tone === 'win' || y.tone === 'pride') && (y.claimLin || y.heroLin) === lin); }
// a legend about a tyrant: his line loses votes while it is told
function mythVillain(S, g, lin) { return lin && (g.myths || []).find(y => y.villain && y.heroLin === lin); }

// a daughter village carries away its mother's legends; from then on each retells them its own way (its own rulers claim
// the heroes, its own gods punish), so the same event comes to be told differently in the two villages
function inheritMyths(S, mother, child) {
  if (!mother || !child || !mother.myths || !mother.myths.length) return;
  child.myths = child.myths || [];
  for (const y of mother.myths) {
    if (y.version === 'old' || child.myths.length >= MYTH_MAX) continue;
    child.myths.push(Object.assign({}, y, { id: (S.mythId = (S.mythId || 0) + 1), carried: mother.name, told: S.tick, merged: (y.merged || []).slice(), diff: y.diff.slice(), src: Object.assign({}, y.src, { faith: child.faith && S.faiths && S.faiths[child.faith] ? S.faiths[child.faith].base : y.src.faith }) }));
  }
  S.stats.mythCarried = (S.stats.mythCarried || 0) + 1;
}
