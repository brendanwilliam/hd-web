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

export function plausibleMatch(match: unknown, puuid: string, observedStartedAt: Date) {
  const info = data(data(match).info);
  const participant = list(info.participants).map(data).find(value => text(value.puuid) === puuid);
  const start = number(info.gameStartTimestamp);
  const supported = number(info.mapId) === 11 && [400, 420, 430, 440, 490].includes(number(info.queueId)) && text(info.gameMode) === "CLASSIC";
  return participant && supported && Math.abs(start - observedStartedAt.getTime()) <= 300_000 ? { info, participant } : null;
}
