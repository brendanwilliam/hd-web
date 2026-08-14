import { describe, expect, it } from "vitest";
import { championDamageWindow } from "@/features/reports/domain/champion-damage";

describe("championDamageWindow", () => {
  it("keeps observed frame precision and derives only consecutive-frame deltas", () => {
    expect(
      championDamageWindow(
        [
          {
            timestamp: 60_000,
            participantId: 1,
            total: 100,
            physical: 40,
            magic: 50,
            trueDamage: 10,
            precision: "frame",
          },
          {
            timestamp: 120_000,
            participantId: 1,
            total: 220,
            physical: 90,
            magic: 100,
            trueDamage: 30,
            precision: "frame",
          },
          {
            timestamp: 120_000,
            participantId: 2,
            total: 900,
            physical: 0,
            magic: 900,
            trueDamage: 0,
            precision: "frame",
          },
        ],
        1,
        0,
        120_000,
      ),
    ).toEqual([
      expect.objectContaining({ delta: null }),
      expect.objectContaining({
        delta: { total: 120, physical: 50, magic: 50, trueDamage: 20 },
      }),
    ]);
  });
});
