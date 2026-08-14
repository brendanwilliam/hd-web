import Link from "next/link";
import { requireAccount } from "@/features/auth/server/account";
import { reportPath, riotMatchPath } from "@/features/reports/domain/paths";
import { fetchRecentMatchesAction } from "@/features/reports/server/fetch-recent-matches-action";
import { RecentMatchImportForm } from "@/features/reports/components/recent-match-import-form";
import { db } from "@/shared/server/db";
import { redirect } from "next/navigation";

const fetchError = (code: string | undefined) => ({ invalid_riot_id: "Enter your Riot ID as Game Name#Tag.", riot_not_configured: "Riot API access is not configured.", riot_id_not_found: "That Riot ID could not be found.", riot_429: "Riot rate limited the fetch. Please try again shortly.", riot_matches_unavailable: "Riot did not return recent matches." }[code ?? ""] ?? (code ? "Could not fetch recent matches." : ""));

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ imported?: string; fetch_error?: string }> }) {
  const account = await requireAccount();
  if (!account) redirect("/link");
  const [params, reports, matches] = await Promise.all([
    searchParams,
    db.report.findMany({ where: { accountId: account.id }, orderBy: { observedStartedAt: "desc" }, select: { id: true, observedStartedAt: true, reconciliationState: true, gameMode: true, durationMs: true } }),
    db.riotMatch.findMany({ where: { accountId: account.id }, orderBy: { gameStartedAt: "desc" }, select: { id: true, gameStartedAt: true, gameMode: true, durationMs: true } }),
  ]);
  return <main><p className="eyebrow">PRIVATE REPORTS</p><h1>Your recaps</h1><section><h2>Import Riot match history</h2><p>Fetch your 20 most recent games, including games without Hands Diff input.</p><RecentMatchImportForm action={fetchRecentMatchesAction} />{params.imported ? <p role="status">Imported {params.imported} Riot matches.</p> : null}{fetchError(params.fetch_error) ? <p role="alert">{fetchError(params.fetch_error)}</p> : null}</section><section><h2>Input recaps</h2>{reports.length ? <ul>{reports.map(report => <li key={report.id}><Link href={reportPath(report.id)}>{report.observedStartedAt.toLocaleString()} · {report.gameMode} · {Math.round(report.durationMs / 60_000)} min · {report.reconciliationState.replaceAll("_", " ")}</Link></li>)}</ul> : <p>No uploaded recaps yet.</p>}</section><section><h2>Riot match history</h2>{matches.length ? <ul>{matches.map(match => <li key={match.id}><Link href={riotMatchPath(match.id)}>{match.gameStartedAt.toLocaleString()} · {match.gameMode} · {Math.round(match.durationMs / 60_000)} min · Riot match</Link></li>)}</ul> : <p>Fetch your recent games to populate this history.</p>}</section></main>;
}
