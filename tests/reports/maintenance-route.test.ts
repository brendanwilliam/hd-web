import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), reconcile: vi.fn(), deleteGrants: vi.fn(), deleteTokens: vi.fn(), findReports: vi.fn() }));
vi.mock("@/shared/server/db", () => ({ db: {
  $transaction: mocks.transaction,
  deviceGrant: { deleteMany: mocks.deleteGrants }, apiToken: { deleteMany: mocks.deleteTokens }, report: { findMany: mocks.findReports },
} }));
vi.mock("@/features/reports/server/reconcile", () => ({ reconcileReport: mocks.reconcile }));

import { POST } from "@/app/api/maintenance/cleanup/route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "fixture-secret";
  mocks.deleteGrants.mockReturnValue({});
  mocks.deleteTokens.mockReturnValue({});
  mocks.findReports.mockReturnValue({});
  mocks.transaction.mockResolvedValue([{ count: 2 }, { count: 3 }, [{ id: "pending" }, { id: "input-only" }]]);
});
afterEach(() => { delete process.env.CRON_SECRET; });

describe("reconciliation maintenance", () => {
  it("requires the cron secret", async () => {
    expect((await POST(new Request("http://test/api/maintenance/cleanup", { method: "POST" }))).status).toBe(401);
  });

  it("retries only retryable reconciliation states", async () => {
    const response = await POST(new Request("http://test/api/maintenance/cleanup", { method: "POST", headers: { authorization: "Bearer fixture-secret" } }));
    expect(response.status).toBe(200);
    expect(mocks.reconcile).toHaveBeenCalledWith("pending");
    expect(mocks.reconcile).toHaveBeenCalledWith("input-only");
    const reportQuery = mocks.findReports.mock.calls[0][0];
    expect(reportQuery.where.reconciliationState.in).toEqual(["pending", "input_only"]);
    expect(await response.json()).toMatchObject({ expired_grants: 2, expired_tokens: 3, reconciled_reports: 2 });
  });
});
