import { db } from "@/shared/server/db";
import { reconcileReport } from "@/features/reports/server/reconcile";
import { NextResponse } from "next/server";

// Configure this endpoint as a daily authenticated Vercel cron job. Revoked token
// hashes are retained for 90 days to preserve a revocation audit window.
export async function POST(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return new NextResponse(null, { status: 401 });
  const now = new Date();
  const retention = new Date(now.getTime() - 90 * 24 * 60 * 60_000);
  const [grants, tokens, reports] = await db.$transaction([
    db.deviceGrant.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.apiToken.deleteMany({ where: { revokedAt: { lt: retention } } }),
    db.report.findMany({
      where: {
        reconciliationState: { in: ["pending", "input_only"] },
        OR: [{ retryAt: null }, { retryAt: { lte: now } }],
      },
      select: { id: true },
      take: 50,
    }),
  ]);
  await Promise.all(reports.map((report) => reconcileReport(report.id)));
  return NextResponse.json({
    expired_grants: grants.count,
    expired_tokens: tokens.count,
    reconciled_reports: reports.length,
  });
}
