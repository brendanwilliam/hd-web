import Link from "next/link";
import { requireAccount } from "@/features/auth/server/account";
import { buildMatchHistory } from "@/features/reports/domain/match-history";
import { reportPath, riotMatchPath } from "@/features/reports/domain/paths";
import { RecentMatchImportForm } from "@/features/reports/components";
import { fetchRecentMatchesAction } from "@/features/reports/server";
import { db } from "@/shared/server/db";
import { redirect } from "next/navigation";

const fetchError = (code: string | undefined) =>
  ({
    invalid_riot_id: "Enter your Riot ID as Game Name#Tag.",
    riot_not_configured: "Riot API access is not configured.",
    riot_id_not_found: "That Riot ID could not be found.",
    riot_429: "Riot rate limited the fetch. Please try again shortly.",
    riot_matches_unavailable: "Riot did not return recent matches.",
  })[code ?? ""] ?? (code ? "Could not fetch recent matches." : "");

const minutes = (durationMs: number) => Math.round(durationMs / 60_000);

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; fetch_error?: string }>;
}) {
  const account = await requireAccount();
  if (!account) redirect("/link");
  const [params, reports, matches] = await Promise.all([
    searchParams,
    db.report.findMany({
      where: { accountId: account.id },
      select: {
        id: true,
        observedStartedAt: true,
        reconciliationState: true,
        gameMode: true,
        durationMs: true,
        matchId: true,
      },
    }),
    db.riotMatch.findMany({
      where: { accountId: account.id },
      select: {
        id: true,
        matchId: true,
        gameStartedAt: true,
        gameMode: true,
        durationMs: true,
      },
    }),
  ]);
  const history = buildMatchHistory(matches, reports);
  return (
    <main>
      <p className="eyebrow">PRIVATE REPORTS</p>
      <h1>Your recaps</h1>
      <section>
        <h2>Import Riot match history</h2>
        <p>Fetch your 20 most recent games, including games without Hands Diff input.</p>
        <RecentMatchImportForm action={fetchRecentMatchesAction} />
        {params.imported ? (
          <p role="status">Imported {params.imported} Riot matches.</p>
        ) : null}
        {fetchError(params.fetch_error) ? (
          <p role="alert">{fetchError(params.fetch_error)}</p>
        ) : null}
      </section>
      <section>
        <h2>Match history</h2>
        {history.length ? (
          <ul>
            {history.map((item) =>
              item.kind === "riot" ? (
                <li key={`riot-${item.match.id}`}>
                  <Link href={riotMatchPath(item.match.id)}>
                    {[
                      item.match.gameStartedAt.toLocaleString(),
                      item.match.gameMode,
                      `${minutes(item.match.durationMs)} min`,
                      "Riot match",
                    ].join(" · ")}
                  </Link>
                  {item.inputReport ? (
                    <>
                      {" "}
                      · Input data linked (
                      <Link href={reportPath(item.inputReport.id)}>view input recap</Link>
                      )
                    </>
                  ) : (
                    " · No input data"
                  )}
                </li>
              ) : (
                <li key={`input-${item.report.id}`}>
                  <Link href={reportPath(item.report.id)}>
                    {item.report.observedStartedAt.toLocaleString()} ·{" "}
                    {item.report.gameMode} · {minutes(item.report.durationMs)} min · Input
                    recap · {item.report.reconciliationState.replaceAll("_", " ")}
                  </Link>
                </li>
              ),
            )}
          </ul>
        ) : (
          <p>
            Fetch your recent games or upload an input recap to populate this history.
          </p>
        )}
      </section>
    </main>
  );
}
