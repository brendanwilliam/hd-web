import type { Prisma } from "@prisma/client";
import { db } from "@/shared/server/db";
import { matchSummary } from "@/features/profiles/domain/matches";

const regions = ["americas", "europe", "asia", "sea"] as const;
const refreshCooldown = 60_000;
type RiotRegion = (typeof regions)[number];
type Data = Record<string, unknown>;
const data = (value: unknown): Data => typeof value === "object" && value !== null ? value as Data : {};
const text = (value: unknown) => typeof value === "string" ? value : "";

async function riotFetch(url: string) {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new Error("Riot history is not configured.");
  const response = await fetch(url, { headers: { "X-Riot-Token": key }, cache: "no-store" });
  if (!response.ok) throw new Error(`Riot API request failed (HTTP ${response.status}).`);
  return response.json() as Promise<unknown>;
}

async function resolveAccount(riotId: string): Promise<{ puuid: string; region: RiotRegion }> {
  const index = riotId.lastIndexOf("#");
  if (index <= 0 || index === riotId.length - 1) throw new Error("This profile has an invalid Riot ID.");
  const gameName = riotId.slice(0, index), tagLine = riotId.slice(index + 1);
  for (const region of regions) {
    const response = await fetch(`https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`, { headers: { "X-Riot-Token": process.env.RIOT_API_KEY ?? "" }, cache: "no-store" });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`Riot API request failed (HTTP ${response.status}).`);
    const puuid = text(data(await response.json()).puuid);
    if (puuid) return { puuid, region };
  }
  throw new Error("Riot could not find this player.");
}

export type HistoryRefreshResult = { status: "updated" | "cooldown" | "error"; message: string };

export async function refreshProfileHistory(profileId: string): Promise<HistoryRefreshResult> {
  const profile = await db.profile.findUnique({ where: { id: profileId } });
  if (!profile) return { status: "error", message: "Player profile not found." };
  if (profile.riotHistoryFetchedAt && Date.now() - profile.riotHistoryFetchedAt.getTime() < refreshCooldown) return { status: "cooldown", message: "Match history was refreshed less than a minute ago." };
  try {
    const account = profile.riotPuuid && profile.riotRegion ? { puuid: profile.riotPuuid, region: profile.riotRegion as RiotRegion } : await resolveAccount(profile.riotId);
    const ids = await riotFetch(`https://${account.region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(account.puuid)}/ids?count=20`);
    if (!Array.isArray(ids)) throw new Error("Riot returned an invalid match history.");
    const summaries = [] as ReturnType<typeof matchSummary>[];
    for (const gameId of ids.filter((id): id is string => typeof id === "string")) summaries.push(matchSummary(await riotFetch(`https://${account.region}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(gameId)}`), gameId, profile.riotId));
    await db.$transaction(async tx => {
      await tx.riotMatchSnapshot.deleteMany({ where: { profileId, gameId: { notIn: summaries.map(summary => summary.gameId) } } });
      for (const summary of summaries) await tx.riotMatchSnapshot.upsert({ where: { profileId_gameId: { profileId, gameId: summary.gameId } }, create: { profileId, gameId: summary.gameId, playedAt: new Date(summary.playedAt), payload: summary as Prisma.InputJsonValue }, update: { playedAt: new Date(summary.playedAt), payload: summary as Prisma.InputJsonValue } });
      await tx.profile.update({ where: { id: profileId }, data: { riotPuuid: account.puuid, riotRegion: account.region, riotHistoryFetchedAt: new Date() } });
    });
    return { status: "updated", message: "Match history is up to date." };
  } catch (error) { return { status: "error", message: error instanceof Error ? error.message : "Unable to refresh match history." }; }
}
