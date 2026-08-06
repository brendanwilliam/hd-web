import { describe, expect, it } from "vitest";
import { normalizeRiotId, reportSchema, safeReport } from "../lib/report";

const report = { schema_version: 4 as const, id: "8fc3f0e3-665b-43cc-a816-cdb8e22be037", completed_at: "2026-08-05T12:00:00.000Z", player: "Player #NA1" };
describe("report validation", () => {
  it("accepts only schema version four", () => expect(reportSchema.safeParse(report).success).toBe(true));
  it("rejects unsupported schema versions", () => expect(reportSchema.safeParse({ ...report, schema_version: 3 }).success).toBe(false));
  it("normalizes Riot IDs and removes key-shaped fields", () => { expect(normalizeRiotId(" Player #NA1 ")).toBe("player #na1"); expect(safeReport({ ...report, samples: [], events: [], input_samples: [], hexbins: [], chapters: [], keys: ["A"] }).keys).toBeUndefined(); });
});
