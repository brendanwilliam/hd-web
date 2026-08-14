import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findReport: vi.fn(), reconcile: vi.fn() }));
vi.mock("@/shared/server/db", () => ({ db: { report: { findFirst: mocks.findReport } } }));
vi.mock("@/features/reports/server/reconcile", () => ({ reconcileReport: mocks.reconcile }));

import { hydrateInputOnlyReport } from "@/features/reports/server/hydrate-input-only-report";

describe("hydrateInputOnlyReport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reconciles an input-only report and returns its refreshed data", async () => {
    mocks.findReport.mockResolvedValueOnce({ id: "report-1", reconciliationState: "input_only" }).mockResolvedValueOnce({ id: "report-1", reconciliationState: "matched" });

    await expect(hydrateInputOnlyReport("account-1", "report-1")).resolves.toEqual({ id: "report-1", reconciliationState: "matched" });
    expect(mocks.reconcile).toHaveBeenCalledWith("report-1");
    expect(mocks.findReport).toHaveBeenCalledTimes(2);
    expect(mocks.findReport).toHaveBeenNthCalledWith(1, { where: { id: "report-1", accountId: "account-1" } });
  });

  it("leaves non-input-only reports untouched", async () => {
    mocks.findReport.mockResolvedValue({ id: "report-1", reconciliationState: "matched" });

    await expect(hydrateInputOnlyReport("account-1", "report-1")).resolves.toEqual({ id: "report-1", reconciliationState: "matched" });
    expect(mocks.reconcile).not.toHaveBeenCalled();
    expect(mocks.findReport).toHaveBeenCalledTimes(1);
  });

  it("retries a pending report only after its backoff window", async () => {
    mocks.findReport.mockResolvedValueOnce({ id: "report-1", reconciliationState: "pending", retryAt: new Date(Date.now() - 1) }).mockResolvedValueOnce({ id: "report-1", reconciliationState: "pending" });

    await hydrateInputOnlyReport("account-1", "report-1");

    expect(mocks.reconcile).toHaveBeenCalledWith("report-1");
  });
});
