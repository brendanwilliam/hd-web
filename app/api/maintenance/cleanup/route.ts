import { db } from "@/shared/server/db";
import { NextResponse } from "next/server";

// Configure this endpoint as a daily authenticated Vercel cron job. Revoked token hashes are
// retained for 90 days to preserve a revocation audit window without keeping them indefinitely.
export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new NextResponse(null, { status: 401 });
  const now = new Date();
  const retention = new Date(now.getTime() - 90 * 24 * 60 * 60_000);
  const [grants, tokens] = await db.$transaction([
    db.deviceGrant.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.apiToken.deleteMany({ where: { revokedAt: { lt: retention } } })
  ]);
  return NextResponse.json({ expired_grants: grants.count, expired_tokens: tokens.count });
}
