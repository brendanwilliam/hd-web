import { digest, opaqueToken, shortCode } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const deviceCode = opaqueToken();
  const userCode = shortCode();
  await prisma.deviceGrant.create({
    data: {
      codeHash: digest(deviceCode),
      userCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return Response.json({ device_code: deviceCode, user_code: userCode, verification_uri: `${origin}/link`, interval: 5 });
}
