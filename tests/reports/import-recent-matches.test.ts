import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ upsert: vi.fn(), hydrateTimeline: vi.fn() }));
vi.mock("@/shared/server/db", () => ({ db: { riotMatch: { upsert: mocks.upsert } } }));
vi.mock("@/features/reports/server/hydrate-riot-match-timeline", () => ({
  hydrateRiotMatchTimeline: mocks.hydrateTimeline,
}));

import { importRecentMatches } from "@/features/reports/server/import-recent-matches";

const response = (value: unknown) => ({ ok: true, status: 200, json: async () => value });
const match = (id: number) => ({
  info: {
    gameId: id,
    gameStartTimestamp: 1_700_000_000_000 + id,
    gameDuration: 1_800,
    gameMode: "CLASSIC",
    participants: [
      {
        puuid: "fixture-puuid",
        championName: "Ahri",
        win: true,
        kills: 4,
        deaths: 2,
        assists: 9,
        totalMinionsKilled: 100,
        neutralMinionsKilled: 4,
      },
    ],
    teams: [{ teamId: 100, win: true }],
  },
});

describe("importRecentMatches", () => {
  beforeEach(() => {
    process.env.RIOT_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response({ puuid: "fixture-puuid" }))
        .mockResolvedValueOnce(response(["MATCH-1", "MATCH-2"]))
        .mockResolvedValueOnce(response(match(1)))
        .mockResolvedValueOnce(response(match(2))),
    );
    mocks.upsert
      .mockResolvedValueOnce({ id: "riot-match-1" })
      .mockResolvedValueOnce({ id: "riot-match-2" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("stores recent Riot matches without requiring input reports", async () => {
    await expect(
      importRecentMatches("account-1", "Fixture Player", "TEST"),
    ).resolves.toBe(2);

    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId_matchId: { accountId: "account-1", matchId: "MATCH-1" } },
      }),
    );
    expect(mocks.upsert.mock.calls[0][0].create).toMatchObject({
      accountId: "account-1",
      riotIdGameName: "Fixture Player",
      riotIdTagLine: "TEST",
      riotRegion: "americas",
      gameMode: "CLASSIC",
      durationMs: 1_800_000,
      matchSummary: {
        player: { championName: "Ahri", kills: 4 },
        teams: [{ teamId: 100, win: true }],
      },
    });
    expect(mocks.hydrateTimeline).toHaveBeenNthCalledWith(1, "account-1", "riot-match-1");
  });
});
