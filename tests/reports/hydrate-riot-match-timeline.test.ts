import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMatch: vi.fn(), updateMatch: vi.fn() }));
vi.mock("@/shared/server/db", () => ({ db: { riotMatch: { findFirst: mocks.findMatch, update: mocks.updateMatch } } }));

import { hydrateRiotMatchTimeline } from "@/features/reports/server/hydrate-riot-match-timeline";

const response = (value: unknown) => ({ ok: true, status: 200, json: async () => value });

describe("hydrateRiotMatchTimeline", () => {
  beforeEach(() => {
    process.env.RIOT_API_KEY = "test-key";
    mocks.findMatch.mockResolvedValue({ id: "riot-match-1", accountId: "account-1", matchId: "NA1_1", riotRegion: "americas", timelineState: "pending" });
    mocks.updateMatch.mockResolvedValue({ id: "riot-match-1", timelineState: "ready" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("retries a pending timeline on refresh and persists normalized events", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ info: { frames: [{ events: [{ timestamp: 1_000, type: "CHAMPION_KILL", killerId: 1, victimId: 2 }] }] } })));

    await expect(hydrateRiotMatchTimeline("account-1", "riot-match-1")).resolves.toMatchObject({ timelineState: "ready" });
    const update = mocks.updateMatch.mock.calls[0][0];
    expect(update).toMatchObject({ where: { id: "riot-match-1" }, data: { timelineState: "ready", timelineError: null } });
    expect(update.data.riotEvents).toEqual([expect.objectContaining({ timestamp: 1_000, type: "CHAMPION_KILL", killerId: 1, victimId: 2 })]);
  });

  it("keeps the match available for a later refresh when the timeline fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));

    await hydrateRiotMatchTimeline("account-1", "riot-match-1");

    expect(mocks.updateMatch).toHaveBeenCalledWith({ where: { id: "riot-match-1" }, data: { timelineState: "pending", timelineError: "riot_429" } });
  });
});
