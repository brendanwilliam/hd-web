import Link from "next/link";
import { requireAccount } from "@/features/auth/server/account";
import { reportPath } from "@/features/reports/domain/paths";
import { db } from "@/shared/server/db";
import { redirect } from "next/navigation";

export default async function ReportsPage() {
  const account = await requireAccount();
  if (!account) redirect("/link");
  const reports = await db.report.findMany({ where: { accountId: account.id }, orderBy: { observedStartedAt: "desc" }, select: { id: true, observedStartedAt: true, reconciliationState: true, gameMode: true, durationMs: true } });
  return <main><p className="eyebrow">PRIVATE REPORTS</p><h1>Your recaps</h1>{reports.length ? <ul>{reports.map(report => <li key={report.id}><Link href={reportPath(report.id)}>{report.observedStartedAt.toLocaleString()} · {report.gameMode} · {Math.round(report.durationMs / 60_000)} min · {report.reconciliationState.replaceAll("_", " ")}</Link></li>)}</ul> : <p>No uploaded recaps yet. Complete a supported League game with uploads enabled.</p>}</main>;
}
