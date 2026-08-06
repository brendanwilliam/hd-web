import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeRiotId, reportSchema, safeReport } from "../lib/report";
import { hydrateReportPayload, reconcileReportPayload } from "../lib/riot";
import { collisionSlug, profileSlug, reportPath } from "../lib/profile";

const report = { schema_version: 4 as const, id: "8fc3f0e3-665b-43cc-a816-cdb8e22be037", completed_at: "2026-08-05T12:00:00.000Z", player: "Player #NA1" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
afterEach(() => vi.unstubAllGlobals());
describe("report validation", () => {
  it("accepts schema versions four and five", () => { expect(reportSchema.safeParse(report).success).toBe(true); expect(reportSchema.safeParse({ ...report, schema_version: 5 }).success).toBe(true); });
  it("accepts legacy reports without a completion timestamp", () => expect(reportSchema.safeParse({ ...report, completed_at: "" }).success).toBe(true));
  it("accepts full-length input telemetry", () => expect(reportSchema.safeParse({ ...report, input_samples: Array.from({ length: 3_600 }, (_, seconds) => ({ seconds, actions: 0 })) }).success).toBe(true));
  it("hydrates a local report with Riot timeline data", () => {
    const hydrated = hydrateReportPayload({ ...report, samples: [{ seconds: 0, gold: 500 }] }, { player: "Player #NA1", champion: "Ahri", role: "MIDDLE", outcome: "Victory", gameId: "NA1_1", gameMode: "CLASSIC", map: "Summoner's Rift", completedAt: report.completed_at, durationSeconds: 1200, teamGold: 100, enemyTeamGold: 90, teamKills: 5, enemyTeamKills: 4, final: { kills: 1, deaths: 2, assists: 3, cs: 40, gold: 9000, level: 12 }, samples: [{ seconds: 0, estimatedGold: 500 }], events: [], abilities: [], items: [], participants: [] });
    expect(hydrated.enrichment).toMatchObject({ riot_match_v5: true });
    expect(hydrated.samples).toEqual([{ seconds: 0, estimatedGold: 500, estimated_gold: 500 }]);
  });
  it("rejects unsupported schema versions", () => expect(reportSchema.safeParse({ ...report, schema_version: 3 }).success).toBe(false));
  it("normalizes Riot IDs and removes key-shaped fields", () => { expect(normalizeRiotId(" Player #NA1 ")).toBe("player #na1"); expect(safeReport({ ...report, samples: [], events: [], input_samples: [], hexbins: [], chapters: [], keys: ["A"] }).keys).toBeUndefined(); });
  it("uses readable, stable profile paths", () => {
    expect(profileSlug("Squidbird#in4K")).toBe("squidbird-in4k");
    expect(collisionSlug("Squidbird#in4K")).toMatch(/^squidbird-in4k-[a-f0-9]{8}$/);
    expect(reportPath("squidbird-in4k", report.id)).toBe(`/squidbird-in4k/reports/${report.id}`);
  });
  it("hydrates a uniquely identified report from match history", async () => {
    process.env.RIOT_API_KEY = "test";
    const match = { info: { gameMode: "CLASSIC", gameDuration: 1200, gameEndTimestamp: new Date(report.completed_at).getTime(), gameCreation: new Date(report.completed_at).getTime() - 1200000, mapId: 11, participants: [{ participantId: 1, teamId: 100, riotIdGameName: "Player ", riotIdTagline: "NA1", championName: "Ahri", teamPosition: "MIDDLE", win: true, kills: 1, deaths: 2, assists: 3, totalMinionsKilled: 40, neutralMinionsKilled: 0, goldEarned: 9000, champLevel: 12 }] } };
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("accounts/by-riot-id")) return Promise.resolve(json({ puuid: "puuid" }));
      if (url.includes("/ids?")) return Promise.resolve(json(["NA1_1"]));
      if (url.endsWith("/timeline")) return Promise.resolve(json({ info: { frames: [] } }));
      return Promise.resolve(json(match));
    }));
    const result = await reconcileReportPayload({ ...report, duration_seconds: 1200, game_mode: "CLASSIC", samples: [] }, new Date(report.completed_at), report.player);
    expect(result.status).toBe("matched");
    expect(result.payload).toMatchObject({ champion: "Ahri", game_id: "NA1_1", enrichment: { riot_match_v5: true } });
  });
  it("does not attach a nearby match with incompatible duration", async () => {
    process.env.RIOT_API_KEY = "test";
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("accounts/by-riot-id")) return Promise.resolve(json({ puuid: "puuid" }));
      if (url.includes("/ids?")) return Promise.resolve(json(["NA1_1"]));
      return Promise.resolve(json({ info: { gameMode: "CLASSIC", gameDuration: 1000, gameEndTimestamp: new Date(report.completed_at).getTime(), participants: [{ riotIdGameName: "Player ", riotIdTagline: "NA1" }] } }));
    }));
    const result = await reconcileReportPayload({ ...report, duration_seconds: 1200, game_mode: "CLASSIC" }, new Date(report.completed_at), report.player);
    expect(result.status).toBe("not_found");
  });
});
