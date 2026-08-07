import { profilePath, reportPath } from "@/features/profiles/domain/paths";
import { normalizeRiotId } from "@/features/reports/domain/payload";
import { db } from "@/shared/server/db";
import { notFound, redirect } from "next/navigation";
import { MatchHistory } from "@/features/profiles/components/match-history";
import { HistoryRefresh } from "@/features/profiles/components/history-refresh";

export default async function ProfilePage({ params }: { params: Promise<{ riotId: string }> }) {
  const { riotId } = await params;
  const value = decodeURIComponent(riotId);
  const profile = await db.profile.findFirst({ where: value.includes("#") ? { riotIdNormalized: normalizeRiotId(value) } : { slug: normalizeRiotId(value) }, include: { reports: { orderBy: { completedAt: "desc" }, take: 50 }, matchSnapshots: { orderBy: { playedAt: "desc" }, take: 20 } } });
  if (!profile) notFound();
  if (value !== profile.slug) redirect(profilePath(profile.slug));
  return <main className="profile-page"><section className="profile-hero"><p className="eyebrow">HANDS CHECK · PLAYER PROFILE</p><h1>{profile.riotId}</h1><p>Recent Riot games and linked privacy-safe input recaps.</p><HistoryRefresh profileId={profile.id} slug={profile.slug} fetchedAt={profile.riotHistoryFetchedAt} /></section><section className="profile-history"><div className="profile-history-heading"><div><p className="eyebrow">MATCH HISTORY</p><h2>Recent games</h2></div><p>{profile.reports.length} linked recap{profile.reports.length === 1 ? "" : "s"}</p></div><MatchHistory slug={profile.slug} snapshots={profile.matchSnapshots} reports={profile.reports} /></section></main>;
}
