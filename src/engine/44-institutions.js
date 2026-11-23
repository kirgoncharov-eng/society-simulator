function institutions(S, g, L) {
  const P = S.params, n = g.members.length; let imL, imA;
  if (!L || !g.home) return;
  const mem = g.members.map(id => S._a.get(id)).filter(Boolean);
  // private land
  if (g.land === 'private' && P.landPriv < 0.5) {
    g.land = 'common'; for (const f of g.fields) f.owner = null;
    log(S, 'land', `В «${g.name}» поля снова становятся общими`, g.home.x, g.home.y, g.hue, { why: 'Частная собственность на землю запрещена вводными.', gs: [g.id] });
  } else if (g.land !== 'private' && P.landPriv >= 0.5 && n >= 9 && g.fields.length >= 4 && (g.norm < 0.55 || g.dynasty) && (imL = imitP(S, g, o => o.land === 'private'), rnd(S) < 0.008 + imL.p)) {
    g.land = 'private'; g.imFrom = imL.p > 0.008 && imL.from && rnd(S) < imL.p / (imL.p + 0.008) ? imL.from.name : null;
    const owners = mem.slice().sort((a, b) => b.status - a.status).slice(0, Math.max(2, Math.ceil(n * 0.4)));
    g.fields.forEach((f, i) => { f.owner = owners[i % owners.length].id; });
    const first = !S.firstLand; S.firstLand = true;
    const landless = adultsOf(S, g).filter(m => !owners.includes(m)), heads = lineHeads(S, g);
    const A = owners.includes(L) ? L : owners[0];
    enact(S, g, { type: 'land', kind: 'land', author: A, backers: owners, against: topBy(landless.filter(m => heads.includes(m) || m.norm > 0.6), m => m.status + 5 * m.norm, 3), text: first ? `Впервые в мире: «${g.name}» делит поля в собственность` : `«${g.name}» делит поля в собственность`, extra: { first }, why: [`в деревне ${n} человек и ${g.fields.length} ${pl(g.fields.length, 'поле', 'поля', 'полей')}`, g.dynasty ? `правит династия ${g.dynName}, и знать хочет закрепить землю за собой` : 'урожай и так делят по положению, и влиятельные хотят закрепить поля за собой', `поля получили ${owners.length} самых влиятельных`, 'теперь хозяин поля забирает треть урожая, а остальные работают на чужой земле батраками', 'поля переходят по наследству детям'],
      propose: 'настаивает', authorLine: `Делит поля «${g.name}» в собственность и ${fem(A, 'сам', 'сама')} получает поле`, lostLine: p => `Остаётся без своего поля, когда «${g.name}» делит землю`, grudge: `${fem(A, 'забрал', 'забрала')} общие поля себе и своим` });
    imNote(S, g);
  }
  if (g.land === 'private') {
    const poor = mem.filter(m => m.wealth < 0 && g.fields.some(f => f.owner === m.id));
    const rich = mem.slice().sort((a, b) => b.wealth - a.wealth)[0];
    for (const p of poor) {
      if (!rich || rich === p || rich.wealth < 25 || rnd(S) > 0.3) continue;
      const f = g.fields.find(x => x.owner === p.id); if (!f) continue;
      f.owner = rich.id; rich.wealth -= 15; p.wealth += 15; bump(p, rich, -0.1);
      g.landSales = (g.landSales || 0) + 1;
    }
    const top = landTop(g);
    if (top && top.share >= 0.4 && top.n >= 3 && g.fields.length >= 6 && !g.bigLord) {
      g.bigLord = true; const T = S._a.get(top.id);
      if (T) log(S, 'land', `${T.name} владеет ${top.n} ${pl(top.n, 'полем', 'полями', 'полями')} из ${g.fields.length}: в «${g.name}» появляется крупный землевладелец`, g.home.x, g.home.y, g.hue, { why: sent([g.landSales ? `за голодные годы бедные хозяева продали ${g.landSales} ${pl(g.landSales, 'поле', 'поля', 'полей')} за еду` : '', 'поля наследуются, и у одних семей их становится всё больше', `всего хозяев земли: ${top.owners}, остальные — батраки`, 'так рождается земельная знать']), who: [T.id], gs: [g.id] });
    }
  }
  // assembly
  if (g.gov === 'assembly' && P.assembly >= 0.5 && L.ambition > 0.55 && (g.room !== undefined && g.room < 0.35 || g.warsLost > (g.wl0 || 0)) && mem.filter(m => m.patron === L.id).length >= 2 && rnd(S) < 0.015 * (livesOffOthers(S, g, L) ? 1.5 : 0.7)) {
    g.gov = g.dynasty ? 'monarch' : 'chief'; g.wl0 = g.warsLost;
    const by = g.asmBy && S._a.get(g.asmBy), keep = topBy(lineHeads(S, g).filter(h => h !== L && h.norm > 0.5), h => h.status, 2);
    enact(S, g, { type: 'gov', kind: 'dissolve', author: L, backers: mem.filter(m => m.patron === L.id), against: [by && by.group === g.id ? by : null, ...keep], text: `${L.name} разгоняет вече «${g.name}» и правит один`, why: [`у ${nameCase(L, 'genitive')} своя дружина: ${mem.filter(m => m.patron === L.id).length} ${pl(mem.filter(m => m.patron === L.id).length, 'человек', 'человека', 'человек')} на жалованье`, g.room < 0.35 ? 'вокруг тесно: недовольным некуда уйти' : 'деревня проиграла войну, и люди хотят сильной руки', 'вече не может помешать тому, у кого есть оружие'],
      propose: 'решает', authorLine: `Разгоняет вече «${g.name}» и правит один`, lostLine: p => `Не может отстоять вече «${g.name}»: ${L.name} правит один`, grudge: `${fem(L, 'разогнал', 'разогнала')} вече` });
  }
  if (g.gov === 'assembly' && P.assembly < 0.5) {
    g.gov = 'chief';
    log(S, 'gov', `В «${g.name}» распускают вече`, g.home.x, g.home.y, g.hue, { why: 'Народное собрание запрещено вводными.', gs: [g.id] });
  } else if ((g.gov === 'chief' || g.gov === 'monarch') && P.assembly >= 0.5 && n >= 8 && g.norm > 0.45 && avg(mem, m => m.coop) > 0.42 && (g.trauma > 0 || g.coupCount > 0 || g.warsLost > 0 || g.scarce > S.tick) && (imA = imitP(S, g, o => o.gov === 'assembly'), rnd(S) < (0.003 + imA.p * 0.45) * (0.2 + 0.8 * (g.room === undefined ? 1 : g.room)) * (livesOffOthers(S, g, L) ? 0.5 : 1.3))) {
    // under a hereditary chief the assembly is his council: the office still passes in the line, but war and his share are decided together (Schapera 1956)
    g.gov = 'assembly'; g.imFrom = imA.p > 0.003 && imA.from && rnd(S) < imA.p * 0.45 / (imA.p * 0.45 + 0.003) ? imA.from.name : null;
    const first = !S.firstAssembly; S.firstAssembly = true;
    // the call comes from a coalition: a respected head of another line (Boehm), against the ruler and his men
    const A = (L.norm > 0.6 && L.coop > 0.6 && !g.dynasty) ? L : assemblyAuthor(S, g, L) || L; g.asmBy = A.id;
    const backers = topBy(adultsOf(S, g).filter(m => m !== L && m.patron !== L.id && (m.res > 0.35 || m.norm > 0.6)), m => m.status, 10);
    const against = A === L ? topBy(adultsOf(S, g).filter(m => m !== L && m.norm < 0.45 && m.ambition > 0.5), m => m.status, 2) : [L.ambition > 0.45 || g.dynasty ? L : null, ...topBy(mem.filter(m => m.patron === L.id), m => m.status, 1)];
    enact(S, g, { type: 'gov', kind: 'assembly', author: A, backers, against, extra: { first }, propose: A === L ? 'созывает сам вождь' : 'созвать вече требует',
      text: g.dynasty ? `В «${g.name}» наследный вождь ${L.name} отныне правит с советом` : first ? `Впервые в мире: «${g.name}» собирает вече` : `«${g.name}» собирает вече`, why: [g.coupCount ? `деревня пережила ${g.coupCount} ${pl(g.coupCount, 'переворот', 'переворота', 'переворотов')}` : g.warsLost ? 'деревня проиграла войну по воле одного человека' : 'деревня пережила тяжёлые годы', `здесь привыкли делить ${g.norm > 0.6 ? 'поровну' : 'почти поровну'} и договариваться`, 'теперь о войне, доле вождя и преемнике решает собрание', 'вече реже начинает войны и мягче к недовольным, но решения даются дольше'],
      authorLine: A === L ? `Созывает вече «${g.name}»: отныне о войне и доле решают вместе` : `Добивается вече в «${g.name}»: отныне ${L.name} решает не один`, lostLine: p => p === L ? `Вынужден${fem(p, '', 'а')} делить власть с вече «${g.name}»` : `Против вече в «${g.name}», но вече собирается`, grudge: `${fem(A, 'добился', 'добилась')} вече против вождя` });
    imNote(S, g);
  }
}

