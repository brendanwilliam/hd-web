import { NextResponse } from "next/server";
export const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
export async function requestJson(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 5_000_000) throw new Error("payload_too_large");
  const body = await request.text();
  if (body.length > 5_000_000) throw new Error("payload_too_large");
  return JSON.parse(body) as unknown;
}
