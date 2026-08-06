import { appUrl } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  if (!process.env.GITHUB_CLIENT_ID) return new NextResponse("GitHub OAuth is not configured", { status: 503 });
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${appUrl()}/api/auth/github/callback`);
  url.searchParams.set("scope", "read:user");
  return NextResponse.redirect(url);
}
