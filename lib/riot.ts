const regions = ["americas", "europe", "asia", "sea"] as const;
export type RiotRegion = (typeof regions)[number];
export const isRiotRegion = (value: string): value is RiotRegion => regions.includes(value as RiotRegion);
export const riotRegions = regions;
const defaultPlatform: Record<RiotRegion, string> = { americas: "NA1", europe: "EUW1", asia: "KR", sea: "SG2" };

type Data = Record<string, unknown>;
const data = (value: unknown): Data => typeof value === "object" && value !== null ? value as Data : {};
const list = (value: unknown): Data[] => Array.isArray(value) ? value.map(data) : [];
const number = (value: unknown) => typeof value === "number" ? value : 0;
const text = (value: unknown) => typeof value === "string" ? value : "";
const playerName = (player: Data) => `${text(player.riotIdGameName)}#${text(player.riotIdTagline)}`;
const mapName = (id: number) => ({ 11: "Summoner's Rift", 12: "Howling Abyss", 21: "Nexus Blitz", 30: "Arena" })[id] ?? "Unknown map";

export type ManualReport = {
  player: string; champion: string; role: string; outcome: string; gameId: string; gameMode: string; map: string;
  completedAt: string; durationSeconds: number; teamGold: number; enemyTeamGold: number; teamKills: number; enemyTeamKills: number;
  final: { kills: number; deaths: number; assists: number; cs: number; gold: number; level: number };
  samples: Data[]; events: Data[]; abilities: Data[]; items: Data[];
  participants: { riotId: string; champion: string }[];
};

export function makeManualReport(match: unknown, timeline: unknown, gameId: string, requestedPlayer = ""): ManualReport {
  const info = data(data(match).info), participants = list(info.participants);
  const selected = participants.find(player => playerName(player).toLocaleLowerCase() === requestedPlayer.toLocaleLowerCase()) ?? participants[0];
  if (!selected) throw new Error("Riot returned a match with no participants.");
  const participantId = number(selected.participantId), teamId = number(selected.teamId);
  const samples: Data[] = [], events: Data[] = [], abilities: Data[] = [], items: Data[] = [];
  const levels: Record<number, number> = {};
  for (const [frameIndex, frame] of list(data(data(timeline).info).frames).entries()) {
    const seconds = Math.round(number(frame.timestamp) / 1000), stats = data(data(frame.participantFrames)[String(participantId)]);
    if (Object.keys(stats).length) samples.push({ seconds, cs: number(stats.minionsKilled) + number(stats.jungleMinionsKilled), level: number(stats.level), gold: number(stats.currentGold), estimatedGold: number(stats.totalGold) });
    for (const [eventIndex, event] of list(frame.events).entries()) {
      const seconds = Math.round(number(event.timestamp) / 1000), type = text(event.type);
      let detail = "", category = "";
      if (type === "CHAMPION_KILL" && (number(event.killerId) === participantId || number(event.victimId) === participantId)) { detail = "Champion kill"; category = "Kill"; }
      else if (type === "ELITE_MONSTER_KILL") { detail = `${text(event.monsterType) || "Elite monster"} kill`; category = "Objective"; }
      else if (type === "BUILDING_KILL") { detail = text(event.buildingType) === "TOWER_BUILDING" ? "Turret destroyed" : "Building destroyed"; category = "Structure"; }
      else if (type === "LEVEL_UP" && number(event.participantId) === participantId) { detail = "Level up"; category = "Level"; }
      else if (type === "SKILL_LEVEL_UP" && number(event.participantId) === participantId && number(event.skillSlot) >= 1 && number(event.skillSlot) <= 4) { const slot = number(event.skillSlot); abilities.push({ ability: "QWER"[slot - 1], level: levels[slot] = (levels[slot] ?? 0) + 1, seconds }); }
      else if (type === "ITEM_PURCHASED" && number(event.participantId) === participantId) items.push({ item: `Item ${number(event.itemId)}`, seconds });
      if (category) events.push({ id: `${frameIndex}-${eventIndex}`, seconds, detail, category });
    }
  }
  const final = { kills: number(selected.kills), deaths: number(selected.deaths), assists: number(selected.assists), cs: number(selected.totalMinionsKilled) + number(selected.neutralMinionsKilled), gold: number(selected.goldEarned), level: number(selected.champLevel) };
  return { player: playerName(selected), champion: text(selected.championName), role: text(selected.teamPosition) || "Unavailable", outcome: selected.win === true ? "Victory" : "Defeat", gameId, gameMode: text(info.gameMode), map: mapName(number(info.mapId)), completedAt: new Date(number(info.gameCreation)).toISOString(), durationSeconds: Math.round(number(info.gameDuration)), teamGold: participants.filter(player => number(player.teamId) === teamId).reduce((sum, player) => sum + number(player.goldEarned), 0), enemyTeamGold: participants.filter(player => number(player.teamId) !== teamId).reduce((sum, player) => sum + number(player.goldEarned), 0), teamKills: participants.filter(player => number(player.teamId) === teamId).reduce((sum, player) => sum + number(player.kills), 0), enemyTeamKills: participants.filter(player => number(player.teamId) !== teamId).reduce((sum, player) => sum + number(player.kills), 0), final, samples, events, abilities, items, participants: participants.map(player => ({ riotId: playerName(player), champion: text(player.championName) })) };
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
  return makeManualReport(match, timeline, gameId, player);
}
