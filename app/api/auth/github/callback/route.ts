import { appUrl } from "@/features/auth/server/account";
import { setSession } from "@/features/auth/server/session";
import { db } from "@/shared/server/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const returnToCookie = "handscheck_oauth_return_to";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code || !process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) return new NextResponse("GitHub sign-in failed", { status: 400 });
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", { method: "POST", headers: { Accept: "application/json" }, body: new URLSearchParams({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code, redirect_uri: `${appUrl()}/api/auth/github/callback` }) });
  const accessToken = (await tokenResponse.json() as { access_token?: string }).access_token;
  if (!accessToken) return new NextResponse("GitHub sign-in failed", { status: 401 });
  const profileResponse = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "handscheck" } });
  const profile = await profileResponse.json() as { id?: number; login?: string; avatar_url?: string };
  if (!profile.id || !profile.login) return new NextResponse("GitHub profile unavailable", { status: 401 });
  const account = await db.account.upsert({ where: { githubId: String(profile.id) }, create: { githubId: String(profile.id), login: profile.login, avatarUrl: profile.avatar_url }, update: { login: profile.login, avatarUrl: profile.avatar_url } });
  await setSession(account.id);
  const returnTo = (await cookies()).get(returnToCookie)?.value ?? "/link";
  const response = NextResponse.redirect(new URL(returnTo, request.url));
  response.cookies.delete(returnToCookie);
  return response;
}
