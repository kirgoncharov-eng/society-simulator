/* ---------- households: a family lives in its own house ---------- */
// A family is a married couple living in the same village with their unmarried children. A widowed parent lives with a
// married child; a grown child who is not married lives with the parents; whoever has nobody keeps a household of their own.
// Each house has an id and an owner; a person has a.house (the house they live in), a.lodger when living in someone else's.
function houseOf(g, id) { if (!g || !id) return null; for (const h of g.houses) if (h.id === id) return h; return null; }
const livingHouses = g => g.houses.filter(h => !h.ruined);
// group members into families: returns Map familyKey -> [members]; the key is the head's id (husband first)
function familiesOf(S, g) {
  const mem = g.members.map(id => S._a.get(id)).filter(Boolean), here = new Set(g.members), head = new Map();
  const coupled = a => a.spouse && here.has(a.spouse);
  for (const a of mem) if (coupled(a)) { const sp = S._a.get(a.spouse); head.set(a.id, a.sex === 'm' ? a.id : sp.id); }
  const kidHead = a => { for (const pid of [a.father, a.mother]) if (pid && here.has(pid)) { const p = S._a.get(pid); if (head.has(p.id)) return head.get(p.id); } return null; };
  // unmarried grown children stay with their parents
  for (const a of mem) if (!head.has(a.id)) { const h = kidHead(a); if (h) head.set(a.id, h); }
  // a widowed parent moves in with a married child
  for (const a of mem) if (!head.has(a.id)) { const c = mem.find(o => (o.mother === a.id || o.father === a.id) && coupled(o)); if (c) head.set(a.id, head.get(c.id)); }
  // a lone parent heads a household with their unmarried children
  for (const a of mem) if (!head.has(a.id)) { head.set(a.id, a.id); for (const o of mem) if ((o.mother === a.id || o.father === a.id) && !head.has(o.id)) head.set(o.id, a.id); }
  const fam = new Map();
  for (const a of mem) { const k = head.get(a.id); if (!fam.has(k)) fam.set(k, []); fam.get(k).push(a); }
  return fam;
}
// the event of a house owner's death, for the heir's chronicle to point at
function ownerDeath(S, g, o) { return note(S, 'death', `Умирает ${o.name}, ${fem(o, 'хозяин', 'хозяйка')} дома в «${g.name}»`, o.x, o.y, g.hue, { who: [o.id], gs: [g.id] }).id; }
function householdsMonth(S) {
  for (const g of S.groups) {
    if (!g.home || g.dead) continue;
    for (const h of g.houses) if (!h.id) h.id = S.nextId++;
    const fam = familiesOf(S, g), live = livingHouses(g);
    // a household of one with no spouse and no children does not set up house: such people live as hands or lodgers in
    // someone else's home (unless they already own one, like a widow who stays)
    const kidsOf1 = new Set((S.kids || []).flatMap(k => [k.mo, k.fa]));
    const ownsHouse = new Set(live.map(h => h.owner));
    const settled = ms => ms.length > 1 || kidsOf1.has(ms[0].id) || ownsHouse.has(ms[0].id);
    g.wantH = [...fam.values()].filter(settled).length;
    // houses whose owner is gone: the widow keeps it, else the eldest child in the village, else it stands empty
    for (const h of live) {
      const ow = h.owner && S._a.get(h.owner);
      if (ow && ow.group === g.id) { h.spouseOf = ow.spouse || null; continue; }
      if (!h.owner) continue;
      const o = S._a.get(h.owner), dead = !o, oname = h.oname || 'хозяина';
      const inside = g.members.map(id => S._a.get(id)).filter(m => m && m.house === h.id && !m.lodger);
      const widow = inside.find(m => m.spouse === h.owner || (h.spouseOf && m.id === h.spouseOf));
      const heirs = inside.filter(m => m.mother === h.owner || m.father === h.owner).sort((a, b) => b.age - a.age);
      const next = widow || heirs[0] || inside.sort((a, b) => b.age - a.age)[0];
      const ref = dead && h.deathEv ? h.deathEv : null;
      if (next) {
        h.owner = next.id; h.oname = next.name; h.spouseOf = null;
        if (dead) bio(S, next, 'inheritHouse', next === widow ? `${fem(next, 'Вдовец', 'Вдова')} остаётся в доме` : `Наследует дом ${oname}`, ref);
      } else { h.owner = null; h.oname = null; h.emptyT = S.tick; }
    }
    // everyone checks their place: a house that burned or that they left no longer counts
    for (const id of g.members) { const a = S._a.get(id); const h = houseOf(g, a.house); if (!h || h.ruined) { a.house = null; a.lodger = false; } }
    // each family keeps the house its head (or anyone of them) already owns; others take a free house or lodge with kin
    const owned = new Set(live.filter(h => h.owner && S._a.has(h.owner) && S._a.get(h.owner).group === g.id).map(h => h.id));
    const homeless = [];
    for (const [k, ms] of fam) {
      let h = live.find(x => x.owner && ms.some(m => m.id === x.owner));
      if (h) { for (const m of ms) { m.house = h.id; m.lodger = false; } continue; }
      homeless.push([k, ms]);
    }
    for (const [k, ms] of homeless) {
      const H = S._a.get(k);
      let h = settled(ms) ? live.find(x => !owned.has(x.id) && !x.owner) : null;
      if (h) {
        owned.add(h.id); h.owner = H.id; h.oname = H.name; h.emptyT = null;
        const sp = H.spouse && S._a.get(H.spouse); h.spouseOf = sp ? sp.id : null;
        for (const m of ms) { m.house = h.id; m.lodger = false; }
        bio(S, H, 'house', `Получает свой дом в «${g.name}»${sp ? ` и живёт там с ${fem(sp, 'мужем', 'женой')} ${sp.name}` : ''}`);
        if (sp) bio(S, sp, 'house', `Переезжает с ${fem(H, 'мужем', 'женой')} ${H.name} в свой дом в «${g.name}»`);
        continue;
      }
      // no free house: lodge with the husband's parents, else the wife's, else any kin, else wherever there is room
      const kinHome = m => { for (const pid of [m.father, m.mother]) { const p = pid && S._a.get(pid); if (p && p.group === g.id && p.house) return p.house; } return null; };
      const sp = H.spouse && S._a.get(H.spouse);
      let hid = kinHome(H) || (sp && kinHome(sp));
      if (!hid) { const kn = ms.length ? g.members.map(id => S._a.get(id)).find(o => o && o.house && !o.lodger && kin(o, H)) : null; hid = kn ? kn.house : null; }
      if (!hid) { const room = live.map(x => [x, g.members.filter(id => S._a.get(id).house === x.id).length]).sort((p, q) => p[1] - q[1])[0]; hid = room ? room[0].id : null; }
      for (const m of ms) { m.house = hid; m.lodger = !!hid; }
    }
    // a house nobody has lived in for years falls into ruin
    for (const h of live) if (!h.owner && h.emptyT && S.tick - h.emptyT > 360 * 4 && !g.members.some(id => S._a.get(id).house === h.id)) { h.ruined = true; h.emptyT = null; }
  }
}
// call from removeAgent: remember the owner's death so the heir's line can point to it
function houseOwnerDies(S, a) {
  const g = a.group && S._g.get(a.group); if (!g || !g.home) return;
  const h = houseOf(g, a.house); if (h && h.owner === a.id) { h.deathEv = ownerDeath(S, g, a); h.oname = a.name; }
}
// who shares a's house, for the person card
function housemates(S, a) {
  const g = a.group && S._g.get(a.group), h = houseOf(g, a.house); if (!h) return null;
  const with_ = g.members.map(id => S._a.get(id)).filter(o => o && o !== a && o.house === h.id);
  const kids = (S.kids || []).filter(k => with_.concat([a]).some(o => o.id === k.mo || o.id === k.fa)).length;
  const owner = S._a.get(h.owner);
  return { house: h, owner, with: with_, kids };
}
