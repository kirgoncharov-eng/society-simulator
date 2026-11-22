// The same winter household has a longer walk across the ford, regardless of playback.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SIM = require('../dist/sim.cjs');
const DAY = SIM.DAY_MINUTES;
const copy = S => SIM.restore(SIM.serialize(S));

const winter = SIM.newWorld(5000, {});
winter.tick = 4;
const riverX = 25, ford = 30 * 50 + riverX;
winter.ter = Array.from({ length: 2500 }, (_, i) => i % 50 === riverX ? 'w' : 'g').join('');
winter.ford = { [ford]: 1 };
const village = winter.groups[0];
const far = winter._a.get(village.members[1]), near = winter._a.get(village.members[2]);
village.home = { x: 410, y: 410 };
village.houses = [{ id: 1, ...village.home, owner: far.id }];
village.fields = [{ x: 610, y: 410, fert: 1 }, { x: 450, y: 410, fert: 1 }];
village.wsrc = { x: 350, y: 410, d: 60, kind: 'spring' };
village.well = null;
for (const [slot, adult] of [far, near].entries()) {
  Object.assign(adult, { ...village.home, job: 'farm', slot, house: 1, load: 0, haul: false });
}
winter.kids.push({ t: winter.tick - 2 * 360, mo: far.id, fa: null, g: village.id, sex: 'f', ...village.home });
assert.ok(SIM.kidsOf(winter, far));
const before = SIM.serialize(winter);
const { plans, end } = SIM.prepareDay(winter);
const crossing = plans.get(far.id), short = plans.get(near.id);
assert.equal(SIM.serialize(winter), before, 'Planning changed the opening snapshot');
assert.equal(crossing.kind, 'farm');
assert.ok(crossing.commuteMinutes > short.commuteMinutes);
assert.ok(crossing.route.points.some(p => Math.floor(p.x / 20) === riverX && Math.floor(p.y / 20) === 30));
assert.equal(end._a.get(far.id).commute, crossing.commuteMinutes);
assert.equal(end.tick, winter.tick + 1);
const position = {};
SIM.routinePosition(crossing, crossing.depart, position);
assert.deepEqual(position, crossing.origin);
SIM.routinePosition(crossing, crossing.arrive, position);
assert.deepEqual(position, crossing.destination);
SIM.routinePosition(crossing, crossing.finish, position);
assert.deepEqual(position, crossing.origin);

const closed = copy(winter);
closed.ford = {};
assert.ok(SIM.prepareDay(closed).plans.get(far.id).blocked, 'A closed ford allowed passage');
const bridged = copy(closed);
bridged.bridge = { [20 * 50 + riverX]: 1 };
assert.ok(SIM.prepareDay(bridged).plans.get(far.id).commuteMinutes < crossing.commuteMinutes);

const noon = copy(winter);
SIM.advanceMinutes(noon, 14 * 60 + 37);
const loaded = copy(noon);
assert.equal(loaded.minute, 877);
assert.deepEqual(SIM.prepareDay(loaded).plans.get(far.id), crossing);
SIM.advanceMinutes(loaded, DAY - 877);
assert.equal(SIM.serialize(loaded), SIM.serialize(end), 'Midday reload changed midnight');
assert.equal(SIM.eventTime({ t: end.tick, minute: 0 }), winter.tick * DAY);
assert.equal(SIM.eventTime({ t: end.tick, minute: 18 * 60 }), winter.tick * DAY + 18 * 60);
assert.equal(SIM.eventTime({ t: end.tick }), end.tick * DAY);

const snapshots = [1, 7, 30].map(batch => {
  let world = copy(winter);
  for (let elapsed = 0; elapsed < 91; elapsed += batch) {
    SIM.advanceMinutes(world, Math.min(batch, 91 - elapsed) * DAY);
  }
  SIM.advanceMinutes(world, 877);
  world = copy(world);
  SIM.advanceMinutes(world, DAY - 877);
  return SIM.serialize(world);
});
assert.equal(snapshots[0], snapshots[1]);
assert.equal(snapshots[0], snapshots[2]);

// Force an inland route more than 24 km long without giving the walker shortcuts.
const road = copy(winter);
const terrain = new Array(2500).fill('s');
for (let row = 2; row <= 14; row += 2) {
  for (let x = 2; x <= 47; x++) terrain[row * 50 + x] = 'g';
  if (row < 14) terrain[(row + 1) * 50 + (row % 4 === 2 ? 47 : 2)] = 'g';
}
road.ter = terrain.join('');
for (const a of road.agents) { a.x = 50; a.y = 50; }
const traveller = road._a.get(far.id);
traveller.relocation = true;
road._g.get(village.id).home = { x: 950, y: 290 };
const firstLeg = SIM.prepareDay(road);
const march = firstLeg.plans.get(traveller.id);
assert.ok(Math.abs(march.distance * (SIM.CELL_METRES / 20) - 24000) < 0.001);
assert.ok(firstLeg.end._a.get(traveller.id).relocation, 'The long route should continue tomorrow');
const secondLeg = SIM.prepareDay(firstLeg.end);
assert.deepEqual(secondLeg.plans.get(traveller.id).origin, march.destination);
assert.notDeepEqual(secondLeg.plans.get(traveller.id).destination, march.destination);

const shortTrip = copy(winter);
shortTrip._a.get(far.id).relocation = true;
shortTrip._g.get(village.id).home = { x: 610, y: 410 };
const arrived = SIM.prepareDay(shortTrip);
assert.equal(arrived.end._a.get(far.id).relocation, undefined);
assert.deepEqual(arrived.plans.get(far.id).destination, { x: 610, y: 410 });

console.log('clock: winter ford, closed crossing, bridge, 14:37 restore, day batches and multi-day trip passed');
