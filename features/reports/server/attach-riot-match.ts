"use server";

import { requireAccount } from "@/features/auth/server/account";
import { profilePath } from "@/features/profiles/domain/paths";
import { hydrateReportPayload, isRiotRegion, loadManualReport, riotRegionForGameId } from "@/features/riot/server/report";
import { db } from "@/shared/server/db";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

type Data = Record<string, unknown>;


export async function attachRiotMatch(formData: FormData) {
  const account = await requireAccount();
  const profileId = String(formData.get("profileId") ?? "");
  const reportId = String(formData.get("reportId") ?? "");
  const region = String(formData.get("region") ?? "");
  const gameId = String(formData.get("gameId") ?? "");
  const profile = account && profileId ? await db.profile.findFirst({ where: { id: profileId, accountId: account.id } }) : null;
  if (!profile || !isRiotRegion(region)) return;
  const report = await db.report.findFirst({ where: { id: reportId, profileId: profile.id } });
  if (!report) return;
  try {
    const payload = hydrateReportPayload(report.payload as Data, await loadManualReport(region, gameId, profile.riotId));
    await db.report.update({ where: { id: report.id }, data: { completedAt: new Date(String(payload.completed_at)), champion: typeof payload.champion === "string" ? payload.champion : null, gameMode: typeof payload.game_mode === "string" ? payload.game_mode : null, durationSeconds: typeof payload.duration_seconds === "number" ? payload.duration_seconds : null, riotGameId: typeof payload.game_id === "string" ? payload.game_id : null, payload: payload as Prisma.InputJsonValue } });
  } catch {
    return;
  }
  revalidatePath(`${profilePath(profile.slug)}/reports/${report.id}`);
}

export async function refreshRiotMatch(formData: FormData) {
  const account = await requireAccount();
  const profileId = String(formData.get("profileId") ?? "");
  const reportId = String(formData.get("reportId") ?? "");
  const profile = account && profileId ? await db.profile.findFirst({ where: { id: profileId, accountId: account.id } }) : null;
  if (!profile) return;
  const report = await db.report.findFirst({ where: { id: reportId, profileId: profile.id } });
  const payload = report?.payload as Data | undefined;
  const gameId = typeof report?.riotGameId === "string" ? report.riotGameId : typeof payload?.game_id === "string" ? payload.game_id : "";
  if (!report || !gameId) return;
  try {
    const refreshed = hydrateReportPayload(payload ?? {}, await loadManualReport(riotRegionForGameId(gameId), gameId, profile.riotId));
    await db.report.update({ where: { id: report.id }, data: { completedAt: new Date(String(refreshed.completed_at)), champion: typeof refreshed.champion === "string" ? refreshed.champion : null, gameMode: typeof refreshed.game_mode === "string" ? refreshed.game_mode : null, durationSeconds: typeof refreshed.duration_seconds === "number" ? refreshed.duration_seconds : null, riotGameId: gameId, payload: refreshed as Prisma.InputJsonValue } });
  } catch {
    return;
  }
  revalidatePath(`${profilePath(profile.slug)}/reports/${report.id}`);
}
