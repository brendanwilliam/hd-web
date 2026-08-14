import { normalizedMatchSummary } from "@/features/reports/domain/reconciliation";
import { hydrateRiotMatchTimeline } from "@/features/reports/server/hydrate-riot-match-timeline";
import { db } from "@/shared/server/db";
import type { Prisma } from "@prisma/client";

const regions = ["americas", "europe", "asia", "sea"] as const;
type Region = (typeof regions)[number];
type Data = Record<string, unknown>;
const data = (value: unknown): Data => typeof value === "object" && value !== null ? value as Data : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => typeof value === "number" ? value : 0;
const list = (value: unknown) => Array.isArray(value) ? value : [];
let nextRiotRequestAt = 0;

class RiotRequestError extends Error {
  constructor(status: number) { super(`riot_${status}`); }
}

async function riot(url: string) {
  await paceRiotRequests();
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new Error("riot_not_configured");
  const response = await fetch(url, { headers: { "X-Riot-Token": key }, cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new RiotRequestError(response.status);
  return response.json() as Promise<unknown>;
}

async function paceRiotRequests() {
  const now = Date.now();
  const wait = Math.max(0, nextRiotRequestAt - now);
  nextRiotRequestAt = Math.max(nextRiotRequestAt, now) + 75;
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
}

export async function importRecentMatches(accountId: string, gameName: string, tagLine: string) {
  let account: Data | null = null;
  let region: Region | null = null;
  for (const candidate of regions) {
    account = data(await riot(`https://${candidate}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`));
    if (text(account.puuid)) { region = candidate; break; }
  }
  if (!account || !region || !text(account.puuid)) throw new Error("riot_id_not_found");

  const puuid = text(account.puuid);
  const ids = await riot(`https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?count=20`);
  if (!Array.isArray(ids)) throw new Error("riot_matches_unavailable");

  let imported = 0;
  for (const matchId of ids.filter((value): value is string => typeof value === "string")) {
    const match = data(await riot(`https://${region}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`));
    const info = data(match.info);
    const participant = list(info.participants).map(data).find(value => text(value.puuid) === puuid);
    if (!participant || number(info.gameStartTimestamp) <= 0) continue;
    const stored = await db.riotMatch.upsert({
      where: { accountId_matchId: { accountId, matchId } },
      create: matchData(accountId, matchId, gameName, tagLine, region, info, participant),
      update: matchData(accountId, matchId, gameName, tagLine, region, info, participant),
    });
    await hydrateRiotMatchTimeline(accountId, stored.id);
    imported += 1;
  }
  return imported;
}

function matchData(accountId: string, matchId: string, gameName: string, tagLine: string, region: Region, info: Data, participant: Data) {
  return {
    accountId, matchId, riotGameId: number(info.gameId) ? String(number(info.gameId)) : null,
    riotIdGameName: gameName, riotIdTagLine: tagLine, riotRegion: region,
    gameStartedAt: new Date(number(info.gameStartTimestamp)), gameMode: text(info.gameMode) || "UNKNOWN",
    durationMs: Math.round(number(info.gameDuration) * 1_000),
    matchSummary: normalizedMatchSummary(participant, info.teams) as Prisma.InputJsonValue,
  };
}
