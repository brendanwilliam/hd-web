import { db } from "@/lib/db";
import { normalizeRiotId } from "@/lib/report";
import { hydrateReportPayload, loadManualReport, riotRegionForGameId } from "@/lib/riot";
import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { ReportVisualizations } from "./report-visualizations";

type ObjectData = Record<string, unknown>;
const number = (value: unknown) => typeof value === "number" ? value : 0;
const text = (value: unknown) => typeof value === "string" ? value : "Unavailable";
const array = (payload: ObjectData, key: string) => Array.isArray(payload[key]) ? payload[key] : [];
const object = (value: unknown) => typeof value === "object" && value !== null ? value as ObjectData : {};

export default async function ReportPage({ params }: { params: Promise<{ riotId: string; reportId: string }> }) {
  const { riotId, reportId } = await params;
  const profile = await db.profile.findUnique({ where: { riotIdNormalized: normalizeRiotId(decodeURIComponent(riotId)) } });
  if (!profile) notFound();
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
          durationSeconds: typeof hydrated.duration_seconds === "number" ? hydrated.duration_seconds : null,
          payload: hydrated as Prisma.InputJsonValue
        }
      });
      payload = hydrated;
    } catch {
      // The next visit retries when Riot data is temporarily unavailable.
    }
  }
  const input = array(payload, "input_samples") as ObjectData[];
  const actions = input.reduce((total, sample) => total + number(sample.actions), 0);
  const distance = input.reduce((total, sample) => total + number(sample.mouse_distance_pixels), 0);
  return <main className="report-page"><a href={`/${encodeURIComponent(profile.riotId)}`}>← {profile.riotId}</a><section className="report-hero"><p className="eyebrow">HANDS CHECK · MATCH GRAPHS</p><div><h1>{text(payload.champion)} match report</h1><p>{text(payload.game_mode)} · {Math.round(number(payload.duration_seconds) / 60)} minutes · {new Date(report.completedAt).toLocaleString()}</p></div><div className="report-metrics"><span><b>{actions.toLocaleString()}</b> actions</span><span><b>{Math.round(distance).toLocaleString()} px</b> mouse distance</span><span><b>{number(payload.team_kills)} / {number(payload.enemy_team_kills)}</b> team kills</span></div></section><ReportVisualizations payload={payload} /></main>;
}
