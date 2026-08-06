import { db } from "@/lib/db";
import { digest, secret, userCode } from "@/lib/crypto";
import { appUrl } from "@/lib/auth";
import { jsonError, requestJson } from "@/lib/http";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await requestJson(request) as { client_name?: unknown };
    const clientName = typeof body.client_name === "string" ? body.client_name.slice(0, 100) : "Input Activity OBS";
    const deviceCode = secret();
    const grant = await db.deviceGrant.create({ data: { deviceCodeHash: digest(deviceCode), userCode: userCode(), clientName, expiresAt: new Date(Date.now() + 10 * 60_000) } });
    return NextResponse.json({ device_code: deviceCode, user_code: grant.userCode, verification_uri: `${appUrl()}/link`, expires_in: 600, interval: 5 });
  } catch { return jsonError("invalid request"); }
}
