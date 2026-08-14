import Link from "next/link";
import { requireAccount } from "@/features/auth/server/account";
import { db } from "@/shared/server/db";
import { notFound, redirect } from "next/navigation";

type Data = Record<string, unknown>;
const data = (value: unknown): Data => typeof value === "object" && value !== null ? value as Data : {};
const number = (value: unknown) => typeof value === "number" ? value : 0;
const text = (value: unknown) => typeof value === "string" ? value : "";
const list = (value: unknown) => Array.isArray(value) ? value : [];

function eventLabel(value: unknown) {
  const event = data(value);
  const timestamp = number(event.timestamp);
  return `${Math.floor(timestamp / 60_000)}:${(Math.floor(timestamp / 1_000) % 60).toString().padStart(2, "0")} · ${text(event.type) || "Riot event"}`;
}

export default async function RiotMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const account = await requireAccount();
  if (!account) redirect("/link");
  const { matchId } = await params;
  const match = await db.riotMatch.findFirst({ where: { id: matchId, accountId: account.id } });
  if (!match) notFound();
  const player = data(data(match.matchSummary).player);
  const events = list(match.riotEvents);
  return <main><p><Link href="/reports">← Your reports</Link></p><p className="eyebrow">RIOT MATCH</p><h1>{match.riotIdGameName}#{match.riotIdTagLine}</h1><p>{match.gameStartedAt.toLocaleString()} · {match.gameMode} · {Math.round(match.durationMs / 60_000)} minutes</p><section><h2>Match recap</h2><p>{text(player.championName) ? `Champion: ${text(player.championName)}.` : "Champion unavailable."}</p><ul><li>Result: {player.win === true ? "Victory" : player.win === false ? "Defeat" : "Unavailable"}</li><li>K / D / A: {number(player.kills)} / {number(player.deaths)} / {number(player.assists)}</li><li>CS: {number(player.totalMinionsKilled) + number(player.neutralMinionsKilled)}</li></ul><h3>Riot timeline</h3>{events.length ? <ol>{events.map((event, index) => <li key={index}>{eventLabel(event)}</li>)}</ol> : <p>No timeline events were returned for this match.</p>}</section></main>;
}
