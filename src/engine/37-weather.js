/* ---------- weather and the agricultural year ---------- */
const STORM_CHANCE = [0.09, 0.045, 0.02, 0.06];
const RAIN_CHANCE = [0.18, 0.29, 0.19, 0.31];

function advanceWeather(S) {
  const w = S.weather ||= { rng: (S.rng ^ 0x149e63b5) | 0, stormDays: 0, seaOpenShare: 1, frostYear: -1 };
  const day = S.tick % 360, season = seasonOf(S.tick), year = Math.floor(S.tick / 360);
  const draw = rnd(w);
  const drought = S.tick < S.drought;
  const storm = draw < STORM_CHANCE[season];
  const frost = !drought && !storm && season === 3 && day < 318 && draw > 0.992 && w.frostYear !== year;
  const rain = !drought && !storm && !frost && draw < RAIN_CHANCE[season];
  w.kind = storm ? 'storm' : drought ? 'drought' : frost ? 'frost' : rain ? 'rain' : 'clear';
  w.year = year;
  w.stormDays += Number(storm);
  if (frost) w.frostYear = year;
  if (S.tick % 30 === 0) {
    w.seaOpenShare = (30 - w.stormDays) / 30;
    w.stormDays = 0;
  }
}

function farmQuota(season, fieldCount, available) {
  if (!fieldCount || !available || !season) return 0;
  if (season === 2) return Math.min(fieldCount, Math.max(1, Math.floor(available * 0.16)));
  if (season === 3) return Math.min(fieldCount * 3, Math.ceil(available * 0.60));
  return fieldCount * 2;
}

function farmYield(S, field, season, food, effort) {
  const weather = S.weather, year = weather.year;
  if (field.cropYear !== year) {
    field.cropYear = year;
    field.sown = 0;
    field.tended = 0;
  }
  const rain = weather?.kind === 'rain' ? 1.06 : 1;
  if (season === 1) {
    field.sown = Math.min(1, field.sown + effort * 0.022 * rain);
    return food * 0.86 * rain;
  }
  if (season === 2) {
    field.tended = Math.min(1, field.tended + effort * 0.029 * rain);
    return food * 1.2 * rain;
  }
  const frost = weather?.frostYear === year ? 0.81 : 1;
  return food * (0.85 + 0.55 * field.sown + 0.23 * field.tended) * frost;
}
