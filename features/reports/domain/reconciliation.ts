type Data = Record<string, unknown>;

const data = (value: unknown): Data => typeof value === "object" && value !== null ? value as Data : {};
const list = (value: unknown) => Array.isArray(value) ? value : [];
const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => typeof value === "number" ? value : 0;

export type ReconciliationState = "matched" | "input_only" | "identity_not_found" | "ambiguous_match" | "needs_attention" | "pending";

export function retryDelayMs(attempt: number) {
  return Math.min(60 * 60_000, 60_000 * 2 ** Math.max(0, attempt));
}

export function normalizedMatchSummary(participant: unknown, teams: unknown) {
  const player = data(participant);
  return {
    player: {
      championName: text(player.championName), win: player.win === true ? true : player.win === false ? false : null,
      kills: number(player.kills), deaths: number(player.deaths), assists: number(player.assists),
      totalMinionsKilled: number(player.totalMinionsKilled), neutralMinionsKilled: number(player.neutralMinionsKilled),
    },
    teams: list(teams).map(value => {
      const team = data(value);
      return { teamId: number(team.teamId), win: team.win === true ? true : team.win === false ? false : null };
    }),
  };
}

export function normalizedTimelineEvents(timeline: unknown) {
  return list(data(data(timeline).info).frames).flatMap(frame => list(data(frame).events))
    .map(value => data(value)).map(event => ({
      timestamp: number(event.timestamp), type: text(event.type), participantId: number(event.participantId) || null,
      killerId: number(event.killerId) || null, victimId: number(event.victimId) || null,
      assistingParticipantIds: list(event.assistingParticipantIds).filter((id): id is number => typeof id === "number"),
      itemId: number(event.itemId) || null, wardType: text(event.wardType) || null,
      buildingType: text(event.buildingType) || null, teamId: number(event.teamId) || null,
    })).filter(event => event.timestamp >= 0 && event.type.length > 0);
}

export type TimelineRosterPlayer = { participantId: number; teamId: number; championName: string; isLinkedPlayer: boolean };
export type TimelineSnapshot = { timestamp: number; totalGold: number; laneCs: number; jungleCs: number };
export type TimelineEvent = { timestamp: number; kind: "takedown" | "death" | "monster" | "tower" | "inhibitor"; side: "ally" | "enemy" | "neutral"; championName: string | null };

export function normalizedReportTimeline(match: unknown, timeline: unknown, linkedParticipantId: number) {
  const info = data(data(match).info);
  const roster = list(info.participants).map(data).map(player => ({ participantId: number(player.participantId), teamId: number(player.teamId), championName: text(player.championName), isLinkedPlayer: number(player.participantId) === linkedParticipantId }))
    .filter(player => player.participantId > 0 && player.teamId > 0);
  const byId = new Map(roster.map(player => [player.participantId, player]));
  const linked = byId.get(linkedParticipantId);
  const frames = list(data(data(timeline).info).frames).map(data);
  const snapshots = frames.flatMap(frame => {
    const player = data(data(frame.participantFrames)[String(linkedParticipantId)]);
    const timestamp = number(frame.timestamp);
    return timestamp >= 0 && Object.keys(player).length ? [{ timestamp, totalGold: number(player.totalGold), laneCs: number(player.minionsKilled), jungleCs: number(player.jungleMinionsKilled) }] : [];
  });
  const events = frames.flatMap(frame => list(frame.events)).map(data).flatMap(event => normalizeReportEvent(event, byId, linked));
  return { gameVersion: text(info.gameVersion), roster, snapshots, events };
}

function normalizeReportEvent(event: Data, byId: Map<number, TimelineRosterPlayer>, linked: TimelineRosterPlayer | undefined): TimelineEvent[] {
  const timestamp = number(event.timestamp), type = text(event.type), killerId = number(event.killerId), victimId = number(event.victimId);
  if (timestamp < 0 || !linked) return [];
  const actor = byId.get(killerId || number(event.participantId));
  const side = actor ? actor.teamId === linked.teamId ? "ally" : "enemy" : "neutral";
  if (type === "CHAMPION_KILL") {
    const assists = list(event.assistingParticipantIds).filter((id): id is number => typeof id === "number");
    if (killerId === linked.participantId || assists.includes(linked.participantId)) return [{ timestamp, kind: "takedown", side, championName: linked.championName || null }];
    if (victimId === linked.participantId) return [{ timestamp, kind: "death", side, championName: linked.championName || null }];
  }
  if (type === "ELITE_MONSTER_KILL") return [{ timestamp, kind: "monster", side, championName: actor?.championName || null }];
  if (type === "BUILDING_KILL") {
    const kind = text(event.buildingType) === "INHIBITOR_BUILDING" ? "inhibitor" : text(event.buildingType) === "TOWER_BUILDING" ? "tower" : null;
    if (kind) {
      const destroyedTeam = number(event.teamId);
      const buildingSide = destroyedTeam ? destroyedTeam === linked.teamId ? "enemy" : "ally" : "neutral";
      return [{ timestamp, kind, side: actor ? side : buildingSide, championName: actor?.championName || null }];
    }
  }
  return [];
}

export function plausibleMatch(match: unknown, puuid: string, observedStartedAt: Date) {
  const info = data(data(match).info);
  const participant = list(info.participants).map(data).find(value => text(value.puuid) === puuid);
  const start = number(info.gameStartTimestamp);
  const supported = number(info.mapId) === 11 && [400, 420, 430, 440, 490].includes(number(info.queueId)) && text(info.gameMode) === "CLASSIC";
  return participant && supported && Math.abs(start - observedStartedAt.getTime()) <= 300_000 ? { info, participant } : null;
}
