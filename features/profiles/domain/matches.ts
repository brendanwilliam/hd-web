import { normalizeRiotId } from "@/features/reports/domain/payload";

export type Data = Record<string, unknown>;
export type PlayerStats = { champion: string; role: string; outcome: "Victory" | "Defeat"; kills: number; deaths: number; assists: number; cs: number; gold: number; level: number };
export type MatchSummary = { gameId: string; playedAt: string; gameMode: string; map: string; durationSeconds: number; teamKills: number; enemyTeamKills: number; player: PlayerStats; allies: string[]; enemies: string[] };

const object = (value: unknown): Data => typeof value === "object" && value !== null ? value as Data : {};
const list = (value: unknown): Data[] => Array.isArray(value) ? value.map(object) : [];
const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => typeof value === "number" ? value : 0;
const participantName = (participant: Data) => `${text(participant.riotIdGameName)}#${text(participant.riotIdTagline)}`;
const mapName = (id: number) => ({ 11: "Summoner's Rift", 12: "Howling Abyss", 21: "Nexus Blitz", 30: "Arena" })[id] ?? "Unknown map";

export function matchSummary(match: unknown, gameId: string, riotId: string): MatchSummary {
  const info = object(object(match).info), participants = list(info.participants);
  const player = participants.find(participant => normalizeRiotId(participantName(participant)) === normalizeRiotId(riotId));
  if (!player) throw new Error("The player was not present in this Riot match.");
  const teamId = number(player.teamId);
  const team = participants.filter(participant => number(participant.teamId) === teamId);
  const enemy = participants.filter(participant => number(participant.teamId) !== teamId);
  return {
    gameId, playedAt: new Date(number(info.gameCreation)).toISOString(), gameMode: text(info.gameMode) || "Unknown mode", map: mapName(number(info.mapId)), durationSeconds: Math.round(number(info.gameDuration)),
    teamKills: team.reduce((total, participant) => total + number(participant.kills), 0), enemyTeamKills: enemy.reduce((total, participant) => total + number(participant.kills), 0),
    player: { champion: text(player.championName) || "Unknown champion", role: text(player.teamPosition) || "", outcome: player.win === true ? "Victory" : "Defeat", kills: number(player.kills), deaths: number(player.deaths), assists: number(player.assists), cs: number(player.totalMinionsKilled) + number(player.neutralMinionsKilled), gold: number(player.goldEarned), level: number(player.champLevel) },
    allies: team.map(participant => text(participant.championName)).filter(Boolean), enemies: enemy.map(participant => text(participant.championName)).filter(Boolean)
  };
}

export function readMatchSummary(value: unknown): MatchSummary | null {
  const summary = object(value), player = object(summary.player);
  if (!text(summary.gameId) || !text(summary.playedAt) || !text(player.champion)) return null;
  return { gameId: text(summary.gameId), playedAt: text(summary.playedAt), gameMode: text(summary.gameMode) || "Unknown mode", map: text(summary.map) || "Unknown map", durationSeconds: number(summary.durationSeconds), teamKills: number(summary.teamKills), enemyTeamKills: number(summary.enemyTeamKills), player: { champion: text(player.champion), role: text(player.role), outcome: player.outcome === "Victory" ? "Victory" : "Defeat", kills: number(player.kills), deaths: number(player.deaths), assists: number(player.assists), cs: number(player.cs), gold: number(player.gold), level: number(player.level) }, allies: Array.isArray(summary.allies) ? summary.allies.filter((name): name is string => typeof name === "string") : [], enemies: Array.isArray(summary.enemies) ? summary.enemies.filter((name): name is string => typeof name === "string") : [] };
}

export const duration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
