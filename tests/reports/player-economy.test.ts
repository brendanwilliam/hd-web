import { describe, expect, it } from "vitest";
import { levelProgress } from "@/features/reports/domain/player-economy";

describe("levelProgress", () => {
  it("calculates every ordinary Summoner's Rift level threshold", () => {
    for (let level = 1; level < 18; level += 1) {
      const result = levelProgress(
        level,
        [
          0, 280, 660, 1140, 1720, 2400, 3180, 4060, 5040, 6120, 7300, 8580, 9960, 11440,
          13020, 14700, 16380,
        ][level - 1],
      );
      expect(result.level).toBe(level);
      expect(result.progressPercent).toBe(0);
      expect(result.nextLevelAvailable).toBe(true);
    }
  });

  it("does not infer a level-19 or level-20 target", () => {
    expect(levelProgress(18, 18_360)).toMatchObject({
      level: 18,
      nextLevelAvailable: false,
      xpForNextLevel: null,
    });
    expect(levelProgress(20, 20_000)).toMatchObject({
      level: 20,
      nextLevelAvailable: false,
      xpForNextLevel: null,
    });
  });
});
