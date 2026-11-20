// Opt-in observations for the Node audit. They never affect a simulation decision.
function noteAgeExit(S, a, why) {
  const audit = S.ageAudit;
  const unobserved = why === 'emigr' || why === 'move' || why === 'vanish';
  if (!unobserved && a.age >= 15) {
    audit.adultDeaths++;
    audit.ageAtDeath += a.age;
  }
  if (!(a.bornT > 0 && a.bornT <= audit.lastBirthTick)) return;
  if (S.tick - a.bornT >= 60 * 360) audit.reached60++;
  else if (unobserved) audit.leftBefore60++;
}
