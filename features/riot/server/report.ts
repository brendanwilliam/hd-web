import { normalizeTimeline, type ItemData } from "@/features/riot/domain/timeline";

const regions = ["americas", "europe", "asia", "sea"] as const;

export type RiotRegion = (typeof regions)[number];
export const isRiotRegion = (value: string): value is RiotRegion => regions.includes(value as RiotRegion);
export const riotRegions = regions;
const defaultPlatform: Record<RiotRegion, string> = { americas: "NA1", europe: "EUW1", asia: "KR", sea: "SG2" };
export function riotRegionForGameId(gameId: string): RiotRegion {
  const platform = gameId.split("_", 1)[0]?.toUpperCase();
  if (["NA1", "BR1", "LA1", "LA2", "OC1"].includes(platform)) return "americas";
  if (["EUW1", "EUN1", "TR1", "RU"].includes(platform)) return "europe";
  if (["KR", "JP1"].includes(platform)) return "asia";
  return "sea";
}

type Data = Record<string, unknown>;
const data = (value: unknown): Data => typeof value === "object" && value !== null ? value as Data : {};
const list = (value: unknown): Data[] => Array.isArray(value) ? value.map(data) : [];
const number = (value: unknown) => typeof value === "number" ? value : 0;
const text = (value: unknown) => typeof value === "string" ? value : "";
const playerName = (player: Data) => `${text(player.riotIdGameName)}#${text(player.riotIdTagline)}`;
const mapName = (id: number) => ({ 11: "Summoner's Rift", 12: "Howling Abyss", 21: "Nexus Blitz", 30: "Arena" })[id] ?? "Unknown map";
const sameRiotId = (left: string, right: string) => left.normalize("NFKC").trim().toLocaleLowerCase() === right.normalize("NFKC").trim().toLocaleLowerCase();

export type ManualReport = {
  player: string; champion: string; role: string; outcome: string; gameId: string; gameMode: string; map: string;
  completedAt: string; durationSeconds: number; teamGold: number; enemyTeamGold: number; teamKills: number; enemyTeamKills: number;
  final: { kills: number; deaths: number; assists: number; cs: number; gold: number; level: number };
  samples: Data[]; events: Data[]; abilities: Data[]; items: Data[];
  participants: { riotId: string; champion: string }[];
};

export function hydrateReportPayload(payload: Data, report: ManualReport): Data {
  const enrichment = data(payload.enrichment);
  return {
    ...payload,
    completed_at: report.completedAt,
    champion: report.champion,
    role: report.role,
    outcome: report.outcome,
    game_id: report.gameId,
    game_mode: report.gameMode,
    map: report.map,
    duration_seconds: report.durationSeconds,
    team_gold: report.teamGold,
    enemy_team_gold: report.enemyTeamGold,
    team_kills: report.teamKills,
    enemy_team_kills: report.enemyTeamKills,
    samples: report.samples.map(sample => ({ ...sample, estimated_gold: number(sample.estimatedGold) })),
    timeline_samples: report.samples.map(sample => ({ ...sample, estimated_gold: number(sample.estimatedGold) })),
    events: report.events,
    timeline_events: report.events,
    abilities: report.abilities,
    item_events: report.items,
    enrichment: { ...enrichment, riot_match_v5: true, riot_match_v5_timeline: true, riot_match_v5_timeline_version: 6 }
  };
}

export function makeManualReport(match: unknown, timeline: unknown, gameId: string, requestedPlayer = "", items: Record<string, ItemData> = {}): ManualReport {
  const info = data(data(match).info), participants = list(info.participants);
  const selected = requestedPlayer ? participants.find(player => sameRiotId(playerName(player), requestedPlayer)) : participants[0];
  if (!selected) throw new Error("Riot returned a match with no participants.");
  const participantId = number(selected.participantId), teamId = number(selected.teamId);
  const normalized = normalizeTimeline(match, timeline, participantId, items);
  const final = { kills: number(selected.kills), deaths: number(selected.deaths), assists: number(selected.assists), cs: number(selected.totalMinionsKilled) + number(selected.neutralMinionsKilled), gold: number(selected.goldEarned), level: number(selected.champLevel) };
  return { player: playerName(selected), champion: text(selected.championName), role: text(selected.teamPosition) || "Unavailable", outcome: selected.win === true ? "Victory" : "Defeat", gameId, gameMode: text(info.gameMode), map: mapName(number(info.mapId)), completedAt: new Date(number(info.gameCreation)).toISOString(), durationSeconds: Math.round(number(info.gameDuration)), teamGold: participants.filter(player => number(player.teamId) === teamId).reduce((sum, player) => sum + number(player.goldEarned), 0), enemyTeamGold: participants.filter(player => number(player.teamId) !== teamId).reduce((sum, player) => sum + number(player.goldEarned), 0), teamKills: participants.filter(player => number(player.teamId) === teamId).reduce((sum, player) => sum + number(player.kills), 0), enemyTeamKills: participants.filter(player => number(player.teamId) !== teamId).reduce((sum, player) => sum + number(player.kills), 0), final, ...normalized, participants: participants.map(player => ({ riotId: playerName(player), champion: text(player.championName) })) };
}

