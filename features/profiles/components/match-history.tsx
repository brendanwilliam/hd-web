import Link from "next/link";
import type { Report, RiotMatchSnapshot } from "@prisma/client";
import { duration, readMatchSummary, type MatchSummary } from "@/features/profiles/domain/matches";
import { reportPath } from "@/features/profiles/domain/paths";

type HistoryReport = Pick<Report, "id" | "riotGameId" | "champion" | "gameMode" | "durationSeconds" | "completedAt" | "payload">;
type Card = { summary: MatchSummary; report?: HistoryReport };
const object = (value: unknown) => typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => typeof value === "number" ? value : 0;

function legacyCard(report: HistoryReport): Card {
  const payload = object(report.payload), final = object(payload.final);
  return { report, summary: { gameId: report.riotGameId || report.id, playedAt: report.completedAt.toISOString(), gameMode: report.gameMode || text(payload.game_mode) || "Unknown mode", map: text(payload.map) || "", durationSeconds: report.durationSeconds || number(payload.duration_seconds), teamKills: number(payload.team_kills), enemyTeamKills: number(payload.enemy_team_kills), player: { champion: report.champion || text(payload.champion) || "League game", role: text(payload.role), outcome: text(payload.outcome) === "Victory" ? "Victory" : "Defeat", kills: number(final.kills), deaths: number(final.deaths), assists: number(final.assists), cs: number(final.cs), gold: number(final.gold), level: number(final.level) }, allies: [], enemies: [] } };
}

function championArt(champion: string) {
  const id = champion.replace(/[^a-z0-9]/gi, "");
  return `url(https://ddragon.leagueoflegends.com/cdn/15.16.1/img/champion/${encodeURIComponent(id)}.png)`;
}

function Roster({ names, label }: { names: string[]; label: string }) {
  return <div className="match-roster" aria-label={label}>{names.slice(0, 5).map((champion, index) => <span key={`${champion}-${index}`} title={champion} style={{ backgroundImage: championArt(champion) }}>{champion.slice(0, 1)}</span>)}</div>;
}

function MatchCard({ card, slug }: { card: Card; slug: string }) {
  const { summary, report } = card;
  const destination = report ? reportPath(slug, report.id) : `/${encodeURIComponent(slug)}/matches/${encodeURIComponent(summary.gameId)}`;
  return <Link className={`match-card ${summary.player.outcome === "Victory" ? "victory" : "defeat"}`} href={destination}><div className="match-result"><strong>{summary.player.outcome}</strong><span>{summary.gameMode}</span></div><span className="champion-avatar" style={{ backgroundImage: championArt(summary.player.champion) }}>{summary.player.champion.slice(0, 1)}</span><div className="match-player"><strong>{summary.player.champion}</strong><span>{summary.player.role || "No role"}</span></div><div className="match-kda"><strong>{summary.player.kills} / {summary.player.deaths} / {summary.player.assists}</strong><span>KDA</span></div><div className="match-stat"><strong>{summary.player.cs}</strong><span>CS</span></div><div className="match-stat"><strong>{summary.player.gold.toLocaleString()}</strong><span>Gold</span></div><div className="match-score"><strong>{summary.teamKills} – {summary.enemyTeamKills}</strong><span>{duration(summary.durationSeconds)} · {summary.map || "League"}</span></div><div className="match-teams"><Roster label="Allied champions" names={summary.allies} /><Roster label="Enemy champions" names={summary.enemies} /></div><div className="match-time"><strong>{report ? "Input recap" : "Riot summary"}</strong><span>{new Date(summary.playedAt).toLocaleDateString()}</span></div></Link>;
}

export function MatchHistory({ slug, snapshots, reports }: { slug: string; snapshots: RiotMatchSnapshot[]; reports: HistoryReport[] }) {
  const reportsByGame = new Map(reports.filter(report => report.riotGameId).map(report => [report.riotGameId as string, report]));
  const cards: Card[] = snapshots.flatMap(snapshot => { const summary = readMatchSummary(snapshot.payload); return summary ? [{ summary, report: reportsByGame.get(summary.gameId) }] : []; });
  const represented = new Set(cards.flatMap(card => card.report ? [card.report.id] : []));
  for (const report of reports) if (!represented.has(report.id)) cards.push(legacyCard(report));
  cards.sort((left, right) => Date.parse(right.summary.playedAt) - Date.parse(left.summary.playedAt));
  return <div className="match-history">{cards.length ? cards.map(card => <MatchCard key={card.report?.id ?? card.summary.gameId} card={card} slug={slug} />) : <p className="history-empty">No matches are cached yet. Refresh match history to load the player’s recent Riot games.</p>}</div>;
}
