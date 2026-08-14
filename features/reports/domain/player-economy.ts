export type LevelProgress = {
  level: number;
  totalXp: number;
  xpWithinLevel: number | null;
  xpForNextLevel: number | null;
  progressPercent: number | null;
  nextLevelAvailable: boolean;
};

// Summoner's Rift cumulative champion XP through level 18. Levels 19–20 are
// patch-26.1 top-lane quest dependent, so they are never inferred from XP.
// Source: https://wiki.leagueoflegends.com/en-us/Experience_(champion)
const cumulativeXp = [
  0, 280, 660, 1140, 1720, 2400, 3180, 4060, 5040, 6120, 7300, 8580, 9960, 11440, 13020,
  14700, 16380, 18360,
];

export function levelProgress(level: number, totalXp: number): LevelProgress {
  const observedLevel = Math.max(1, Math.floor(level));
  const observedXp = Math.max(0, totalXp);
  if (observedLevel >= 18) {
    return {
      level: observedLevel,
      totalXp: observedXp,
      xpWithinLevel: null,
      xpForNextLevel: null,
      progressPercent: null,
      nextLevelAvailable: false,
    };
  }
  const start = cumulativeXp[observedLevel - 1];
  const next = cumulativeXp[observedLevel];
  const required = next - start;
  const earned = Math.max(0, observedXp - start);
  return {
    level: observedLevel,
    totalXp: observedXp,
    xpWithinLevel: earned,
    xpForNextLevel: required,
    progressPercent: Math.min(100, (earned / required) * 100),
    nextLevelAvailable: true,
  };
}