export async function loadManualReport(region: RiotRegion, gameId: string, player = "") {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new Error("RIOT_API_KEY is not configured on this server.");
  gameId = gameId.trim();
  if (/^\d+$/.test(gameId)) gameId = `${defaultPlatform[region]}_${gameId}`;
  if (!/^[A-Za-z0-9]+_[A-Za-z0-9]+$/.test(gameId)) throw new Error("Enter a Riot Game ID such as NA1_123456789.");
  const endpoint = `https://${region}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(gameId)}`;
  const fetchRiot = async (url: string) => { const response = await fetch(url, { headers: { "X-Riot-Token": key }, cache: "no-store" }); if (!response.ok) throw new Error(`Riot API request failed (HTTP ${response.status}).`); return response.json(); };
  const [match, timeline] = await Promise.all([fetchRiot(endpoint), fetchRiot(`${endpoint}/timeline`)]);
  const version = dataDragonVersion(text(data(data(match).info).gameVersion));
  const items = version ? await loadItems(version) : {};
  return makeManualReport(match, timeline, gameId, player, items);
}

export const dataDragonVersion = (gameVersion: string) => gameVersion.match(/\d+\.\d+\.\d+/)?.[0] ?? "";

async function loadItems(version: string): Promise<Record<string, ItemData>> {
  const direct = await fetchItems(version);
  if (direct) return direct;
  try {
    const response = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", { cache: "force-cache" });
    const versions = response.ok ? await response.json() : [];
    const [major, minor] = version.split(".");
    const fallback = Array.isArray(versions) ? versions.find(value => typeof value === "string" && value.startsWith(`${major}.${minor}.`)) : undefined;
    return fallback ? await fetchItems(fallback) ?? {} : {};
  } catch { return {}; }
}

async function fetchItems(version: string): Promise<Record<string, ItemData> | null> {
  try {
    const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(version)}/data/en_US/item.json`, { cache: "force-cache" });
    if (!response.ok) return null;
    const items = data(data(await response.json()).data) as Record<string, ItemData>;
    return Object.keys(items).length ? items : null;
  } catch { return null; }
}

export type ReconciliationStatus = "matched" | "not_found" | "ambiguous" | "error";
export type ReconciliationResult = { status: ReconciliationStatus; payload?: Data };

const riotFetch = async (url: string) => {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new Error("RIOT_API_KEY is not configured on this server.");
  const response = await fetch(url, { headers: { "X-Riot-Token": key }, cache: "no-store" });
  if (!response.ok) throw new Error(`Riot API request failed (HTTP ${response.status}).`);
  return response.json();
};

function riotIdParts(riotId: string) {
  const index = riotId.lastIndexOf("#");
  if (index <= 0 || index === riotId.length - 1) throw new Error("A Riot ID must include a game name and tagline.");
  return { gameName: riotId.slice(0, index), tagLine: riotId.slice(index + 1) };
}

async function accountForRiotId(riotId: string): Promise<{ region: RiotRegion; puuid: string } | null> {
  const { gameName, tagLine } = riotIdParts(riotId);
  for (const region of riotRegions) {
    const response = await fetch(`https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`, { headers: { "X-Riot-Token": process.env.RIOT_API_KEY ?? "" }, cache: "no-store" });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`Riot API request failed (HTTP ${response.status}).`);
    const account = data(await response.json());
    const puuid = text(account.puuid);
    if (puuid) return { region, puuid };
  }
  return null;
}

function isCandidate(match: unknown, riotId: string, completedAt: Date, durationSeconds: number, gameMode: string) {
  const info = data(data(match).info);
  const participants = list(info.participants);
  const participant = participants.find(value => sameRiotId(playerName(value), riotId));
  if (!participant || text(info.gameMode).toUpperCase() !== gameMode.toUpperCase()) return false;
  const duration = number(info.gameDuration);
  const end = number(info.gameEndTimestamp) || number(info.gameCreation) + duration * 1000;
  return Math.abs(duration - durationSeconds) <= 45 && Math.abs(end - completedAt.getTime()) <= 5 * 60_000;
}

export async function reconcileReportPayload(payload: Data, completedAt: Date, riotId: string): Promise<ReconciliationResult> {
  try {
    const account = await accountForRiotId(riotId);
    const durationSeconds = number(payload.duration_seconds);
    const gameMode = text(payload.game_mode);
    if (!account || !durationSeconds || !gameMode) return { status: "not_found" };
    const startTime = Math.floor((completedAt.getTime() - (durationSeconds + 5 * 60) * 1000) / 1000);
    const endTime = Math.floor((completedAt.getTime() + 5 * 60_000) / 1000);
    const ids = await riotFetch(`https://${account.region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(account.puuid)}/ids?startTime=${startTime}&endTime=${endTime}&count=20`) as unknown;
    if (!Array.isArray(ids)) return { status: "not_found" };
    const matches = await Promise.all(ids.filter((id): id is string => typeof id === "string").map(async id => ({ id, match: await riotFetch(`https://${account.region}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(id)}`) })));
    const candidates = matches.filter(candidate => isCandidate(candidate.match, riotId, completedAt, durationSeconds, gameMode));
    if (candidates.length === 0) return { status: "not_found" };
    if (candidates.length !== 1) return { status: "ambiguous" };
    const report = await loadManualReport(account.region, candidates[0].id, riotId);
    return { status: "matched", payload: hydrateReportPayload(payload, report) };
  } catch {
    return { status: "error" };
  }
}
