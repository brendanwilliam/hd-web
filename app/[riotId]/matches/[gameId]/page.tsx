import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { profilePath } from "@/features/profiles/domain/paths";
import { readMatchSummary } from "@/features/profiles/domain/matches";
import { normalizeRiotId } from "@/features/reports/domain/payload";
import { db } from "@/shared/server/db";

export default async function RiotMatchSummary({ params }: { params: Promise<{ riotId: string; gameId: string }> }) {
  const { riotId, gameId } = await params, value = decodeURIComponent(riotId);
  const profile = await db.profile.findFirst({ where: { slug: normalizeRiotId(value) } });
  if (!profile) notFound();
  if (value !== profile.slug) redirect(`${profilePath(profile.slug)}/matches/${encodeURIComponent(gameId)}`);
  const snapshot = await db.riotMatchSnapshot.findUnique({ where: { profileId_gameId: { profileId: profile.id, gameId } } });
  const match = snapshot && readMatchSummary(snapshot.payload);
  if (!match) notFound();
  return <main className="riot-match-page"><p><Link href={profilePath(profile.slug)}>← {profile.riotId}</Link></p><section className={`riot-match-hero ${match.player.outcome === "Victory" ? "victory" : "defeat"}`}><p className="eyebrow">RIOT MATCH SUMMARY</p><h1>{match.player.champion} · {match.player.outcome}</h1><p>{match.gameMode} · {match.map} · {Math.floor(match.durationSeconds / 60)} minutes</p><div className="riot-match-stats"><span><b>{match.player.kills} / {match.player.deaths} / {match.player.assists}</b>KDA</span><span><b>{match.player.cs}</b>CS</span><span><b>{match.player.gold.toLocaleString()}</b>gold</span><span><b>{match.teamKills} – {match.enemyTeamKills}</b>team score</span></div></section><section className="riot-match-rosters"><div><h2>Allies</h2><p>{match.allies.join(" · ")}</p></div><div><h2>Enemies</h2><p>{match.enemies.join(" · ")}</p></div></section><p className="report-note">This match came from Riot match history. Handscheck input telemetry is not available for it.</p></main>;
}
