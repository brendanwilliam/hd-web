import { db } from "@/shared/server/db";
import type { Prisma } from "@prisma/client";

const regions = ["americas", "europe", "asia", "sea"] as const;
type Region = (typeof regions)[number];
type Data = Record<string, unknown>;
const data = (value: unknown): Data => typeof value === "object" && value !== null ? value as Data : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => typeof value === "number" ? value : 0;

async function riot(url: string) {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new Error("riot_not_configured");
  const response = await fetch(url, { headers: { "X-Riot-Token": key }, cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`riot_${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function reconcileReport(reportId: string) {
  const report = await db.report.findUnique({ where: { id: reportId } });
  if (!report || report.reconciliationState === "matched" || report.reconciliationState === "needs_attention") return;
  try {
    let account: Data | null = null, region: Region | null = null;
    for (const candidate of regions) {
      account = data(await riot(`https://${candidate}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(report.riotIdGameName)}/${encodeURIComponent(report.riotIdTagLine)}`));
      if (text(account.puuid)) { region = candidate; break; }
    }
    if (!account || !region || !text(account.puuid)) return mark(reportId, "needs_attention", "Riot ID was not found");
    const puuid = text(account.puuid);
    const ids = await riot(`https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?count=20`);
    if (!Array.isArray(ids)) return mark(reportId, "input_only", "No match available yet");
    const candidates: { id: string; match: Data; participant: Data }[] = [];
    for (const id of ids.filter((value): value is string => typeof value === "string")) {
      const match = data(await riot(`https://${region}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(id)}`));
      const info = data(match.info), participants = Array.isArray(info.participants) ? info.participants.map(data) : [];
      const participant = participants.find(value => text(value.puuid) === puuid);
      const start = number(info.gameStartTimestamp);
      if (participant && number(info.mapId) === 11 && [400, 420, 430, 440, 490].includes(number(info.queueId)) && text(info.gameMode) === "CLASSIC" && Math.abs(start - report.observedStartedAt.getTime()) <= 300_000) candidates.push({ id, match, participant });
    }
    if (!candidates.length) return mark(reportId, "input_only", "No verified match yet");
    if (candidates.length > 1) return mark(reportId, "needs_attention", "Multiple plausible matches");
    const candidate = candidates[0], info = data(candidate.match.info);
    const timeline = await riot(`https://${region}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(candidate.id)}/timeline`);
    const timelineInfo = data(data(timeline).info);
    const frames = Array.isArray(timelineInfo.frames) ? timelineInfo.frames : [];
    const events = frames.flatMap(frame => Array.isArray(data(frame).events) ? data(frame).events : []).filter(value => typeof value === "object" && value !== null);
    const summary = { player: candidate.participant, teams: info.teams ?? [] } as Prisma.InputJsonValue;
    await db.report.update({ where: { id: reportId }, data: { resolvedPuuid: puuid, riotRegion: region, matchId: candidate.id, riotGameId: candidate.id, participantId: number(candidate.participant.participantId) || null, reconciliationState: "matched", reconciliationError: null, retryAt: null, matchSummary: summary, riotEvents: events as Prisma.InputJsonValue } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "riot_error";
    await db.report.update({ where: { id: reportId }, data: { reconciliationState: "pending", reconciliationAttempt: { increment: 1 }, reconciliationError: message, retryAt: new Date(Date.now() + 60_000) } });
  }
}

async function mark(id: string, state: "input_only" | "needs_attention", message: string) {
  await db.report.update({ where: { id }, data: { reconciliationState: state, reconciliationError: message, retryAt: state === "input_only" ? new Date(Date.now() + 300_000) : null } });
}
