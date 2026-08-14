import { describe, expect, it } from "vitest";
import { buildMatchHistory } from "@/features/reports/domain/match-history";

const at = (value: string) => new Date(value);

describe("buildMatchHistory", () => {
  it("attaches reconciled input to its imported Riot match", () => {
    const history = buildMatchHistory(
      [
        {
          id: "riot-1",
          matchId: "NA1_1",
          gameStartedAt: at("2026-08-13T10:00:00Z"),
          gameMode: "CLASSIC",
          durationMs: 1_800_000,
        },
      ],
      [
        {
          id: "report-1",
          matchId: "NA1_1",
          observedStartedAt: at("2026-08-13T10:00:00Z"),
          reconciliationState: "matched",
          gameMode: "CLASSIC",
          durationMs: 1_800_000,
        },
      ],
    );

    expect(history).toEqual([
      expect.objectContaining({
        kind: "riot",
        inputReport: expect.objectContaining({ id: "report-1" }),
      }),
    ]);
  });

  it("keeps input-only recaps in the shared chronological history", () => {
    const history = buildMatchHistory(
      [],
      [
        {
          id: "report-1",
          matchId: null,
          observedStartedAt: at("2026-08-13T10:00:00Z"),
          reconciliationState: "input_only",
          gameMode: "CLASSIC",
          durationMs: 1_800_000,
        },
      ],
    );

    expect(history).toEqual([
      expect.objectContaining({
        kind: "input",
        report: expect.objectContaining({ id: "report-1" }),
      }),
    ]);
  });
});
