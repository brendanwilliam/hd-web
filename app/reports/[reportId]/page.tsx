import Link from "next/link";
import { requireAccount } from "@/features/auth/server/account";
import { GameInputTimeline } from "@/features/reports/components";
import { hydrateInputOnlyReport } from "@/features/reports/server";
import { createReportTimelineView } from "@/features/reports/domain/timeline-view";
import { db } from "@/shared/server/db";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Data = Record<string, unknown>;
const data = (value: unknown): Data =>
  typeof value === "object" && value !== null ? (value as Data) : {};
const number = (value: unknown) => (typeof value === "number" ? value : 0);
const list = (value: unknown) => (Array.isArray(value) ? value : []);
const text = (value: unknown) => (typeof value === "string" ? value : "");

export default async function ReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const account = await requireAccount();
  if (!account) redirect("/link");
  const { reportId } = await params;
  const report = await hydrateInputOnlyReport(account.id, reportId);
  if (!report) notFound();

  const payload = data(report.payload);
  const capture = data(payload.capture);
  const input = data(payload.input);
  const summary = data(input.summary);
  const match = data(report.matchSummary);
  const player = data(match.player);
  const teams = list(match.teams).map(data);
  const inputEvents = await db.inputEvent.findMany({
    where: { reportId: report.id },
    select: { second: true, kind: true },
    orderBy: { second: "asc" },
  });
  const timeline = createReportTimelineView({
    durationMs: report.durationMs,
    riotEvents: report.riotEvents,
    payload: report.payload,
    inputEvents,
  });

  return (
    <main>
      <p>
        <Link href="/reports">← Your reports</Link>
      </p>
      <p className="eyebrow">PRIVATE INPUT RECAP</p>
      <h1>
        {report.riotIdGameName}#{report.riotIdTagLine}
      </h1>
      <p>
        {report.observedStartedAt.toLocaleString()} · {report.gameMode} ·{" "}
        {Math.round(report.durationMs / 60_000)} minutes
      </p>
      {capture.complete === false ? (
        <p>
          This is a partial input capture: Hands Diff began observing after the game
          started.
        </p>
      ) : null}
      <section>
        <h2>Input summary</h2>
        <ul>
          <li>Total left clicks: {number(input.left_clicks).toLocaleString()}</li>
          <li>Total right clicks: {number(input.right_clicks).toLocaleString()}</li>
          <li>
            Total clicks:{" "}
            {(number(input.left_clicks) + number(input.right_clicks)).toLocaleString()}
          </li>
          <li>
            Gameplay-bound key actions:{" "}
            {number(input.gameplay_key_actions).toLocaleString()}
          </li>
          <li>
            Peak / median APM: {number(summary.peak_apm).toFixed(0)} /{" "}
            {number(summary.median_apm).toFixed(0)}
          </li>
          <li>
            Peak / median mouse velocity: {number(summary.peak_mouse_velocity).toFixed(2)}
            / {number(summary.median_mouse_velocity).toFixed(2)}
          </li>
        </ul>
      </section>
      <section>
        <h2>Match recap</h2>
        {report.reconciliationState === "matched" ? (
          <>
            <p>
              Verified Riot match.{" "}
              {text(player.championName) ? `Champion: ${text(player.championName)}.` : ""}
            </p>
            <ul>
              <li>
                Result:{" "}
                {player.win === true
                  ? "Victory"
                  : player.win === false
                    ? "Defeat"
                    : "Unavailable"}
              </li>
              <li>
                K / D / A: {number(player.kills)} / {number(player.deaths)} /{" "}
                {number(player.assists)}
              </li>
              <li>
                CS:{" "}
                {number(player.totalMinionsKilled) + number(player.neutralMinionsKilled)}
              </li>
            </ul>
            {teams.length ? (
              <>
                <h3>Teams</h3>
                <ul>
                  {teams.map((team, index) => (
                    <li key={index}>
                      Team {number(team.teamId) || index + 1}:{" "}
                      {team.win === true ? "Victory" : "Defeat"}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <GameInputTimeline model={timeline} />
          </>
        ) : (
          <p>
            {["needs_attention", "identity_not_found", "ambiguous_match"].includes(
              report.reconciliationState,
            )
              ? "This report needs attention before match data can be attached."
              : "Input-only recap while Hands Diff waits for a verified Riot match."}{" "}
            {report.reconciliationError ?? ""}
          </p>
        )}
      </section>
    </main>
  );
}
