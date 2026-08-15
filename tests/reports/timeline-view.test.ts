import { describe, expect, it } from "vitest";
import { normalizedReportTimeline } from "@/features/reports/domain/reconciliation";
import { createReportTimelineView } from "@/features/reports/domain/timeline-view";
import { championAssetUrls } from "@/features/reports/domain/data-dragon";

const match = {
  info: {
    gameVersion: "14.12.1",
    participants: [
      { participantId: 1, teamId: 100, championName: "Ahri", puuid: "private" },
      { participantId: 2, teamId: 200, championName: "Garen" },
    ],
  },
};
const riotTimeline = {
  info: {
    frames: [
      {
        timestamp: 0,
        participantFrames: {
          "1": { totalGold: 500, minionsKilled: 0, jungleMinionsKilled: 0 },
        },
        events: [],
      },
      {
        timestamp: 31_000,
        participantFrames: {
          "1": { totalGold: 800, minionsKilled: 5, jungleMinionsKilled: 1 },
        },
        events: [
          {
            timestamp: 30_000,
            type: "CHAMPION_KILL",
            killerId: 1,
            victimId: 2,
            assistingParticipantIds: [],
          },
          {
            timestamp: 31_000,
            type: "BUILDING_KILL",
            buildingType: "TOWER_BUILDING",
            teamId: 200,
            killerId: 1,
          },
          {
            timestamp: 31_500,
            type: "CHAMPION_KILL",
            killerId: 2,
            victimId: 1,
            assistingParticipantIds: [],
          },
          { timestamp: 32_000, type: "ELITE_MONSTER_KILL", killerId: 2 },
          {
            timestamp: 32_500,
            type: "BUILDING_KILL",
            buildingType: "INHIBITOR_BUILDING",
            teamId: 100,
          },
        ],
      },
    ],
  },
};

describe("report timeline normalization", () => {
  it("keeps a private roster and classifies events by side", () => {
    const result = normalizedReportTimeline(match, riotTimeline, 1);
    expect(result.gameVersion).toBe("14.12.1");
    expect(result.roster).toEqual([
      {
        participantId: 1,
        teamId: 100,
        championName: "Ahri",
        role: null,
        isLinkedPlayer: true,
      },
      {
        participantId: 2,
        teamId: 200,
        championName: "Garen",
        role: null,
        isLinkedPlayer: false,
      },
    ]);
    expect(result.events).toEqual([
      { timestamp: 30_000, kind: "takedown", side: "ally", championName: "Ahri" },
      { timestamp: 31_000, kind: "tower", side: "ally", championName: "Ahri" },
      { timestamp: 31_500, kind: "death", side: "enemy", championName: "Ahri" },
      { timestamp: 32_000, kind: "monster", side: "enemy", championName: "Garen" },
      { timestamp: 32_500, kind: "inhibitor", side: "enemy", championName: null },
    ]);
    expect(result.snapshots).toHaveLength(2);
    expect(result.snapshots[1]).toMatchObject({
      currentGold: 0,
      level: 0,
      totalXp: 0,
      precision: "frame",
    });
  });

  it("uses 30-second action bins and velocity summaries", () => {
    const view = createReportTimelineView({
      durationMs: 61_000,
      riotEvents: normalizedReportTimeline(match, riotTimeline, 1),
      payload: {
        input: {
          intensity_by_second: [
            { second: 30, mouse_velocity: 2 },
            { second: 31, mouse_velocity: 4 },
          ],
        },
      },
      inputEvents: [
        { second: 30, kind: "left_click" },
        { second: 31, kind: "right_click" },
        { second: 31, kind: "gameplay_key" },
      ],
    });
    const bin = view.bins.find((item) => item.timestamp === 30_000);
    expect(bin).toMatchObject({
      csPerMinute: (6 * 60_000) / 31_000,
      goldPerMinute: (300 * 60_000) / 31_000,
      leftClicks: 2,
      rightClicks: 2,
      gameplayKeys: 2,
      meanVelocity: 3,
      peakVelocity: 4,
    });
  });

  it("leaves detailed actions unavailable when no detailed input was captured", () => {
    const view = createReportTimelineView({
      durationMs: 30_000,
      riotEvents: normalizedReportTimeline(match, riotTimeline, 1),
      payload: { input: { intensity_by_second: [] } },
      inputEvents: [],
    });
    expect(view.inputAvailable).toBe(false);
    expect(view.bins[0].leftClicks).toBeNull();
  });

  it("uses the match patch first and latest Data Dragon only as a fallback", () => {
    expect(championAssetUrls("14.12.1", "Cho'Gath")).toEqual({
      primary:
        "https://ddragon.leagueoflegends.com/cdn/14.12.1/img/champion/Cho'Gath.png",
      fallback:
        "https://ddragon.leagueoflegends.com/cdn/latest/img/champion/Cho'Gath.png",
    });
  });
});
