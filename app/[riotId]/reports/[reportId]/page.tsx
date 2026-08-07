import { profilePath } from "@/features/profiles/domain/paths";
import { normalizeRiotId } from "@/features/reports/domain/payload";
import { MouseDwellHeatmap, ReportVisualizations } from "@/features/reports/visualizations";
import { attachRiotMatch } from "@/features/reports/server/attach-riot-match";
import { hydrateReportPayload, loadManualReport, reconcileReportPayload, riotRegionForGameId } from "@/features/riot/server/report";
import type { Prisma } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { requireAccount } from "@/features/auth/server/account";
import { db } from "@/shared/server/db";

type ObjectData = Record<string, unknown>;
const number = (value: unknown) => typeof value === "number" ? value : 0;
const text = (value: unknown) => typeof value === "string" ? value : "Unavailable";
const array = (payload: ObjectData, key: string) => Array.isArray(payload[key]) ? payload[key] : [];
const object = (value: unknown) => typeof value === "object" && value !== null ? value as ObjectData : {};
const reconciliationRetryDelay = 10 * 60_000;

function canReconcile(enrichment: ObjectData) {
  const lookup = object(enrichment.riot_match_v5_reconciliation);
  if (lookup.status === "ambiguous") return false;
  const attemptedAt = typeof lookup.attempted_at === "string" ? Date.parse(lookup.attempted_at) : NaN;
  return !Number.isFinite(attemptedAt) || Date.now() - attemptedAt >= reconciliationRetryDelay;
}

export default async function ReportPage({ params }: { params: Promise<{ riotId: string; reportId: string }> }) {
  const { riotId, reportId } = await params;
  const routeValue = decodeURIComponent(riotId);
  const profile = await db.profile.findFirst({ where: routeValue.includes("#") ? { riotIdNormalized: normalizeRiotId(routeValue) } : { slug: normalizeRiotId(routeValue) } });
  if (!profile) notFound();
  if (routeValue !== profile.slug) redirect(`${profilePath(profile.slug)}/reports/${encodeURIComponent(reportId)}`);
  const report = await db.report.findFirst({ where: { id: reportId, profileId: profile.id } });
  if (!report) notFound();
  let payload = report.payload as ObjectData;
  const enrichment = object(payload.enrichment);
  const gameId = typeof payload.game_id === "string" ? payload.game_id : "";
  if (!enrichment.riot_match_v5 && gameId) {
    try {
      const hydrated = hydrateReportPayload(payload, await loadManualReport(riotRegionForGameId(gameId), gameId, profile.riotId));
      await db.report.update({
        where: { id: report.id },
        data: {
          completedAt: new Date(String(hydrated.completed_at)),
          champion: typeof hydrated.champion === "string" ? hydrated.champion : null,
          gameMode: typeof hydrated.game_mode === "string" ? hydrated.game_mode : null,
          durationSeconds: typeof hydrated.duration_seconds === "number" ? hydrated.duration_seconds : null, riotGameId: typeof hydrated.game_id === "string" ? hydrated.game_id : null,
          payload: hydrated as Prisma.InputJsonValue
        }
      });
      payload = hydrated;
    } catch {
      // The next visit retries when Riot data is temporarily unavailable.
    }
  } else if (!enrichment.riot_match_v5 && canReconcile(enrichment)) {
    const result = await reconcileReportPayload(payload, report.completedAt, profile.riotId);
    const attemptedAt = new Date().toISOString();
    const hydrated = result.payload ?? { ...payload, enrichment: { ...enrichment, riot_match_v5_reconciliation: { status: result.status, attempted_at: attemptedAt } } };
    await db.report.update({
      where: { id: report.id },
      data: {
        completedAt: new Date(String(hydrated.completed_at)),
        champion: typeof hydrated.champion === "string" ? hydrated.champion : null,
        gameMode: typeof hydrated.game_mode === "string" ? hydrated.game_mode : null,
        durationSeconds: typeof hydrated.duration_seconds === "number" ? hydrated.duration_seconds : null, riotGameId: typeof hydrated.game_id === "string" ? hydrated.game_id : null,
        payload: hydrated as Prisma.InputJsonValue
      }
    });
    payload = hydrated;
  }
  const input = array(payload, "input_samples") as ObjectData[];
  const actions = input.reduce((total, sample) => total + number(sample.actions), 0);
  const distance = input.reduce((total, sample) => total + number(sample.mouse_distance_pixels), 0);
  const account = await requireAccount();
  const lookup = object(object(payload.enrichment).riot_match_v5_reconciliation);
  const unresolved = !object(payload.enrichment).riot_match_v5 && !gameId;
  return <main className="report-page"><a href={profilePath(profile.slug)}>← {profile.riotId}</a><section className="report-hero"><div className="report-hero-title"><p className="eyebrow">HANDS CHECK · MATCH GRAPHS</p><h1>{text(payload.champion)} match report</h1><p>{text(payload.game_mode)} · {Math.round(number(payload.duration_seconds) / 60)} minutes · {new Date(report.completedAt).toLocaleString()}</p></div><div className="report-summary"><div className="report-metrics"><span><b>{actions.toLocaleString()}</b> actions</span><span><b>{Math.round(distance).toLocaleString()} px</b> mouse distance</span><span><b>{number(payload.team_kills)} / {number(payload.enemy_team_kills)}</b> team kills</span></div><div className="report-hero-heatmap"><p className="eyebrow">MOUSE DWELL</p><MouseDwellHeatmap payload={payload} compact /></div></div></section>{unresolved && <section className="report-panel"><h2>Post-game data unavailable</h2><p className="report-note">{lookup.status === "ambiguous" ? "More than one Riot match matched this report. Attach the correct match manually." : "Handscheck could not safely identify this match from Riot match history yet."}</p>{account?.id === profile.accountId && <form action={attachRiotMatch}><input type="hidden" name="profileId" value={profile.id} /><input type="hidden" name="reportId" value={report.id} /><label>Region <select name="region" defaultValue="americas"><option value="americas">Americas</option><option value="europe">Europe</option><option value="asia">Asia</option><option value="sea">Sea</option></select></label><label>Riot game ID <input name="gameId" required placeholder="NA1_123456789" /></label><button type="submit">Attach post-game data</button></form>}</section>}<ReportVisualizations payload={payload} /></main>;
}
