import { db } from "@/lib/db";
import { digest } from "@/lib/crypto";
import { jsonError, requestJson } from "@/lib/http";
import { normalizeRiotId, reportSchema, safeReport } from "@/lib/report";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return jsonError("missing bearer token", 401);
  const token = await db.apiToken.findFirst({ where: { tokenHash: digest(bearer), revokedAt: null, scope: "reports:write" } });
  if (!token) return jsonError("invalid bearer token", 401);
  try {
    const parsed = reportSchema.safeParse(await requestJson(request));
    if (!parsed.success) return jsonError("unsupported or malformed report");
    const payload = safeReport(parsed.data);
    const riotIdNormalized = normalizeRiotId(payload.player);
    let profile = await db.profile.findUnique({ where: { riotIdNormalized } });
    if (profile && profile.accountId !== token.accountId) return jsonError("Riot ID belongs to another account", 409);
    if (!profile) profile = await db.profile.create({ data: { riotId: payload.player, riotIdNormalized, accountId: token.accountId } });
    const reportJson = payload as Prisma.InputJsonValue;
    await db.report.upsert({ where: { id: payload.id }, create: { id: payload.id, profileId: profile.id, completedAt: new Date(payload.completed_at), champion: payload.champion, gameMode: payload.game_mode, durationSeconds: payload.duration_seconds, payload: reportJson }, update: { profileId: profile.id, completedAt: new Date(payload.completed_at), champion: payload.champion, gameMode: payload.game_mode, durationSeconds: payload.duration_seconds, payload: reportJson } });
    await db.apiToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
    return NextResponse.json({ id: payload.id, profile: `/${encodeURIComponent(profile.riotId)}` });
  } catch (error) { return jsonError(error instanceof Error && error.message === "payload_too_large" ? "payload too large" : "invalid JSON"); }
}
