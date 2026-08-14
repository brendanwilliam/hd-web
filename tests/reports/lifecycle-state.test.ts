import { describe, expect, it } from "vitest";
import {
  aliveAdvantage,
  deathIntervals,
} from "@/features/reports/domain/lifecycle-state";
import {
  dragonState,
  objectiveLifetimes,
} from "@/features/reports/domain/lifecycle-state";

describe("lifecycle state", () => {
  it("derives rule-predicted death intervals and alive advantage", () => {
    const players = [
      { participantId: 1, teamId: 100, level: 1 },
      { participantId: 2, teamId: 200, level: 1 },
    ];
    const intervals = deathIntervals("14.16.1", players, [
      { timestamp: 10_000, victimId: 2 },
    ]);
    expect(intervals[0].predictedRespawnAtMs).toBe(20_000);
    expect(aliveAdvantage(intervals, players, 15_000)).toMatchObject({ advantage: 1 });
    expect(aliveAdvantage(intervals, players, 20_000)).toMatchObject({ advantage: 0 });
  });

  it("models observed dragon stacks and rule-timed objective respawns", () => {
    const kills = [
      {
        timestamp: 300_000,
        kind: "elemental_dragon" as const,
        subtype: "cloud" as const,
        killerTeamId: 100,
      },
      {
        timestamp: 600_000,
        kind: "elemental_dragon" as const,
        subtype: "cloud" as const,
        killerTeamId: 100,
      },
      {
        timestamp: 900_000,
        kind: "elemental_dragon" as const,
        subtype: "cloud" as const,
        killerTeamId: 100,
      },
      {
        timestamp: 1_200_000,
        kind: "elemental_dragon" as const,
        subtype: "cloud" as const,
        killerTeamId: 100,
      },
    ];
    expect(objectiveLifetimes("14.16.1", kills)[0].respawnAtMs).toBe(600_000);
    expect(dragonState(kills, 1_200_000)).toContainEqual(
      expect.objectContaining({ teamId: 100, hasSoul: true }),
    );
  });
});
