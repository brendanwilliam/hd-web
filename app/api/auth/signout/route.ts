import { clearSession } from "@/features/auth/server/session";
import { NextResponse } from "next/server";
export async function POST(request: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
