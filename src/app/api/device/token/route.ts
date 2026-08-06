import { digest, opaqueToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.device_code !== "string") return Response.json({ error: "invalid_request" }, { status: 400 });
  const grant = await prisma.deviceGrant.findUnique({ where: { codeHash: digest(body.device_code) } });
  if (!grant || grant.expiresAt < new Date()) return Response.json({ error: "expired_token" }, { status: 400 });
  if (!grant.approvedAt || !grant.accountId) return Response.json({ error: "authorization_pending" }, { status: 428 });
  if (grant.consumedAt) return Response.json({ error: "invalid_grant" }, { status: 400 });
  const token = opaqueToken();
  await prisma.$transaction([
    prisma.uploadToken.create({ data: { tokenHash: digest(token), accountId: grant.accountId } }),
    prisma.deviceGrant.update({ where: { id: grant.id }, data: { consumedAt: new Date() } }),
  ]);
  return Response.json({ access_token: token, token_type: "Bearer", scope: "reports:write" });
}
