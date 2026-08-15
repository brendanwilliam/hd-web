import { describe, expect, it } from "vitest";
import fixture from "@/tests/fixtures/riot/contracts.json";
import {
  normalizedMatchSummary,
  normalizedReportTimeline,
  normalizedTimelineEvents,
  plausibleMatch,
} from "@/features/reports/domain/reconciliation";

describe("Riot Match-v5 and Timeline-v5 contracts", () => {
  it("retains the allowlisted complete match and timeline fields", () => {
    const match = fixture.match.complete;
    const timeline = fixture.timeline.complete;
    const report = normalizedReportTimeline(match, timeline, 1);
    const summary = normalizedMatchSummary(match.info.participants[0], match.info.teams);

    expect(report).toMatchObject({
      gameVersion: "14.12.1",
      roster: [{ participantId: 1, teamId: 100, championName: "Cho'Gath" }],
      snapshots: [{ timestamp: 60_000, totalGold: 1_000, totalXp: 1_200 }],
      championDamage: [{ total: 300, physical: 100, magic: 150, trueDamage: 50 }],
    });
    expect(summary.player).toMatchObject({ totalGold: 12_000, currentGold: 1_000 });
    expect(JSON.stringify({ report, summary })).not.toContain("never-persisted");
  });

  it("keeps sparse, delayed, malformed, and version-variant responses explicit", () => {
    expect(
      normalizedReportTimeline(fixture.match.sparse, fixture.timeline.sparse, 1),
    ).toMatchObject({ roster: [], snapshots: [], events: [] });
    expect(normalizedTimelineEvents(fixture.timeline.malformed)).toEqual([]);
    expect(
      normalizedReportTimeline(fixture.match.complete, fixture.timeline.delayed, 1),
    ).toMatchObject({ snapshots: [] });
    expect(
      plausibleMatch(fixture.match.malformed, "never-persisted", new Date()),
    ).toBeNull();
    expect(fixture.match.versionVariant.info.gameVersion).toBe("14.12");
  });
});
