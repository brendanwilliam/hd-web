import { describe, expect, it } from "vitest";
import {
  LIFECYCLE_RULESETS,
  compareGamePatches,
  parseGamePatch,
  predictedRespawnAtMs,
  respawnTimeIncrease,
  selectLifecycleRules,
} from "@/features/reports/domain/lifecycle-rules";

describe("timeline lifecycle rules", () => {
  it("compares Riot versions numerically and rejects malformed versions", () => {
    expect(
      compareGamePatches(parseGamePatch("14.10.0")!, parseGamePatch("14.9.9")!),
    ).toBeGreaterThan(0);
    expect(parseGamePatch("14.10")).toBeNull();
    expect(selectLifecycleRules("unknown").availability).toBe("unavailable");
  });

  it("uses a timer override only from its effective patch", () => {
    const before = selectLifecycleRules("14.15.9");
    const after = selectLifecycleRules("14.16.0");
    expect(before.applicableRulePatch).toBe("0.0.0");
    expect(after.applicableRulePatch).toBe("14.16.0");
    expect(before.rules!.championBaseRespawnMs[0]).toBe(6_000);
    expect(after.rules!.championBaseRespawnMs[0]).toBe(10_000);
  });

  it("exposes the documented objective timings and Elder replacement", () => {
    const rules = LIFECYCLE_RULESETS[1];
    expect(rules.objectives.elemental_dragon).toMatchObject({
      initialSpawnAtMs: 300_000,
      respawnAfterMs: 300_000,
      replacement: "elder_after_dragon_soul",
    });
    expect(rules.objectives.elder_dragon.respawnAfterMs).toBe(360_000);
    expect(rules.objectives.voidgrubs).toMatchObject({
      initialSpawnAtMs: 480_000,
      despawnAtMs: 885_000,
      despawnInCombatAtMs: 895_000,
    });
    expect(rules.dragonSequence).toMatchObject({
      initialDistinctCount: 3,
      soulStackCount: 4,
    });
    expect(rules.elderAspectDurationMs).toBe(150_000);
  });

  it("uses the selected patch and late-game scaling for predicted respawns", () => {
    const pre = selectLifecycleRules("14.15.0").rules!;
    const current = selectLifecycleRules("26.15.0").rules!;
    expect(predictedRespawnAtMs(0, 1, pre)).toBe(6_000);
    expect(predictedRespawnAtMs(0, 1, current)).toBe(10_000);
    expect(respawnTimeIncrease(15 * 60_000 + 1)).toBe(0.00425);
    expect(predictedRespawnAtMs(0, 0, current)).toBeNull();
  });
});
