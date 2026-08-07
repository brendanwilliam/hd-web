"use server";

import { requireAccount } from "@/features/auth/server/account";
import { profilePath } from "@/features/profiles/domain/paths";
import { hydrateReportPayload, isRiotRegion, loadManualReport } from "@/features/riot/server/report";
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
