import { NextResponse } from "next/server";
import { db } from "@/shared/server/db";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.normalize("NFKC").trim() ?? "";
  if (query.length < 2) return NextResponse.json({ profiles: [] });
  const profiles = await db.profile.findMany({ where: { OR: [{ riotId: { contains: query, mode: "insensitive" } }, { slug: { contains: query.toLocaleLowerCase(), mode: "insensitive" } }] }, select: { riotId: true, slug: true }, orderBy: { updatedAt: "desc" }, take: 8 });
  return NextResponse.json({ profiles });
}
