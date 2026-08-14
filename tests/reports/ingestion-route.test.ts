import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findToken: vi.fn(),
  findReport: vi.fn(),
  createReport: vi.fn(),
  updateToken: vi.fn(),
  reconcile: vi.fn(),
}));

vi.mock("@/shared/server/db", () => ({
  db: {
    apiToken: { findFirst: mocks.findToken, update: mocks.updateToken },
    report: { findUnique: mocks.findReport, create: mocks.createReport },
  },
}));
vi.mock("@/features/reports/server/reconcile", () => ({
  reconcileReport: mocks.reconcile,
}));

import { POST } from "@/app/api/reports/route";
import { canonicalPayload } from "@/features/reports/domain/payload";

function report() {
  const value = {
    schema_version: 2 as const,
    report_id: "a0f59d84-9d21-4d07-b903-2ec435ee0c1e",
    capture_policy_version: 1 as const,
    payload_hash: "",
    capture: {
      started_at_utc: "2026-08-10T19:30:00.000Z",
      duration_ms: 120_000,
      game_mode: "CLASSIC" as const,
      map_number: 11 as const,
      riot_id: { game_name: "FixturePlayer", tag_line: "TEST" },
      frontmost_capture: true as const,
      complete: true,
      event_detail_truncated: false,
    },
    input: {
      left_clicks: 2,
      right_clicks: 3,
      gameplay_key_actions: 4,
      intensity_by_second: [{ second: 1, apm: 20, mouse_velocity: 0.2 }],
      summary: {
        peak_apm: 20,
        median_apm: 20,
        peak_mouse_velocity: 0.2,
        median_mouse_velocity: 0.2,
      },
    },
    live_context: { changes: [] },
  };
  value.payload_hash = createHash("sha256")
    .update(canonicalPayload(value as never))
    .digest("hex");
  return value;
}

function request(body: unknown, token = "fixture-token") {
  return new Request("http://test/api/reports", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findToken.mockResolvedValue({ id: "token", accountId: "owner" });
  mocks.findReport.mockResolvedValue(null);
  mocks.createReport.mockResolvedValue({});
  mocks.updateToken.mockResolvedValue({});
});

describe("v2 report ingestion", () => {
  it("requires a valid device bearer token", async () => {
    expect(
      (await POST(new Request("http://test/api/reports", { method: "POST" }))).status,
    ).toBe(401);
    mocks.findToken.mockResolvedValue(null);
    expect((await POST(request(report()))).status).toBe(401);
  });

  it("rejects a non-canonical payload hash before persistence", async () => {
    const value = report();
    value.payload_hash = "0".repeat(64);
    expect((await POST(request(value))).status).toBe(400);
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it("creates an owner-scoped report and invokes reconciliation", async () => {
    const response = await POST(request(report()));
    expect(response.status).toBe(200);
    expect(mocks.createReport.mock.calls[0][0].data.accountId).toBe("owner");
    expect(mocks.reconcile).toHaveBeenCalledWith(report().report_id);
  });

  it("returns duplicate only for the same account payload", async () => {
    const value = report();
    mocks.findReport.mockResolvedValue({
      id: value.report_id,
      payloadHash: value.payload_hash,
    });
    expect((await POST(request(value))).status).toBe(200);
    mocks.findReport.mockResolvedValue({
      id: value.report_id,
      payloadHash: "f".repeat(64),
    });
    expect((await POST(request(value))).status).toBe(409);
  });

  it("persists only ordered normalized v3 playback records", async () => {
    const fixture = JSON.parse(
      readFileSync(
        join(process.cwd(), "tests/fixtures/hands-diff/v3-playback.json"),
        "utf8",
      ),
    );
    expect((await POST(request(fixture))).status).toBe(200);
    const data = mocks.createReport.mock.calls[0][0].data;
    expect(data.playbackPrecisionMs).toBe(2_000);
    expect(data.playbackRecords.createMany.data).toEqual([
      expect.objectContaining({ ordinal: 0, gameTimeMs: 1_000, normalizedX: 0.25 }),
      expect.objectContaining({ ordinal: 1, gameTimeMs: 1_100, kind: "left_click" }),
      expect.objectContaining({ ordinal: 2, gameTimeMs: 1_200, kind: "right_click" }),
      expect.objectContaining({ ordinal: 3, gameTimeMs: 1_300, actionLabel: "spell_1" }),
    ]);
    expect(JSON.stringify(data.playbackRecords)).not.toContain("payload_hash");
  });
});
