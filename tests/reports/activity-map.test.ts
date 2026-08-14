import { describe, expect, it } from "vitest";
import { activityTrail, hexBins } from "@/features/reports/domain/activity-map";

describe("activity map", () => {
  const markers = [
    {
      gameTimeMs: 1,
      kind: "pointer_sample",
      normalizedX: 0.2,
      normalizedY: 0.3,
      actionLabel: null,
    },
    {
      gameTimeMs: 2,
      kind: "gameplay_action",
      normalizedX: null,
      normalizedY: null,
      actionLabel: "spell_1",
    },
  ];
  it("bins positioned markers and keeps coordinate-less actions off-map", () => {
    expect(hexBins(markers)).toHaveLength(1);
    expect(activityTrail(markers, 2).markers).toHaveLength(2);
  });
});
