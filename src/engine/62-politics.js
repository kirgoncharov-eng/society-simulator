function power(S, g) {
  let p = 0; for (const id of g.members) { const m = S._a.get(id); p += m.skill * (0.3 + m.energy); }
  return p / (1 + g.entropy * 0.5);
}

function relations(S) {
  const P = S.params, G = S.groups, decay = 0.03 + 0.1 * (1 - P.memory);
  for (let i = 0; i < G.length; i++) for (let j = i + 1; j < G.length; j++) {
    const A = G[i], B = G[j];
    if (A.dead || B.dead) continue;
    const LA = S._a.get(A.leader), LB = S._a.get(B.leader); if (!LA || !LB) continue;
    const k = key(A.id, B.id), d = Math.hypot(A.cx - B.cx, A.cy - B.cy);
    let h = S.hostility[k] || 0;
    const al = S.alliances.find(x => (x.a === A.id && x.b === B.id) || (x.a === B.id && x.b === A.id));
    if (d < 380) { const dt = 0.07 * ((LA.coop + LB.coop) / 2 - 0.3) - 0.05 * h + (al ? 0.02 : 0); bump(LA, LB, dt); bump(LB, LA, dt); }
    const mutual = ((LA.trust[LB.id] || 0) + (LB.trust[LA.id] || 0)) / 2;
    const rv = ((A.rivals || {})[B.id] || 0) + ((B.rivals || {})[A.id] || 0);
    const contest = Math.min(1.5, rv / 30) + (A.target === B.target ? 0.3 : 0) + (d < 160 ? 0.15 : 0);
    if (A.state && A.state === B.state) h *= 0.5;
    // a personal feud between the two leaders drags their villages into it
    const lf = Math.min(0, bondW(LA, LB)) + Math.min(0, bondW(LB, LA)); if (lf < 0 && d < 450) h += -lf * 0.03;
    if (!al) h += contest * (0.03 + 0.12 * P.scarcity) * (0.5 + (LA.ambition + LB.ambition) / 2) * (0.7 + cdist(A, B)) - 0.08 * Math.max(0, mutual) - 0.02 * Math.min(3, (S.kinTies || {})[k] || 0);
    h -= h * decay; if (al) h *= 0.6;
    h = clamp(h, 0, 2);
    if (A.home && B.home) {
      const pa = A.treasury / Math.max(1, A.members.length), pb = B.treasury / Math.max(1, B.members.length);
      if (!al && d < 450) {
        const [poor, rich, Lp] = pa < pb ? [A, B, LA] : [B, A, LB], pp = Math.min(pa, pb), pr = Math.max(pa, pb);
        if (pp < 3 && pr > 10) h += 0.05 * Lp.ambition * (1 + P.scarcity);
        if (poor.famY === Math.floor(S.tick / 360)) h += 0.05;
        if (A.lord === B.id || B.lord === A.id) h += 0.03;
        const bl = (S.borders || {})[k] || 0;
        if (bl) h += Math.min(1, bl / 15) * (0.015 + 0.05 * P.scarcity) * (A.faith && A.faith === B.faith ? 0.5 : 1);
        if (A.faith && B.faith) { if (A.faith === B.faith) { h *= 0.96; bump(LA, LB, 0.01); bump(LB, LA, 0.01); } else h += 0.02; }
      }
    } else if (h > 1 && rnd(S) < 0.12) { conflict(S, A, B); h = 0.3; }
    if (A.dead || B.dead) continue;
    if (h < 0.01) delete S.hostility[k]; else S.hostility[k] = h;
    if (!al && mutual > 0.2 && h < 0.3 && d < 450 && rnd(S) < 0.12) {
      S.alliances.push({ a: A.id, b: B.id, since: S.tick });
      log(S, 'alliance', `«${A.name}» и «${B.name}» заключают союз`, (A.cx + B.cx) / 2, (A.cy + B.cy) / 2, A.hue, { why: `Лидеры ${LA.name} и ${LB.name} доверяют друг другу (${P0(mutual)}), а вражды между группами почти нет. Союзники не воюют и помогают друг другу в стычках.`, who: [LA.id, LB.id], gs: [A.id, B.id] });
    } else if (al && (mutual < -0.05 || h > 0.7)) {
      S.alliances = S.alliances.filter(x => x !== al);
      log(S, 'break', `Союз «${A.name}» и «${B.name}» распадается`, (A.cx + B.cx) / 2, (A.cy + B.cy) / 2, A.hue, { why: mutual < -0.05 ? `Доверие между лидерами ${LA.name} и ${LB.name} ушло в минус.` : 'Группы снова делят один источник, и вражда пересилила дружбу.', who: [LA.id, LB.id], gs: [A.id, B.id] });
    } else if (al && S.tick - al.since > 720) {
      const [big, sm] = A.members.length >= B.members.length ? [A, B] : [B, A];
      const sL = S._a.get(sm.leader), bL = S._a.get(big.leader);
      if (big.members.length >= sm.members.length * 2 && (sL.trust[bL.id] || 0) > 0.3 && rnd(S) < 0.06) merge(S, big, sm);
    }
  }
  for (const g of G) { g.rivals = {}; g.press = 0; }
}

