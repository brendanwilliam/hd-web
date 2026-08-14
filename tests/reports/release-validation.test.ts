import { describe, expect, it } from "vitest";
import { activityTrail, hexBins } from "@/features/reports/domain/activity-map";
import { clampCursor } from "@/features/reports/domain/playback-model";

describe("HD Viz release safeguards", () => {
  it("keeps pointerless actions chronological but never places them on the map", () => {
    const records = [
      {
        gameTimeMs: 1_000,
        kind: "pointer_sample",
        normalizedX: 0.2,
        normalizedY: 0.8,
        actionLabel: null,
      },
      {
        gameTimeMs: 1_100,
        kind: "gameplay_action",
        normalizedX: null,
        normalizedY: null,
        actionLabel: "spell_1",
      },
    ];
    expect(activityTrail(records, 1_100).markers).toHaveLength(2);
    expect(hexBins(records)).toHaveLength(1);
  });
  it("clamps paused and delayed cursor updates without advancing wall-clock time", () => {
    expect(clampCursor(-1, 60_000)).toBe(0);
    expect(clampCursor(70_000, 60_000)).toBe(60_000);
  });
  it("bounds the retained trail at the maximum user-visible marker budget", () => {
    const records = Array.from({ length: 50_000 }, (_, index) => ({
      gameTimeMs: index + 1,
      kind: "gameplay_action",
      normalizedX: null,
      normalizedY: null,
      actionLabel: "spell_1",
    }));
    expect(activityTrail(records, 50_000).markers).toHaveLength(20);
  });
});
