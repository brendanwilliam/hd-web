import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const cookieName = "handscheck_session";
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export async function sessionAccountId() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !process.env.SESSION_SECRET) return null;
  try { return (await jwtVerify(token, key())).payload.sub ?? null; } catch { return null; }
}
export async function setSession(accountId: string) {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required");
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(accountId).setIssuedAt().setExpirationTime("30d").sign(key());
  (await cookies()).set(cookieName, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
export async function clearSession() { (await cookies()).delete(cookieName); }
