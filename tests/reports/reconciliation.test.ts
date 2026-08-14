import { describe, expect, it } from "vitest";
import {
  normalizedMatchSummary,
  normalizedTimelineEvents,
  plausibleMatch,
  retryDelayMs,
} from "@/features/reports/domain/reconciliation";

describe("v2 reconciliation normalization", () => {
  it("keeps only recap-safe match and timeline fields", () => {
    const summary = normalizedMatchSummary(
      {
        championName: "Ahri",
        win: true,
        kills: 4,
        deaths: 2,
        assists: 9,
        totalMinionsKilled: 100,
        neutralMinionsKilled: 4,
        puuid: "raw",
      },
      [{ teamId: 100, win: true, bans: [{ championId: 1 }] }],
    );
    expect(summary).toMatchObject({
      player: {
        championName: "Ahri",
        win: true,
        kills: 4,
        deaths: 2,
        assists: 9,
        totalMinionsKilled: 100,
        neutralMinionsKilled: 4,
      },
      teams: [{ teamId: 100, win: true }],
    });
    expect(JSON.stringify(summary)).not.toContain("raw");
    const events = normalizedTimelineEvents({
      info: {
        frames: [
          {
            events: [
              {
                timestamp: 1000,
                type: "CHAMPION_KILL",
                killerId: 1,
                victimId: 2,
                raw: "discard",
              },
            ],
          },
        ],
      },
    });
    expect(events).toEqual([
      {
        timestamp: 1000,
        type: "CHAMPION_KILL",
        participantId: null,
        killerId: 1,
        victimId: 2,
        assistingParticipantIds: [],
        itemId: null,
        wardType: null,
        buildingType: null,
        teamId: null,
      },
    ]);
  });

  it("requires v2 match identity constraints and backs off transient retries", () => {
    const match = {
      info: {
        mapId: 11,
        queueId: 420,
        gameMode: "CLASSIC",
        gameStartTimestamp: 1_000,
        participants: [{ puuid: "fixture-puuid" }],
      },
    };
    expect(plausibleMatch(match, "fixture-puuid", new Date(1_000))?.participant).toEqual({
      puuid: "fixture-puuid",
    });
    expect(
      plausibleMatch(
        { ...match, info: { ...match.info, queueId: 999 } },
        "fixture-puuid",
        new Date(1_000),
      ),
    ).toBeNull();
    expect(retryDelayMs(0)).toBe(60_000);
    expect(retryDelayMs(8)).toBe(3_600_000);
  });

  it("retains final all-player economy and objective totals without identities", () => {
    const summary = normalizedMatchSummary(
      { participantId: 1, teamId: 100, championName: "Ahri" },
      [],
      [
        {
          participantId: 1,
          teamId: 100,
          championName: "Ahri",
          goldEarned: 12_000,
          goldSpent: 11_000,
          damageDealtToBuildings: 300,
          damageDealtToObjectives: 500,
          puuid: "never-retained",
        },
      ],
    );
    expect(summary.players[0]).toMatchObject({
      currentGold: 1_000,
      totalGold: 12_000,
      damageDealtToBuildings: 300,
      damageDealtToObjectives: 500,
    });
    expect(JSON.stringify(summary)).not.toContain("never-retained");
  });
});
