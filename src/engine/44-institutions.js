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
    log(S, 'land', first ? `Впервые в мире: «${g.name}» делит поля в собственность` : `«${g.name}» делит поля в собственность`, g.home.x, g.home.y, g.hue, { first, why: sent([`в деревне ${n} человек и ${g.fields.length} ${pl(g.fields.length, 'поле', 'поля', 'полей')}`, g.dynasty ? `правит династия ${g.dynName}, и знать хочет закрепить землю за собой` : 'добычу и так делят по статусу, и статусные хотят закрепить поля за собой', `поля получили ${owners.length} самых влиятельных`, 'теперь хозяин поля забирает треть урожая, а остальные работают на чужой земле батраками', 'поля переходят по наследству детям']), who: owners.map(m => m.id), gs: [g.id] });
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
  if (g.gov === 'assembly' && P.assembly >= 0.5 && L.ambition > 0.55 && (g.room !== undefined && g.room < 0.35 || g.warsLost > (g.wl0 || 0)) && mem.filter(m => m.patron === L.id).length >= 2 && rnd(S) < 0.015) {
    g.gov = 'chief'; g.wl0 = g.warsLost;
    log(S, 'gov', `${L.name} разгоняет вече «${g.name}» и правит один`, g.home.x, g.home.y, g.hue, { why: sent([`у ${L.name} своя дружина: ${mem.filter(m => m.patron === L.id).length} ${pl(mem.filter(m => m.patron === L.id).length, 'человек', 'человека', 'человек')} на жалованье`, g.room < 0.35 ? 'вокруг тесно: недовольным некуда уйти' : 'деревня проиграла войну, и люди хотят сильной руки', 'вече не может помешать тому, у кого есть оружие']), who: [L.id], gs: [g.id] });
  }
  if (g.gov === 'assembly' && P.assembly < 0.5) {
    g.gov = 'chief';
    log(S, 'gov', `В «${g.name}» распускают вече`, g.home.x, g.home.y, g.hue, { why: 'Народное собрание запрещено вводными.', gs: [g.id] });
  } else if (g.gov === 'chief' && P.assembly >= 0.5 && !g.dynasty && n >= 8 && g.norm > 0.45 && avg(mem, m => m.coop) > 0.42 && (g.trauma > 0 || g.coupCount > 0 || g.warsLost > 0 || g.scarce > S.tick) && (imA = imitP(S, g, o => o.gov === 'assembly'), rnd(S) < (0.003 + imA.p * 0.45) * (0.2 + 0.8 * (g.room === undefined ? 1 : g.room)))) {
    g.gov = 'assembly'; g.imFrom = imA.p > 0.003 && imA.from && rnd(S) < imA.p * 0.45 / (imA.p * 0.45 + 0.003) ? imA.from.name : null;
    const first = !S.firstAssembly; S.firstAssembly = true;
    log(S, 'gov', first ? `Впервые в мире: «${g.name}» собирает вече` : `«${g.name}» собирает вече`, g.home.x, g.home.y, g.hue, { first, why: sent([g.coupCount ? `деревня пережила ${g.coupCount} ${pl(g.coupCount, 'переворот', 'переворота', 'переворотов')}` : g.warsLost ? 'деревня проиграла войну по воле одного человека' : 'деревня пережила тяжёлые годы', `люди здесь склонны делить поровну (${P0(g.norm)}) и договариваться`, 'теперь о войне, доле лидера и преемнике решает собрание', 'вече реже начинает войны и мягче к недовольным, но решения даются дольше']), gs: [g.id] });
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
      log(S, 'debt', `Первый заём под проценты: ${m.name} берёт в долг у ${ln.name}`, m.x, m.y, g.hue, { first: true, why: sent([`${m.name} голодает, а у ${ln.name} скопилось ${Math.round(ln.wealth + 6)} в монете`, `долг растёт на ${P0(m.rate)} в год`, 'если не вернуть, должник попадёт в кабалу и будет отдавать всё, что заработает']), who: [m.id, ln.id], gs: [g.id] });
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
      m.bond = true; S.stats.bonds = (S.stats.bonds || 0) + 1; bio(S, m, 'bond', `Попадает в кабалу к ${cr.name}: долг ${Math.round(m.debt)}`); bond(S, m, cr, 'enemy', `держит в кабале за долг ${Math.round(m.debt)}`, 0.6);
      if ((g.bondLog || 0) < S.tick) {
        g.bondLog = S.tick + 360 * 3;
        log(S, 'debt', `${m.name} попадает в кабалу к ${cr.name}`, m.x, m.y, g.hue, { why: sent([`долг вырос до ${Math.round(m.debt)} под ${P0(m.rate)} годовых и уже не гасится`, `теперь почти всё, что зарабатывает ${m.name}, уходит ${cr.name}`, `у ${cr.name} уже ${cr.loans || 1} ${pl(cr.loans || 1, 'заём', 'займа', 'займов')}`]), who: [m.id, cr.id], gs: [g.id] });
      }
    }
    if (m.bond) { m.res = clamp(m.res + 0.04, 0, 1); bump(m, cr, -0.04); m.status *= 0.97; cr.status += 0.05; }
  }
  const bonds = mem.filter(m => m.bond && m !== L);
  if (bonds.length >= 2 && avg(bonds, m => m.res) > 0.45 && rnd(S) < 0.2) {
    const total = bonds.reduce((s2, m) => s2 + m.debt, 0), creds = [...new Set(bonds.map(m => m.cred))].map(id => S._a.get(id)).filter(Boolean);
    if (g.gov === 'assembly' || L.coop > 0.62) {
      for (const m of mem) if (m.debt) { if (m.bond) bio(S, m, 'freed', `Вече прощает долги: ${m.sex === 'f' ? 'свободна' : 'свободен'} от кабалы`); m.debt = 0; m.cred = null; m.bond = false; m.res *= 0.5; bump(m, L, 0.15); }
      for (const c of creds) bump(c, L, -0.3); bond(S, c, L, 'rival', 'списал долги, разорив заимодавцев', 0.5);
      S.stats.jubilees = (S.stats.jubilees || 0) + 1;
      log(S, 'debt', `${g.gov === 'assembly' ? `Вече «${g.name}»` : `${L.name}`} списывает все долги`, g.home.x, g.home.y, g.hue, { why: sent([`в кабале ${bonds.length} ${pl(bonds.length, 'человек', 'человека', 'человек')}, общий долг ${Math.round(total)}`, 'кабальные готовы бунтовать', g.gov === 'assembly' ? 'на вече должников больше, чем ростовщиков' : `${L.name} склонен договариваться (${P0(L.coop)})`, `ростовщики ${creds.slice(0, 2).map(c => c.name).join(' и ')} теряют деньги и затаили обиду на лидера`]), who: bonds.map(m => m.id).concat(creds.map(c => c.id)), gs: [g.id] });
    } else {
      const ch = bonds.slice().sort((a, b) => b.ambition - a.ambition)[0];
      for (const m of bonds) { m.debt = 0; m.cred = null; m.bond = false; }
      const ng = createGroup(S, ch, bonds.filter(m => m !== ch), g.id);
      S.hostility[key(g.id, ng.id)] = 0.8; S.stats.schisms++; S.stats.debtRevolts = (S.stats.debtRevolts || 0) + 1;
      log(S, 'debt', `Восстание должников в «${g.name}»: ${ch.name} уводит ${bonds.length - 1} ${pl(bonds.length - 1, 'кабального', 'кабальных', 'кабальных')} и основывает «${ng.name}»`, ch.x, ch.y, ng.hue, { why: sent([`в кабале ${bonds.length} ${pl(bonds.length, 'человек', 'человека', 'человек')}, общий долг ${Math.round(total)}`, `${L.name} на стороне ростовщиков и долги не прощает`, 'уйти — единственный способ не платить']), who: bonds.map(m => m.id).concat(creds.map(c => c.id)), gs: [g.id, ng.id] });
    }
  }
}

