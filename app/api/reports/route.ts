import { reportPath } from "@/features/reports/domain/paths";
import { canonicalPayload, validateReport } from "@/features/reports/domain/payload";
import { reconcileReport } from "@/features/reports/server/reconcile";
import { digest } from "@/shared/crypto";
import { jsonError, requestJson } from "@/shared/http";
import { db } from "@/shared/server/db";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return jsonError("missing bearer token", 401);
  const token = await db.apiToken.findFirst({ where: { tokenHash: digest(bearer), revokedAt: null, scope: "reports:write" } });
  if (!token) return jsonError("invalid bearer token", 401);
  try {
    const parsed = validateReport(await requestJson(request));
    if (!parsed.success) return jsonError("unsupported or malformed v2 report");
    const report = parsed.data;
    if (digest(canonicalPayload(report)) !== report.payload_hash) return jsonError("payload hash does not match report");
    const existing = await db.report.findUnique({ where: { accountId_id: { accountId: token.accountId, id: report.report_id } } });
    if (existing) {
      if (existing.payloadHash !== report.payload_hash) return jsonError("report ID was previously submitted with a different payload", 409);
      return NextResponse.json({ id: existing.id, url: reportPath(existing.id), status: "duplicate" });
    }
    await db.report.create({ data: { id: report.report_id, accountId: token.accountId, payloadHash: report.payload_hash, payload: report as Prisma.InputJsonValue, riotIdGameName: report.capture.riot_id.game_name, riotIdTagLine: report.capture.riot_id.tag_line, observedStartedAt: new Date(report.capture.started_at_utc), durationMs: report.capture.duration_ms, gameMode: report.capture.game_mode, mapNumber: report.capture.map_number } });
    await db.apiToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
    void reconcileReport(report.report_id);
    return NextResponse.json({ id: report.report_id, url: reportPath(report.report_id), status: "accepted" });
  } catch (error) { return jsonError(error instanceof Error && error.message === "payload_too_large" ? "payload too large" : "invalid JSON"); }
}
