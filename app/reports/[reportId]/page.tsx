import Link from "next/link";
import { requireAccount } from "@/features/auth/server/account";
import { db } from "@/shared/server/db";
import { notFound, redirect } from "next/navigation";

type Data = Record<string, unknown>;
const data = (value: unknown): Data => typeof value === "object" && value !== null ? value as Data : {};
const number = (value: unknown) => typeof value === "number" ? value : 0;

export default async function ReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const account = await requireAccount();
  if (!account) redirect("/link");
  const { reportId } = await params;
  const report = await db.report.findFirst({ where: { id: reportId, accountId: account.id } });
  if (!report) notFound();
  const payload = data(report.payload), input = data(payload.input), summary = data(input.summary);
  const match = data(report.matchSummary), player = data(match.player);
  return <main><p><Link href="/reports">← Your reports</Link></p><p className="eyebrow">PRIVATE INPUT RECAP</p><h1>{report.riotIdGameName}#{report.riotIdTagLine}</h1><p>{report.observedStartedAt.toLocaleString()} · {report.gameMode} · {Math.round(report.durationMs / 60_000)} minutes</p><section><h2>Input summary</h2><ul><li>Total left clicks: {number(input.left_clicks).toLocaleString()}</li><li>Total right clicks: {number(input.right_clicks).toLocaleString()}</li><li>Total clicks: {(number(input.left_clicks) + number(input.right_clicks)).toLocaleString()}</li><li>Gameplay-bound key actions: {number(input.gameplay_key_actions).toLocaleString()}</li><li>Peak / median APM: {number(summary.peak_apm).toFixed(0)} / {number(summary.median_apm).toFixed(0)}</li><li>Peak / median mouse velocity: {number(summary.peak_mouse_velocity).toFixed(2)} / {number(summary.median_mouse_velocity).toFixed(2)}</li></ul></section><section><h2>Match recap</h2>{report.reconciliationState === "matched" ? <p>Matched Riot game {report.matchId}. {typeof player.championName === "string" ? `Champion: ${player.championName}.` : ""}</p> : <p>{report.reconciliationState === "needs_attention" ? "This report needs attention before match data can be attached." : "Input-only recap while Hands Diff waits for a verified Riot match."} {report.reconciliationError ?? ""}</p>}</section></main>;
}
