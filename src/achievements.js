export const ACHIEVEMENTS = [
  { id: 'first-hatch',   test: (p) => p.level >= 2 },
  { id: 'first-feat',    test: (p) => p.lifetime.features >= 1 },
  { id: 'first-green',   test: (p) => p.lifetime.testsPassed >= 1 },
  { id: 'first-release', test: (p) => p.lifetime.releases >= 1 },
  { id: 'week-streak',   test: (p) => p.streak.days >= 7 },
  { id: 'century',       test: (p) => p.lifetime.commits >= 100 },
];

export function unlockAchievements(pet) {
  const held = new Set((pet.achievements || []).map((a) => a.id));
  return ACHIEVEMENTS.filter((a) => !held.has(a.id) && a.test(pet)).map((a) => a.id);
}
