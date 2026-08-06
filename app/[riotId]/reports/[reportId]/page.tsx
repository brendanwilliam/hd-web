import { db } from "@/lib/db";
import { normalizeRiotId } from "@/lib/report";
import { notFound } from "next/navigation";

type ObjectData = Record<string, unknown>;
const array = (payload: ObjectData, key: string) => Array.isArray(payload[key]) ? payload[key] as ObjectData[] : [];
const number = (value: unknown) => typeof value === "number" ? value : 0;
const text = (value: unknown) => typeof value === "string" ? value : "—";
export default async function ReportPage({ params }: { params: Promise<{ riotId: string; reportId: string }> }) {
  const { riotId, reportId } = await params;
  const profile = await db.profile.findUnique({ where: { riotIdNormalized: normalizeRiotId(decodeURIComponent(riotId)) } });
  if (!profile) notFound();
  const report = await db.report.findFirst({ where: { id: reportId, profileId: profile.id } });
  if (!report) notFound();
  const payload = report.payload as ObjectData;
  const samples = array(payload, "samples"), input = array(payload, "input_samples"), events = array(payload, "events"), bins = array(payload, "hexbins"), chapters = array(payload, "chapters");
  const actions = input.reduce((total, sample) => total + number(sample.actions), 0);
  const mouseDistance = input.reduce((total, sample) => total + number(sample.mouse_distance_pixels), 0);
  return <main><a href={`/${encodeURIComponent(profile.riotId)}`}>← {profile.riotId}</a><h1>{text(payload.champion)} recap</h1><p>{text(payload.game_mode)} · {Math.round(number(payload.duration_seconds) / 60)} minutes · {new Date(report.completedAt).toLocaleString()}</p><section><h2>Gameplay</h2><p>{samples.length} timeline samples · {events.length} game events</p><p>Team kills: {number(payload.team_kills)} · Enemy kills: {number(payload.enemy_team_kills)}</p></section><section><h2>Input & mouse activity</h2><p>{actions.toLocaleString()} aggregate actions · {Math.round(mouseDistance).toLocaleString()} pixels of mouse movement</p><p>Input is aggregated in time windows. Individual keys are never stored or displayed.</p></section><section><h2>Timeline</h2><ol>{chapters.map((chapter, index) => <li key={index}>{number(chapter.start_seconds)}s–{number(chapter.end_seconds)}s: {text(chapter.summary)}</li>)}</ol></section><section><h2>Events</h2><ul>{events.slice(0, 100).map((event, index) => <li key={index}>{number(event.seconds)}s · {text(event.type)} {text(event.detail)}</li>)}</ul></section><section><h2>Mouse heatmap</h2><p>{bins.length} aggregated hex cells</p><div className="heatmap">{bins.map((bin, index) => <i key={index} style={{ opacity: Math.min(1, Math.max(.1, number(bin.dwell_ms) / 30_000)) }} title={`${number(bin.dwell_ms)} ms`} />)}</div></section></main>;
}