function money(S, g, L) {
  if (!L || !g.home || g.dead) return;
  const P = S.params, mem = g.members.map(id => S._a.get(id)).filter(Boolean), n = mem.length;
  if (g.coin && P.coin < 0.5) g.coin = false;
  let imC;
  if (!g.coin && P.coin >= 0.5 && g.workshop && (g.trades || 0) >= 6 && (imC = imitP(S, g, o => o.coin, true), imC.p *= 0.5, rnd(S) < (S.firstCoin ? 0.0002 : 0.00025) * ((g.trades || 0) >= 25 ? 2 : 0.3) + imC.p)) {
    g.coin = true; g.imFrom = S.firstCoin && imC.from && rnd(S) < imC.p / (imC.p + 0.0002) ? imC.from.name : null; S.stats.coinGroups = (S.stats.coinGroups || 0) + 1;
    const first = !S.firstCoin; S.firstCoin = true;
    log(S, 'money', first ? `Первая монета в мире: в «${g.name}» начинают чеканить деньги` : `В «${g.name}» начинают чеканить свою монету`, g.home.x, g.home.y, g.hue, { first, why: sent([`через «${g.name}» прошло ${g.trades} ${pl(g.trades, 'сделка', 'сделки', 'сделок')}`, 'меновая торговля неудобна: каждый раз нужно найти того, кому нужно именно твоё', 'мастерская и камень с холмов дают материал', 'монета не гниёт, поэтому богатство теперь можно копить, а значит, давать в долг']), gs: [g.id] });
    imNote(S, g);
  }
  if (!g.coin) { for (const m of mem) if (m.debt) { m.debt = 0; m.cred = null; m.bond = false; } return; }
  const f = g.faith && S.faiths && S.faiths[g.faith], ban = f && f.usury === 'ban';
  const allowed = P.usury >= 0.5 && !ban;
  const lenders = mem.filter(m => m.wealth > 16 && !m.debt).sort((a, b) => b.wealth - a.wealth);
  const lean = seasonOf(S.tick) === 0 || g.treasury < n * 3;
  for (const m of mem) {
    if (m.wealth >= (lean ? 4 : 0) || (m.debt || 0) > 18 || m === L || !lenders.length) continue;
    const ln = lenders.find(x => x !== m && x.wealth > 10 && (!m.cred || m.cred === x.id)); if (!ln) continue;
    ln.wealth -= 6; m.wealth += 6;
    if (!m.debt) { m.cred = ln.id; m.rate = allowed ? 0.15 + 0.35 * ln.ambition * (1 - ln.coop * 0.5) : 0; m.dt = S.tick; }
    m.debt = (m.debt || 0) + 6; ln.loans = (ln.loans || 0) + 1; S.stats.loans = (S.stats.loans || 0) + 1;
    if (allowed && !S.firstLoan) {
      S.firstLoan = true;
      log(S, 'debt', `Первый заём под проценты: ${m.name} берёт в долг у ${nameCase(ln, 'genitive')}`, m.x, m.y, g.hue, { first: true, why: sent([`${m.name} голодает, а у ${nameCase(ln, 'genitive')} скопилось ${Math.round(ln.wealth + 6)} в монете`, `долг растёт на ${P0(m.rate)} в год`, 'если не вернуть, должник попадёт в кабалу и будет отдавать всё, что заработает']), who: [m.id, ln.id], gs: [g.id] });
    }
  }
  for (const m of mem) if (m !== L && rnd(S) < 0.025) m.wealth -= 4 + rnd(S) * 4;
  for (const m of mem) {
    if (!m.debt) continue;
    const cr = S._a.get(m.cred);
    if (!cr || cr.group !== g.id) { m.debt = 0; m.cred = null; m.bond = false; continue; }
    m.debt *= 1 + (m.rate || 0) / 12;
    const keep = m.bond ? 1 : 7;
    if (m.wealth > keep + 1) { const pay = Math.min(m.wealth - keep, m.debt); m.wealth -= pay; cr.wealth += pay; m.debt -= pay; }
    if (m.debt < 0.5) { m.debt = 0; m.cred = null; m.bond = false; continue; }
    if (!m.bond && m.rate > 0 && (m.debt > 14 || (S.tick - m.dt > 540 && m.debt > 6))) {
      m.bond = true; S.stats.bonds = (S.stats.bonds || 0) + 1; bio(S, m, 'bond', `Попадает в кабалу к ${nameCase(cr, 'dative')}: долг ${Math.round(m.debt)}`); bond(S, m, cr, 'enemy', `держит в кабале за долг ${Math.round(m.debt)}`, 0.6);
      if ((g.bondLog || 0) < S.tick) {
        g.bondLog = S.tick + 360 * 3;
        log(S, 'debt', `${m.name} попадает в кабалу к ${nameCase(cr, 'dative')}`, m.x, m.y, g.hue, { why: sent([`долг вырос до ${Math.round(m.debt)} под ${P0(m.rate)} годовых и уже не гасится`, `теперь почти всё, что зарабатывает ${m.name}, уходит ${nameCase(cr, 'dative')}`, `у ${nameCase(cr, 'genitive')} уже ${cr.loans || 1} ${pl(cr.loans || 1, 'заём', 'займа', 'займов')}`]), who: [m.id, cr.id], gs: [g.id] });
      }
    }
    if (m.bond) { m.res = clamp(m.res + 0.04, 0, 1); bump(m, cr, -0.04); m.status *= 0.97; cr.status += 0.05; }
  }
  const bonds = mem.filter(m => m.bond && m !== L);
  if (bonds.length >= 2 && avg(bonds, m => m.res) > 0.45 && rnd(S) < 0.2) {
    const total = bonds.reduce((s2, m) => s2 + m.debt, 0), creds = [...new Set(bonds.map(m => m.cred))].map(id => S._a.get(id)).filter(Boolean);
    if (g.gov === 'assembly' || L.coop > 0.62) {
      for (const m of mem) if (m.debt) { if (m.bond) bio(S, m, 'freed', `Вече прощает долги: ${m.sex === 'f' ? 'свободна' : 'свободен'} от кабалы`); m.debt = 0; m.cred = null; m.bond = false; m.res *= 0.5; bump(m, L, 0.15); }
      for (const c of creds) bump(c, L, -0.3);
      S.stats.jubilees = (S.stats.jubilees || 0) + 1;
      const by = g.gov === 'assembly' && g.asmBy && S._a.get(g.asmBy), A = by && by.group === g.id ? by : L;
      enact(S, g, { type: 'debt', kind: 'jubilee', author: A, backers: bonds, against: topBy(creds.filter(c => c.group === g.id), c => c.loans || 0, 3), text: `${g.gov === 'assembly' ? `Вече «${g.name}»` : `${L.name}`} списывает все долги`, why: [`в кабале ${bonds.length} ${pl(bonds.length, 'человек', 'человека', 'человек')}, общий долг ${Math.round(total)}`, 'кабальные готовы бунтовать', g.gov === 'assembly' ? 'на вече должников больше, чем ростовщиков' : `${L.name} ${word('coop', L.coop, L)}`, creds.every(c => c === L) ? `${L.name} ${fem(L, 'сам', 'сама')} давал${fem(L, '', 'а')} эти займы и теряет их` : `ростовщики ${creds.filter(c => c !== L).slice(0, 2).map(c => c.name).join(' и ')} теряют деньги`],
        authorLine: creds.every(c => c === A) ? `Прощает должникам «${g.name}» всё, что они ${fem(A, 'ему', 'ей')} должны` : `Добивается, чтобы в «${g.name}» простили все долги`, lostLine: p => `Теряет всё, что давал в долг: «${g.name}» прощает долги`, grudge: `${fem(A, 'списал', 'списала')} долги и разорил${fem(A, '', 'а')} меня` });
    } else {
      const ch = bonds.slice().sort((a, b) => b.ambition - a.ambition)[0];
      for (const m of bonds) { m.debt = 0; m.cred = null; m.bond = false; }
      const ng = createGroup(S, ch, bonds.filter(m => m !== ch), g.id);
      S.hostility[key(g.id, ng.id)] = 0.8; S.stats.schisms++; S.stats.debtRevolts = (S.stats.debtRevolts || 0) + 1;
      log(S, 'debt', `Восстание должников в «${g.name}»: ${ch.name} уводит ${bonds.length - 1} ${pl(bonds.length - 1, 'кабального', 'кабальных', 'кабальных')} и основывает «${ng.name}»`, ch.x, ch.y, ng.hue, { why: sent([`в кабале ${bonds.length} ${pl(bonds.length, 'человек', 'человека', 'человек')}, общий долг ${Math.round(total)}`, `${L.name} на стороне ростовщиков и долги не прощает`, 'уйти — единственный способ не платить']), who: bonds.map(m => m.id).concat(creds.map(c => c.id)), gs: [g.id, ng.id] });
    }
  }
}

