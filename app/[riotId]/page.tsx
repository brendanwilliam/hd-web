import { db } from "@/lib/db";
import { normalizeRiotId } from "@/lib/report";
import { notFound } from "next/navigation";

export default async function ProfilePage({ params }: { params: Promise<{ riotId: string }> }) {
  const { riotId } = await params;
  const profile = await db.profile.findUnique({ where: { riotIdNormalized: normalizeRiotId(decodeURIComponent(riotId)) }, include: { reports: { orderBy: { completedAt: "desc" }, take: 50 } } });
  if (!profile) notFound();
  return <main><h1>{profile.riotId}</h1><p>Public match recaps</p><ul>{profile.reports.map(report => <li key={report.id}><a href={`/${encodeURIComponent(profile.riotId)}/reports/${report.id}`}>{report.champion ?? "League game"} · {report.gameMode ?? "Unknown mode"} · {report.completedAt.toLocaleDateString()}</a></li>)}</ul></main>;
}
