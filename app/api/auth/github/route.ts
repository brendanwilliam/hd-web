import { appUrl } from "@/features/auth/server/account";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const returnToCookie = "hd_oauth_return_to";

export async function GET(request: Request) {
  if (!process.env.GITHUB_CLIENT_ID)
    return new NextResponse("GitHub OAuth is not configured", { status: 503 });
  const code = new URL(request.url).searchParams.get("code")?.toUpperCase();
  const returnTo =
    code && /^[A-F0-9]{4}-[A-F0-9]{4}$/.test(code) ? `/link?code=${code}` : "/link";
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${appUrl()}/api/auth/github/callback`);
  url.searchParams.set("scope", "read:user");
  (await cookies()).set(returnToCookie, returnTo, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/github",
    maxAge: 600,
  });
  return NextResponse.redirect(url);
}
