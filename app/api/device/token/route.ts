import { db } from "@/lib/db";
import { digest, secret } from "@/lib/crypto";
import { jsonError, requestJson } from "@/lib/http";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await requestJson(request) as { device_code?: unknown };
    if (typeof body.device_code !== "string") return jsonError("invalid device code");
    const grant = await db.deviceGrant.findUnique({ where: { deviceCodeHash: digest(body.device_code) } });
    if (!grant || grant.expiresAt < new Date()) return jsonError("expired device code", 410);
    if (!grant.approvedAt || !grant.accountId) return jsonError("authorization_pending", 428);
    if (grant.consumedAt) return jsonError("device code already consumed", 409);
    const token = secret(40);
    await db.$transaction([
      db.apiToken.create({ data: { tokenHash: digest(token), accountId: grant.accountId, grantId: grant.id } }),
      db.deviceGrant.update({ where: { id: grant.id }, data: { consumedAt: new Date() } })
    ]);
    return NextResponse.json({ access_token: token, token_type: "Bearer", scope: "reports:write" });
  } catch { return jsonError("invalid request"); }
}
