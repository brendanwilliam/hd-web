import { db } from "@/lib/db";
import { normalizeRiotId } from "@/lib/report";
import { profilePath, reportPath } from "@/lib/profile";
import { notFound, redirect } from "next/navigation";

export default async function ProfilePage({ params }: { params: Promise<{ riotId: string }> }) {
  const { riotId } = await params;
  const value = decodeURIComponent(riotId);
  const profile = await db.profile.findFirst({ where: value.includes("#") ? { riotIdNormalized: normalizeRiotId(value) } : { slug: normalizeRiotId(value) }, include: { reports: { orderBy: { completedAt: "desc" }, take: 50 } } });
  if (!profile) notFound();
  if (value !== profile.slug) redirect(profilePath(profile.slug));
  return <main><h1>{profile.riotId}</h1><p>Public match recaps</p><ul>{profile.reports.map(report => <li key={report.id}><a href={reportPath(profile.slug, report.id)}>{report.champion ?? "League game"} · {report.gameMode ?? "Unknown mode"} · {report.completedAt.toLocaleDateString()}</a></li>)}</ul><p><a href={profilePath(profile.slug)}>Canonical profile URL</a></p></main>;
}