function conflict(S, A, B) {
  const ally = g => S.alliances.filter(x => x.a === g.id || x.b === g.id).map(x => S._g.get(x.a === g.id ? x.b : x.a)).filter(Boolean);
  const aA = ally(A), aB = ally(B);
  const pA = power(S, A) + aA.reduce((s, g) => s + power(S, g) * 0.3, 0);
  const pB = power(S, B) + aB.reduce((s, g) => s + power(S, g) * 0.3, 0);
  const winA = rnd(S) < pA * pA / (pA * pA + pB * pB);
  const node0 = nodeOf(S, A.target === B.target ? A.target : null);
  const LA0 = S._a.get(A.leader), LB0 = S._a.get(B.leader), mut0 = ((LA0.trust[LB0.id] || 0) + (LB0.trust[LA0.id] || 0)) / 2;
  const W = winA ? A : B, Lg = winA ? B : A, wAl = winA ? aA : aB;
  const loot = Lg.treasury * 0.5; W.treasury += loot; Lg.treasury -= loot;
  const lt = (Lg.tools || 0) * 0.3; W.tools = (W.tools || 0) + lt; Lg.tools = (Lg.tools || 0) - lt;
  Lg.avoid[Lg.target] = S.tick + 360;
  const WL = S._a.get(W.leader), LL = S._a.get(Lg.leader);
  bump(WL, LL, -0.3); bump(LL, WL, -0.35); bond(S, LL, WL, 'rival', 'отбил наш промысел', 0.4);
  for (const g of wAl) { const al = S._a.get(g.leader); if (al) bump(al, LL, -0.15); }
  let def = 0;
  for (const m of Lg.members.map(id => S._a.get(id))) {
    if (!m) continue;
    m.energy = Math.max(0.05, m.energy - 0.12);
    if (m.id !== Lg.leader) { bump(m, LL, -0.08); if ((m.trust[LL.id] || 0) < 0.05 && rnd(S) < 0.25) { join(S, m, W, W.leader); def++; } }
  }
  S.stats.conflicts++;
  pickTarget(S, Lg.dead ? W : Lg);
  const n = nodeOf(S, W.target) || { x: (A.cx + B.cx) / 2, y: (A.cy + B.cy) / 2 };
  const pw = winA ? pA : pB, pl = winA ? pB : pA;
  const why = sent([node0 ? 'обе группы кормятся у одного источника' : 'группы соседствуют и перехватывают друг у друга добычу', node0 && node0.amt / node0.cap < 0.35 ? 'источник почти исчерпан' : '', S.params.scarcity > 0.6 ? 'ресурсов в мире мало' : '', mut0 < -0.2 ? 'лидеры давно не доверяют друг другу' : '', pw >= pl ? `победитель сильнее в ${(pw / Math.max(0.1, pl)).toFixed(1)} раза` : 'победил более слабый: в стычке решает и случай', wAl.length ? 'победителям помогли союзники' : '']);
  log(S, 'conflict', `Стычка за источник: «${W.name}» берёт верх над «${Lg.name}»${def ? (one(def) ? `, ${def} проигравший переходит к победителям` : `, ${def} проигравших переходят к победителям`) : ''}${wAl.length ? ' при поддержке союзников' : ''}`, n.x, n.y, W.hue, { why, who: [WL.id, LL.id], gs: [W.id, Lg.id], big: W.members.length + Lg.members.length >= 8 });
}

