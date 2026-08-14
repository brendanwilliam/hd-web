import { normalizedTimelineEvents } from "@/features/reports/domain/reconciliation";
import { db } from "@/shared/server/db";
import { Prisma } from "@prisma/client";

let nextRiotRequestAt = 0;

export async function hydrateRiotMatchTimeline(accountId: string, riotMatchId: string) {
  const match = await db.riotMatch.findFirst({ where: { id: riotMatchId, accountId } });
  if (!match || match.timelineState === "ready") return match;
  try {
    const timeline = await requestTimeline(match.riotRegion, match.matchId);
    return db.riotMatch.update({ where: { id: match.id }, data: timeline === null ? { timelineState: "unavailable", timelineError: "riot_timeline_not_found", riotEvents: Prisma.JsonNull } : { timelineState: "ready", timelineError: null, riotEvents: normalizedTimelineEvents(timeline) as Prisma.InputJsonValue } });
  } catch (error) {
    return db.riotMatch.update({ where: { id: match.id }, data: { timelineState: "pending", timelineError: error instanceof Error ? error.message : "riot_timeline_fetch_failed" } });
  }
}

async function requestTimeline(region: string, matchId: string) {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new Error("riot_not_configured");
  const now = Date.now();
  const wait = Math.max(0, nextRiotRequestAt - now);
  nextRiotRequestAt = Math.max(nextRiotRequestAt, now) + 75;
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  const response = await fetch(`https://${region}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`, { headers: { "X-Riot-Token": key }, cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`riot_${response.status}`);
  return response.json() as Promise<unknown>;
}
