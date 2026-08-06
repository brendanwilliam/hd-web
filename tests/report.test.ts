import { describe, expect, it } from "vitest";
import { normalizeRiotId, reportSchema, safeReport } from "../lib/report";
import { hydrateReportPayload } from "../lib/riot";

const report = { schema_version: 4 as const, id: "8fc3f0e3-665b-43cc-a816-cdb8e22be037", completed_at: "2026-08-05T12:00:00.000Z", player: "Player #NA1" };
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
});