function merge(S, big, sm) {
  const sL = S._a.get(sm.leader), bL0 = S._a.get(big.leader);
  const al0 = S.alliances.find(x => (x.a === big.id && x.b === sm.id) || (x.a === sm.id && x.b === big.id));
  const why = `Союз длился ${yrs(Math.round((S.tick - (al0 ? al0.since : S.tick)) / 360))}. «${big.name}» как минимум вдвое больше, а ${sL.name} доверяет ${bL0.name} (${P0(sL.trust[bL0.id] || 0)}). Малой группе выгоднее влиться, чем стоять отдельно.`;
  if (S.arch && S.arch[sm.id]) S.arch[sm.id].into = big.id;
  if (S.own) for (let c = 0; c < S.own.length; c++) if (S.own[c] === sm.id) S.own[c] = big.home ? big.id : 0; // a band without a village cannot hold land
  for (const id of sm.members) {
    const m = S._a.get(id); m.group = big.id; m.role = 'member';
    if (m.id === sL.id) m.boss = big.leader;
    big.members.push(id);
  }
  big.treasury += sm.treasury; sm.treasury = 0; sm.members = [];
  big.wood += sm.wood || 0; big.stone += sm.stone || 0; big.tools += sm.tools || 0; sm.wood = sm.stone = sm.tools = 0;
  dissolve(S, sm, true); restructure(S, big); S.stats.merges++;
  log(S, 'merge', `«${sm.name}» входит в состав «${big.name}». Теперь там ${big.members.length} человек`, big.cx, big.cy, big.hue, { why, who: [bL0.id, sL.id], gs: [big.id, sm.id] });
}

