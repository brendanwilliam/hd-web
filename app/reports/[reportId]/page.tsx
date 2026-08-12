import Link from "next/link";
import { requireAccount } from "@/features/auth/server/account";
import { db } from "@/shared/server/db";
import { notFound, redirect } from "next/navigation";

type Data = Record<string, unknown>;
const data = (value: unknown): Data => typeof value === "object" && value !== null ? value as Data : {};
const number = (value: unknown) => typeof value === "number" ? value : 0;
const list = (value: unknown) => Array.isArray(value) ? value : [];
const text = (value: unknown) => typeof value === "string" ? value : "";

function eventLabel(value: unknown) {
  const event = data(value);
  const timestamp = number(event.timestamp);
  const minutes = Math.floor(timestamp / 60_000);
  const seconds = Math.floor(timestamp / 1_000) % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")} · ${text(event.type) || "Riot event"}`;
}

export default async function ReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const account = await requireAccount();
  if (!account) redirect("/link");
  const { reportId } = await params;
  const report = await db.report.findFirst({ where: { id: reportId, accountId: account.id } });
  if (!report) notFound();

  const payload = data(report.payload);
  const input = data(payload.input);
  const summary = data(input.summary);
  const match = data(report.matchSummary);
  const player = data(match.player);
  const teams = list(match.teams).map(data);
  const events = list(report.riotEvents);

  return <main>
    <p><Link href="/reports">← Your reports</Link></p>
    <p className="eyebrow">PRIVATE INPUT RECAP</p>
    <h1>{report.riotIdGameName}#{report.riotIdTagLine}</h1>
    <p>{report.observedStartedAt.toLocaleString()} · {report.gameMode} · {Math.round(report.durationMs / 60_000)} minutes</p>
    <section>
      <h2>Input summary</h2>
      <ul>
        <li>Total left clicks: {number(input.left_clicks).toLocaleString()}</li>
        <li>Total right clicks: {number(input.right_clicks).toLocaleString()}</li>
        <li>Total clicks: {(number(input.left_clicks) + number(input.right_clicks)).toLocaleString()}</li>
        <li>Gameplay-bound key actions: {number(input.gameplay_key_actions).toLocaleString()}</li>
        <li>Peak / median APM: {number(summary.peak_apm).toFixed(0)} / {number(summary.median_apm).toFixed(0)}</li>
        <li>Peak / median mouse velocity: {number(summary.peak_mouse_velocity).toFixed(2)} / {number(summary.median_mouse_velocity).toFixed(2)}</li>
      </ul>
    </section>
    <section>
      <h2>Match recap</h2>
      {report.reconciliationState === "matched" ? <>
        <p>Matched Riot game {report.matchId}. {text(player.championName) ? `Champion: ${text(player.championName)}.` : ""}</p>
        <ul>
          <li>Result: {player.win === true ? "Victory" : player.win === false ? "Defeat" : "Unavailable"}</li>
          <li>K / D / A: {number(player.kills)} / {number(player.deaths)} / {number(player.assists)}</li>
          <li>CS: {number(player.totalMinionsKilled) + number(player.neutralMinionsKilled)}</li>
        </ul>
        {teams.length ? <><h3>Teams</h3><ul>{teams.map((team, index) => <li key={index}>Team {number(team.teamId) || index + 1}: {team.win === true ? "Victory" : "Defeat"}</li>)}</ul></> : null}
        <h3>Riot events</h3>
        {events.length ? <ol>{events.map((event, index) => <li key={index}>{eventLabel(event)}</li>)}</ol> : <p>No timeline events were returned for this match.</p>}
      </> : <p>{["needs_attention", "identity_not_found", "ambiguous_match"].includes(report.reconciliationState) ? "This report needs attention before match data can be attached." : "Input-only recap while Hands Diff waits for a verified Riot match."} {report.reconciliationError ?? ""}</p>}
    </section>
  </main>;
}
