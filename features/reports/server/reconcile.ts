import { db } from "@/shared/server/db";
import {
  normalizedMatchSummary,
  normalizedReportTimeline,
  plausibleMatch,
  retryDelayMs,
} from "@/features/reports/domain/reconciliation";
import type { Prisma } from "@prisma/client";

const regions = ["americas", "europe", "asia", "sea"] as const;
type Region = (typeof regions)[number];
type Data = Record<string, unknown>;
const data = (value: unknown): Data =>
  typeof value === "object" && value !== null ? (value as Data) : {};
const list = (value: unknown) => (Array.isArray(value) ? value : []);
const text = (value: unknown) => (typeof value === "string" ? value : "");
const number = (value: unknown) => (typeof value === "number" ? value : 0);
let nextRiotRequestAt = 0;

const accountByRiotIdUrl = (region: Region, gameName: string, tagLine: string) =>
  [
    `https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/`,
    `${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
  ].join("");

const matchesByPuuidUrl = (region: Region, puuid: string) =>
  [
    `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/`,
    `${encodeURIComponent(puuid)}/ids?count=20`,
  ].join("");

const matchUrl = (region: Region, matchId: string) =>
  [
    `https://${region}.api.riotgames.com/lol/match/v5/matches/`,
    encodeURIComponent(matchId),
  ].join("");

const timelineUrl = (region: Region, matchId: string) =>
  [matchUrl(region, matchId), "/timeline"].join("");

class RiotError extends Error {
  constructor(public readonly status: number) {
    super(`riot_${status}`);
  }
}
async function riot(url: string) {
  await paceRiotRequests();
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new Error("riot_not_configured");
  const response = await fetch(url, {
    headers: { "X-Riot-Token": key },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new RiotError(response.status);
  return response.json() as Promise<unknown>;
}

async function paceRiotRequests() {
  const now = Date.now();
  const wait = Math.max(0, nextRiotRequestAt - now);
  nextRiotRequestAt = Math.max(nextRiotRequestAt, now) + 75;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
}

export async function reconcileReport(reportId: string) {
  const report = await db.report.findUnique({ where: { id: reportId } });
  if (
    !report ||
    ["matched", "identity_not_found", "ambiguous_match", "needs_attention"].includes(
      report.reconciliationState,
    )
  )
    return;
  try {
    let account: Data | null = null,
      region: Region | null = null;
    for (const candidate of regions) {
      account = data(
        await riot(
          accountByRiotIdUrl(candidate, report.riotIdGameName, report.riotIdTagLine),
        ),
      );
      if (text(account.puuid)) {
        region = candidate;
        break;
      }
    }
    if (!account || !region || !text(account.puuid)) {
      return mark(reportId, "identity_not_found", "Riot ID was not found");
    }
    const puuid = text(account.puuid);
    const ids = await riot(matchesByPuuidUrl(region, puuid));
    if (!Array.isArray(ids)) {
      return mark(reportId, "input_only", "No match available yet");
    }
    const candidates: { id: string; match: Data; participant: Data }[] = [];
    for (const id of ids.filter((value): value is string => typeof value === "string")) {
      const match = data(await riot(matchUrl(region, id)));
      const candidate = plausibleMatch(match, puuid, report.observedStartedAt);
      if (candidate) candidates.push({ id, match, participant: candidate.participant });
    }
    if (!candidates.length) {
      return mark(reportId, "input_only", "No verified match yet");
    }
    if (candidates.length > 1) {
      return mark(reportId, "ambiguous_match", "Multiple plausible matches");
    }
    const candidate = candidates[0],
      info = data(candidate.match.info);
    const timeline = await riot(timelineUrl(region, candidate.id));
    const summary = normalizedMatchSummary(
      candidate.participant,
      info.teams,
      list(info.participants),
    ) as Prisma.InputJsonValue;
    const riotGameId = number(info.gameId) ? String(number(info.gameId)) : null;
    const participantId = number(candidate.participant.participantId) || 0;
    const reportTimeline = normalizedReportTimeline(
      candidate.match,
      timeline,
      participantId,
    );
    await db.report.update({
      where: { id: reportId },
      data: {
        resolvedPuuid: puuid,
        riotRegion: region,
        matchId: candidate.id,
        riotGameId,
        participantId: participantId || null,
        reconciliationState: "matched",
        reconciliationError: null,
        retryAt: null,
        matchSummary: summary,
        riotEvents: reportTimeline as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "riot_error";
    const attempts = report.reconciliationAttempt + 1;
    await db.report.update({
      where: { id: reportId },
      data:
        attempts >= 8
          ? {
              reconciliationState: "needs_attention",
              reconciliationAttempt: { increment: 1 },
              reconciliationError: "transient_retry_limit",
              retryAt: null,
            }
          : {
              reconciliationState: "pending",
              reconciliationAttempt: { increment: 1 },
              reconciliationError: message,
              retryAt: new Date(Date.now() + retryDelayMs(attempts - 1)),
            },
    });
  }
}

async function mark(
  id: string,
  state: "input_only" | "identity_not_found" | "ambiguous_match",
  message: string,
) {
  await db.report.update({
    where: { id },
    data: {
      reconciliationState: state,
      reconciliationError: message,
      retryAt: state === "input_only" ? new Date(Date.now() + 300_000) : null,
    },
  });
}
