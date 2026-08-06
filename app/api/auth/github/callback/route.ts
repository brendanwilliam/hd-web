import { appUrl } from "@/lib/auth";
import { db } from "@/lib/db";
import { setSession } from "@/lib/session";
import { NextResponse } from "next/server";

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
  return NextResponse.redirect(new URL("/link", request.url));
}
