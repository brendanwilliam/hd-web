import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findReport: vi.fn() }));
vi.mock("@/shared/server/db", () => ({
  db: { report: { findFirst: mocks.findReport } },
}));

import { playbackForReport } from "@/features/reports/server/playback";

describe("playbackForReport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scopes playback to the account and selects only normalized fields", async () => {
    mocks.findReport.mockResolvedValue({
      playbackPrecisionMs: null,
      playbackTruncated: null,
      playbackOmittedCount: null,
      playbackRecords: [],
    });
    await expect(playbackForReport("account-1", "report-1")).resolves.toEqual({
      available: false,
      truncated: false,
      omittedRecordCount: 0,
      timestampPrecisionMs: null,
      records: [],
    });
    expect(mocks.findReport).toHaveBeenCalledWith({
      where: { id: "report-1", accountId: "account-1" },
      select: {
        playbackTruncated: true,
        playbackOmittedCount: true,
        playbackPrecisionMs: true,
        playbackRecords: {
          select: {
            ordinal: true,
            gameTimeMs: true,
            kind: true,
            normalizedX: true,
            normalizedY: true,
            actionLabel: true,
          },
          orderBy: { gameTimeMs: "asc" },
        },
      },
    });
  });
});
