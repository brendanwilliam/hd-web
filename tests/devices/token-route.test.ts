import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findGrant: vi.fn(), createToken: vi.fn(), updateGrant: vi.fn(), transaction: vi.fn() }));
vi.mock("@/shared/server/db", () => ({ db: {
  deviceGrant: { findUnique: mocks.findGrant, update: mocks.updateGrant },
  apiToken: { create: mocks.createToken }, $transaction: mocks.transaction,
} }));

import { POST } from "@/app/api/device/token/route";

const request = (device_code: unknown) => new Request("http://test/api/device/token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ device_code }) });
const approved = { id: "grant", accountId: "owner", approvedAt: new Date(), consumedAt: null, expiresAt: new Date(Date.now() + 60_000) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findGrant.mockResolvedValue(approved);
  mocks.createToken.mockReturnValue({});
  mocks.updateGrant.mockReturnValue({});
  mocks.transaction.mockResolvedValue([]);
});

describe("device token exchange", () => {
  it("only issues one token for an approved, unexpired grant", async () => {
    const response = await POST(request("device-code"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.access_token).toEqual(expect.any(String));
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.createToken.mock.calls[0][0].data.accountId).toBe("owner");
    expect(mocks.createToken.mock.calls[0][0].data.tokenHash).not.toBe(body.access_token);
  });

  it.each([
    [null, 410], [{ ...approved, approvedAt: null }, 428], [{ ...approved, consumedAt: new Date() }, 409], [{ ...approved, expiresAt: new Date(0) }, 410],
  ])("rejects an invalid grant state", async (grant, status) => {
    mocks.findGrant.mockResolvedValue(grant);
    expect((await POST(request("device-code"))).status).toBe(status);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
