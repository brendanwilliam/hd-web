import { requireAccount } from "@/features/auth/server/account";
import { jsonError } from "@/shared/http";
import { db } from "@/shared/server/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const account = await requireAccount();
  if (!account) return jsonError("sign in required", 401);
  const code = new URL(request.url).searchParams.get("code")?.trim().toUpperCase();
  if (!code || !/^[A-F0-9]{4}-[A-F0-9]{4}$/.test(code)) return jsonError("invalid device code");
  const grant = await db.deviceGrant.findFirst({ where: { userCode: code, accountId: account.id } });
  if (!grant) return jsonError("device code not found", 404);
  return NextResponse.json({ status: grant.consumedAt ? "linked" : "waiting" });
}
