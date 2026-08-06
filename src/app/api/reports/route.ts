import { digest } from "@/lib/crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeRiotId, reportSchema } from "@/lib/report";

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer) return Response.json({ error: "unauthorized" }, { status: 401 });
  const token = await prisma.uploadToken.findFirst({ where: { tokenHash: digest(bearer), revokedAt: null } });
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
  const parsed = reportSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "unsupported_report", details: parsed.error.flatten() }, { status: 422 });
  const report = parsed.data;
  const normalizedRiotId = normalizeRiotId(report.player);
  const profile = await prisma.riotProfile.upsert({
    where: { normalizedRiotId },
    create: { normalizedRiotId, riotId: report.player, ownerId: token.accountId },
    update: {},
  });
  if (profile.ownerId !== token.accountId) return Response.json({ error: "profile_owned_by_another_account" }, { status: 409 });
  await prisma.$transaction([
    prisma.report.upsert({
      where: { id: report.id },
      create: { id: report.id, profileId: profile.id, completedAt: new Date(report.completed_at), gameId: report.game_id, champion: report.champion, outcome: report.outcome, schemaVersion: report.schema_version, payload: report as Prisma.InputJsonValue },
      update: { completedAt: new Date(report.completed_at), gameId: report.game_id, champion: report.champion, outcome: report.outcome, schemaVersion: report.schema_version, payload: report as Prisma.InputJsonValue },
    }),
    prisma.uploadToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } }),
  ]);
  return Response.json({ id: report.id, profile: normalizedRiotId });
}