const shortName = g => g.name.split(' ').slice(1).join(' ') || g.name;
function rootOf(S, g) { let r = g, k = 0; while (r.lord && k++ < 8) { const l = S._g.get(r.lord); if (!l || !l.home) break; r = l; } return r; }
function protection(S) {
  for (const g of S.groups) {
    if (!g.home || g.lord || g.members.length > 8 || (g.threat || 0) < 0.3 || S.groups.some(o => o.lord === g.id)) continue;
    const L = S._a.get(g.leader); if (!L) continue;
    let best = null, bv = 0;
    for (const o of S.groups) {
      if (o === g || !o.home || o.lord || o.members.length < g.members.length * 2) continue;
      const d = Math.hypot(o.home.x - g.home.x, o.home.y - g.home.y); if (d > 380) continue;
      const LO = S._a.get(o.leader); if (!LO) continue;
      const tr = (L.trust[LO.id] || 0) + (S.routes[key(g.id, o.id)] ? 0.2 : 0) + (o.faith && o.faith === g.faith ? 0.2 : 0) - (S.hostility[key(g.id, o.id)] || 0);
      const v = tr * o.members.length / (1 + d / 200);
      if (tr > 0.15 && v > bv) { bv = v; best = o; }
    }
    if (!best || rnd(S) > 0.35) continue;
    g.lord = best.id; g.tribRate = 0.06;
    const LO = S._a.get(best.leader);
    log(S, 'state', `«${g.name}» просит покровительства «${best.name}» и становится её вассалом`, g.home.x, g.home.y, best.hue, { why: sent([`маленькой деревне (${g.members.length} чел.) угрожают соседи: угроза ${P0(Math.min(1, g.threat))}`, `«${best.name}» сильнее вдвое и ей доверяют${S.routes[key(g.id, best.id)] ? ': они давно торгуют' : ''}${best.faith && best.faith === g.faith ? ', и вера у них одна' : ''}`, 'за защиту вассал платит половину обычной дани', LO ? `покровитель — ${LO.name}` : '']), gs: [g.id, best.id] });
  }
}
function states(S) {
  protection(S);
  const vill = S.groups.filter(g => g.home);
  const uf = new Map(); const find = x => { while (uf.get(x) !== x) { uf.set(x, uf.get(uf.get(x))); x = uf.get(x); } return x; };
  for (const g of vill) uf.set(g.id, g.id);
  for (const g of vill) { const r = rootOf(S, g); if (r !== g) uf.set(find(g.id), find(r.id)); }
  const confed = new Set();
  for (const al of S.alliances) {
    const A = S._g.get(al.a), B = S._g.get(al.b);
    if (!A || !B || !A.home || !B.home || S.tick - al.since < 360 * 5) continue;
    const ra = find(A.id), rb = find(B.id); if (ra !== rb) { uf.set(ra, rb); confed.add(rb); confed.add(ra); }
  }
  const sets = new Map();
  for (const g of vill) { const r = find(g.id); if (!sets.has(r)) sets.set(r, []); sets.get(r).push(g); }
  const old = S.states || [], next = [];
  S.sarch = S.sarch || {};
  for (const mem of sets.values()) {
    const pop = mem.reduce((s2, g) => s2 + g.members.length, 0), terr = mem.reduce((s2, g) => s2 + (g.terr || 0), 0);
    const roots = mem.filter(g => !g.lord || !mem.some(o => o.id === g.lord));
    const cap = roots.sort((a, b) => b.members.length - a.members.length)[0] || mem[0];
    const vass = mem.filter(g => g.lord).length;
    let type = null;
    if (mem.length >= 2) type = vass && cap.dynasty ? 'Королевство' : vass && mem.length - vass <= 1 ? 'Держава' : 'Конфедерация';
    else if (cap.members.length >= ((old.find(o => o.cap === cap.id && o.type === 'Город-государство')) ? 30 : 40) && (cap.terr || 0) >= 70) type = 'Город-государство';
    if (!type) continue;
    const prev = old.find(o => o.cap === cap.id) || old.find(o => o.members.filter(id => mem.some(g => g.id === id)).length > o.members.length / 2);
    const faiths = new Set(mem.map(g => g.faith).filter(Boolean)), f1 = faiths.size === 1 && mem.every(g => g.faith) ? S.faiths[[...faiths][0]] : null;
    const L = S._a.get(cap.leader);
    const name = prev && prev.type === type && prev.cap === cap.id ? prev.name : type === 'Королевство' ? `Королевство ${cap.dynName || (L ? L.name : shortName(cap))}` : type === 'Держава' ? `Держава ${shortName(cap)}` : type === 'Город-государство' ? `Город ${shortName(cap)}` : f1 ? `Союз ${f1.name.replace('культ ', 'культа ')}` : `Союз ${shortName(cap)}`;
    const st = { id: prev ? prev.id : 's' + (S.nextId++), name, type, cap: cap.id, members: mem.map(g => g.id), pop, terr, founded: prev ? prev.founded : S.tick, hue: cap.hue };
    next.push(st);
    if (!prev) {
      log(S, 'state', `Рождается государство: «${name}», ${mem.length > 1 ? `${mem.length} ${pl(mem.length, 'деревня', 'деревни', 'деревень')}, ` : ''}${pop} чел.`, cap.home.x, cap.home.y, cap.hue, { first: !S.firstState, why: sent([type === 'Королевство' || type === 'Держава' ? `«${cap.name}» держит ${vass} ${pl(vass, 'данника', 'данников', 'данников')}: власть стоит на завоевании и дани` : type === 'Конфедерация' ? `деревни дольше восьми лет в союзе${f1 ? ` и молятся одному богу: ${f1.name}` : ''}, они защищают друг друга и не воюют между собой` : `«${cap.name}» разрослась до ${cap.members.length} человек и ${cap.terr} клеток земли`, `столица — «${cap.name}»`, L ? `правит ${L.name}` : '']), gs: mem.map(g => g.id), who: L ? [L.id] : [] });
      S.firstState = true; S.stats.states = (S.stats.states || 0) + 1;
    } else {
      const added = mem.filter(g => !prev.members.includes(g.id));
      if (added.length) log(S, 'state', `«${name}» прирастает: ${added.map(g => `«${g.name}»`).join(', ')}`, added[0].home.x, added[0].home.y, cap.hue, { why: added.some(g => g.lord) ? 'Новые земли добыты войной и обложены данью.' : 'Новые члены вступили в союз после долгой дружбы.', gs: [cap.id, ...added.map(g => g.id)] });
      if (prev.type !== type) log(S, 'state', `«${prev.name}» становится «${name}»`, cap.home.x, cap.home.y, cap.hue, { why: type === 'Королевство' ? 'Правящий род столицы ввёл наследование: держава превращается в королевство.' : type === 'Конфедерация' ? 'Данники вырвались на свободу, но союз остался.' : 'Устройство государства изменилось.', gs: [cap.id] });
    }
    S.sarch[st.id] = { name: st.name, type, founded: st.founded, end: null, peak: Math.max(pop, (S.sarch[st.id] || {}).peak || 0) };
  }
  for (const o of old) if (!next.some(n => n.id === o.id)) {
    const cap = S._g.get(o.cap), yrs0 = Math.round((S.tick - o.founded) / 360);
    if (S.sarch[o.id]) S.sarch[o.id].end = S.tick;
    log(S, 'state', `«${o.name}» распадается спустя ${yrs(Math.max(1, yrs0))}`, cap && cap.home ? cap.home.x : undefined, cap && cap.home ? cap.home.y : undefined, o.hue, { why: sent([!cap ? 'столица исчезла' : cap.lord ? 'столица сама попала под чужую власть' : o.type === 'Город-государство' ? `город обезлюдел: в «${cap.name}» осталось ${cap.members.length} человек` : 'данники восстали или союз распался', `на пике в нём жило ${(S.sarch[o.id] || {}).peak || o.pop} человек`]), gs: o.members.filter(id => S._g.has(id)) });
  }
  S.states = next;
  for (const g of S.groups) g.state = null;
  for (const st of next) for (const id of st.members) { const g = S._g.get(id); if (g) g.state = st.id; }
}
function regime(S, g) {
  const n = g.members.length, mem = g.members.map(id => S._a.get(id)).filter(Boolean), L = S._a.get(g.leader);
  if (!g.home) return { type: 'Кочевая ватага', c: 0.3, b: 0.5, gi: 0, vass: 0 };
  const gi = gini(mem.map(m => m.wealth));
  const c = clamp(0.3 * clamp((g.take - 0.05) / 0.3, 0, 1) + 0.2 * clamp((g.depth - 1) / 3, 0, 1) + 0.25 * gi + 0.15 * (1 - g.norm) + (g.dynasty ? 0.15 : 0) + (g.priestRule ? 0.05 : 0), 0, 1);
  const vass = S.groups.filter(o => o.lord === g.id).length;
  const guards = mem.filter(m => m.job === 'guard' || m.war).length / Math.max(1, n);
  const crafters = mem.filter(m => m.job === 'craft' || m.job === 'trade' || m.car).length / Math.max(1, n);
  const comm = clamp(Math.min(1, (g.trades || 0) / 25) * 0.6 + (g.workshop ? 0.15 : 0) + crafters * 1.5, 0, 1);
  const force = clamp((g.warsWon || 0) * 0.2 + vass * 0.3 + guards * 1.8 + (g.walls ? 0.1 : 0), 0, 1);
  const b = clamp(0.5 + 0.5 * (comm - force), 0, 1);
  const rich = mem.slice().sort((x, y) => y.wealth - x.wealth)[0];
  const merchantRule = !!(rich && L && rich !== L && (rich.trades || 0) >= 3 && rich.wealth > L.wealth * 1.3);
  let type;
  if (n < 5) type = 'Хутор';
  else if (g.priestRule) type = 'Теократия';
  else if (vass >= 1 && b < 0.55) type = 'Держава данников';
  else if (g.gov === 'assembly') type = b > 0.62 ? 'Торговая республика' : 'Вечевая республика';
  else if (g.land === 'private' && (landTop(g) || {}).share > 0.35) type = (g.dynasty || c > 0.55) ? 'Феодальное княжество' : 'Земельная знать';
  else if (g.dynasty) type = c > 0.55 ? 'Наследственное княжество' : 'Родовая община';
  else if (b > 0.62) type = c > 0.5 || merchantRule ? 'Купеческая олигархия' : 'Вольная торговая община';
  else if (b < 0.38) type = c > 0.5 ? 'Военная деспотия' : 'Воинское братство';
  else type = c > 0.6 ? 'Вождество' : c < 0.33 ? 'Община равных' : 'Земледельческая община';
  const why = sent([
    `власть ${c > 0.6 ? 'сосредоточена наверху' : c < 0.35 ? 'размыта' : 'распределена умеренно'}: лидер берёт ${P0(g.take)}, уровней ${g.depth}, неравенство ${gi.toFixed(2)}${g.norm < 0.4 ? ', делят по статусу' : g.norm > 0.6 ? ', делят поровну' : ''}`,
    `опора ${b > 0.62 ? 'на торговлю и ремесло' : b < 0.38 ? 'на силу' : 'смешанная'}: ${g.trades || 0} ${pl(g.trades || 0, 'сделка', 'сделки', 'сделок')}${g.workshop ? ', мастерская' : ''}${g.warsWon ? `, побед ${g.warsWon}` : ''}${vass ? `, данников ${vass}` : ''}${guards > 0.1 ? `, в страже ${P0(guards)}` : ''}`,
    g.coin ? 'в ходу монета' : '', (() => { const b = g.members.filter(id => { const m = S._a.get(id); return m && m.bond; }).length; return b ? `в кабале ${b} ${pl(b, 'человек', 'человека', 'человек')}` : ''; })(),
    g.gov === 'assembly' ? 'решения принимает вече' : '', g.land === 'private' ? `поля в частной собственности${landTop(g) ? `, у крупнейшего хозяина ${P0(landTop(g).share)} земли` : ''}` : '',
    g.dynasty ? `правит династия ${g.dynName}` : '', g.priestRule ? 'правит бывший жрец' : '', merchantRule ? `богатейший — купец ${rich.name}, он богаче лидера` : ''
  ]);
  return { type, c, b, gi, vass, merchantRule, why };
}
