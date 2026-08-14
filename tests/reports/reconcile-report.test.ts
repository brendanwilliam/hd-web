import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findReport: vi.fn(), updateReport: vi.fn() }));
vi.mock("@/shared/server/db", () => ({
  db: { report: { findUnique: mocks.findReport, update: mocks.updateReport } },
}));

import { reconcileReport } from "@/features/reports/server/reconcile";

describe("reconcileReport", () => {
  beforeEach(() => {
    process.env.RIOT_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    mocks.findReport.mockResolvedValue({
      id: "report-1",
      reconciliationState: "pending",
      reconciliationAttempt: 0,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("retries Riot 400 responses with exponential backoff", async () => {
    await reconcileReport("report-1");

    expect(mocks.updateReport).toHaveBeenCalledWith({
      where: { id: "report-1" },
      data: expect.objectContaining({
        reconciliationState: "pending",
        reconciliationAttempt: { increment: 1 },
        reconciliationError: "riot_400",
        retryAt: expect.any(Date),
      }),
    });
  });
});
