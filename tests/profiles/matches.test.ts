import { describe, expect, it } from "vitest";
import { duration, matchSummary, readMatchSummary } from "@/features/profiles/domain/matches";

const match = { info: { gameCreation: 1_723_000_000_000, gameMode: "CLASSIC", mapId: 11, gameDuration: 1570, participants: [
  { riotIdGameName: "Test", riotIdTagline: "NA1", participantId: 1, teamId: 100, championName: "Ahri", teamPosition: "MIDDLE", win: true, kills: 8, deaths: 2, assists: 9, totalMinionsKilled: 180, neutralMinionsKilled: 4, goldEarned: 13_000, champLevel: 16 },
  { riotIdGameName: "Ally", riotIdTagline: "NA1", participantId: 2, teamId: 100, championName: "Garen", kills: 4 },
  { riotIdGameName: "Enemy", riotIdTagline: "NA1", participantId: 3, teamId: 200, championName: "Jinx", kills: 7 }
] } };

describe("Riot match summaries", () => {
  it("creates a player-focused compact match summary", () => {
    const summary = matchSummary(match, "NA1_123", "test#na1");
    expect(summary).toMatchObject({ gameId: "NA1_123", gameMode: "CLASSIC", map: "Summoner's Rift", durationSeconds: 1570, teamKills: 12, enemyTeamKills: 7, player: { champion: "Ahri", outcome: "Victory", kills: 8, cs: 184 }, allies: ["Ahri", "Garen"], enemies: ["Jinx"] });
  });
  it("rejects malformed cached summaries and formats durations", () => {
    expect(readMatchSummary({ gameId: "NA1_123" })).toBeNull();
    expect(duration(1570)).toBe("26:10");
  });
});
