type Data = Record<string, unknown>;

const data = (value: unknown): Data =>
  typeof value === "object" && value !== null ? (value as Data) : {};
const list = (value: unknown) => (Array.isArray(value) ? value : []);
const text = (value: unknown) => (typeof value === "string" ? value : "");
const number = (value: unknown) => (typeof value === "number" ? value : 0);

export type ReconciliationState =
  | "matched"
  | "input_only"
  | "identity_not_found"
  | "ambiguous_match"
  | "needs_attention"
  | "pending";

export function retryDelayMs(attempt: number) {
  return Math.min(60 * 60_000, 60_000 * 2 ** Math.max(0, attempt));
}

export function normalizedMatchSummary(
  participant: unknown,
  teams: unknown,
  participants: unknown[] = [],
) {
  const player = data(participant);
  return {
    player: playerSummary(player),
    players: participants.map(data).map(playerSummary),
    teams: list(teams).map((value) => {
      const team = data(value);
      return {
        teamId: number(team.teamId),
        win: team.win === true ? true : team.win === false ? false : null,
      };
    }),
  };
}

function playerSummary(player: Data) {
  return {
    participantId: number(player.participantId),
    teamId: number(player.teamId),
    championName: text(player.championName),
    win: player.win === true ? true : player.win === false ? false : null,
    kills: number(player.kills),
    deaths: number(player.deaths),
    assists: number(player.assists),
    totalMinionsKilled: number(player.totalMinionsKilled),
    neutralMinionsKilled: number(player.neutralMinionsKilled),
    level: number(player.champLevel),
    totalXp: number(player.champExperience),
    totalGold: number(player.goldEarned),
    currentGold:
      number(player.goldSpent) > 0
        ? Math.max(0, number(player.goldEarned) - number(player.goldSpent))
        : null,
    damageDealtToBuildings: number(player.damageDealtToBuildings),
    damageDealtToTurrets: number(player.damageDealtToTurrets),
    damageDealtToObjectives: number(player.damageDealtToObjectives),
    damageDealtToEpicMonsters: number(player.damageDealtToEpicMonsters),
  };
}

export function normalizedTimelineEvents(timeline: unknown) {
  return list(data(data(timeline).info).frames)
    .flatMap((frame) => list(data(frame).events))
    .map((value) => data(value))
    .map((event) => ({
      timestamp: number(event.timestamp),
      type: text(event.type),
      participantId: number(event.participantId) || null,
      killerId: number(event.killerId) || null,
      victimId: number(event.victimId) || null,
      assistingParticipantIds: list(event.assistingParticipantIds).filter(
        (id): id is number => typeof id === "number",
      ),
      itemId: number(event.itemId) || null,
      wardType: text(event.wardType) || null,
      buildingType: text(event.buildingType) || null,
      teamId: number(event.teamId) || null,
    }))
    .filter((event) => event.timestamp >= 0 && event.type.length > 0);
}

export type TimelineRosterPlayer = {
  participantId: number;
  teamId: number;
  championName: string;
  role: string | null;
  isLinkedPlayer: boolean;
};
export type TimelineSnapshot = {
  timestamp: number;
  totalGold: number;
  laneCs: number;
  jungleCs: number;
  currentGold: number;
  level: number;
  totalXp: number;
  position: { x: number; y: number } | null;
  precision: "frame";
  players: TimelinePlayerFrame[];
};
export type TimelinePlayerFrame = {
  participantId: number;
  currentGold: number;
  totalGold: number;
  level: number;
  totalXp: number;
  laneCs: number;
  jungleCs: number;
  position: { x: number; y: number } | null;
  precision: "frame";
};
export type LevelMarker = {
  level: number;
  timestamp: number;
  precision: "event" | "frame";
};
export type TimelineEvent = {
  timestamp: number;
  kind: "takedown" | "death" | "monster" | "tower" | "inhibitor";
  side: "ally" | "enemy" | "neutral";
  championName: string | null;
};

export function normalizedReportTimeline(
  match: unknown,
  timeline: unknown,
  linkedParticipantId: number,
) {
  const info = data(data(match).info);
  const roster = list(info.participants)
    .map(data)
    .map((player) => ({
      participantId: number(player.participantId),
      teamId: number(player.teamId),
      championName: text(player.championName),
      role: text(player.teamPosition) || null,
      isLinkedPlayer: number(player.participantId) === linkedParticipantId,
    }))
    .filter((player) => player.participantId > 0 && player.teamId > 0);
  const byId = new Map(roster.map((player) => [player.participantId, player]));
  const linked = byId.get(linkedParticipantId);
  const frames = list(data(data(timeline).info).frames).map(data);
  const snapshots = frames.flatMap((frame) => {
    const player = data(data(frame.participantFrames)[String(linkedParticipantId)]);
    const timestamp = number(frame.timestamp);
    const playerFrames = data(frame.participantFrames);
    return timestamp >= 0 && Object.keys(player).length
      ? [
          {
            timestamp,
            totalGold: number(player.totalGold),
            laneCs: number(player.minionsKilled),
            jungleCs: number(player.jungleMinionsKilled),
            currentGold: number(player.currentGold),
            level: number(player.level),
            totalXp: number(player.xp),
            position: position(player.position),
            precision: "frame" as const,
            players: roster.flatMap((rosterPlayer) => {
              const observed = data(playerFrames[String(rosterPlayer.participantId)]);
              return Object.keys(observed).length
                ? [
                    {
                      participantId: rosterPlayer.participantId,
                      currentGold: number(observed.currentGold),
                      totalGold: number(observed.totalGold),
                      level: number(observed.level),
                      totalXp: number(observed.xp),
                      laneCs: number(observed.minionsKilled),
                      jungleCs: number(observed.jungleMinionsKilled),
                      position: position(observed.position),
                      precision: "frame" as const,
                    },
                  ]
                : [];
            }),
          },
        ]
      : [];
  });
  const events = frames
    .flatMap((frame) => list(frame.events))
    .map(data)
    .flatMap((event) => normalizeReportEvent(event, byId, linked));
  const levelMarkers = levelMarkersFor(frames, linkedParticipantId, snapshots);
  const pathing = snapshots
    .filter(
      (snapshot, index) =>
        index === 0 || snapshot.jungleCs > snapshots[index - 1].jungleCs,
    )
    .map(({ timestamp, jungleCs, position }) => ({
      timestamp,
      jungleCs,
      position,
      precision: "frame" as const,
    }));
  const jungle =
    linked?.role === "JUNGLE"
      ? {
          firstPetUpgradeAt: null,
          questCompletedAt: null,
          crossings: [16, 24].map((count) => ({
            count,
            timestamp:
              snapshots.find((snapshot) => snapshot.jungleCs >= count)?.timestamp ?? null,
            precision: "frame" as const,
          })),
        }
      : null;
  return {
    gameVersion: text(info.gameVersion),
    roster,
    snapshots,
    events,
    levelMarkers,
    pathing,
    jungle,
    levelProgress: snapshots.map((snapshot) =>
      levelProgress(snapshot.level, snapshot.totalXp),
    ),
  };
}

function position(value: unknown) {
  const point = data(value),
    x = number(point.x),
    y = number(point.y);
  return x || y ? { x, y } : null;
}

function levelMarkersFor(
  frames: Data[],
  participantId: number,
  snapshots: TimelineSnapshot[],
) {
  const eventMarkers: LevelMarker[] = frames
    .flatMap((frame) => list(frame.events).map(data))
    .filter(
      (event) =>
        text(event.type) === "LEVEL_UP" && number(event.participantId) === participantId,
    )
    .map((event) => ({
      level: number(event.level),
      timestamp: number(event.timestamp),
      precision: "event" as const,
    }));
  return [2, 3, 4, 6].flatMap<LevelMarker>((level) => {
    const exact = eventMarkers.find((marker) => marker.level === level);
    if (exact) return [exact];
    const snapshot = snapshots.find((value) => value.level >= level);
    return snapshot
      ? [{ level, timestamp: snapshot.timestamp, precision: "frame" as const }]
      : [];
  });
}

function normalizeReportEvent(
  event: Data,
  byId: Map<number, TimelineRosterPlayer>,
  linked: TimelineRosterPlayer | undefined,
): TimelineEvent[] {
  const timestamp = number(event.timestamp),
    type = text(event.type),
    killerId = number(event.killerId),
    victimId = number(event.victimId);
  if (timestamp < 0 || !linked) return [];
  const actor = byId.get(killerId || number(event.participantId));
  const side = actor ? (actor.teamId === linked.teamId ? "ally" : "enemy") : "neutral";
  if (type === "CHAMPION_KILL") {
    const assists = list(event.assistingParticipantIds).filter(
      (id): id is number => typeof id === "number",
    );
    if (killerId === linked.participantId || assists.includes(linked.participantId))
      return [
        { timestamp, kind: "takedown", side, championName: linked.championName || null },
      ];
    if (victimId === linked.participantId)
      return [
        { timestamp, kind: "death", side, championName: linked.championName || null },
      ];
  }
  if (type === "ELITE_MONSTER_KILL")
    return [
      { timestamp, kind: "monster", side, championName: actor?.championName || null },
    ];
  if (type === "BUILDING_KILL") {
    const kind =
      text(event.buildingType) === "INHIBITOR_BUILDING"
        ? "inhibitor"
        : text(event.buildingType) === "TOWER_BUILDING"
          ? "tower"
          : null;
    if (kind) {
      const destroyedTeam = number(event.teamId);
      const buildingSide = destroyedTeam
        ? destroyedTeam === linked.teamId
          ? "enemy"
          : "ally"
        : "neutral";
      return [
        {
          timestamp,
          kind,
          side: actor ? side : buildingSide,
          championName: actor?.championName || null,
        },
      ];
    }
  }
  return [];
}

export function plausibleMatch(match: unknown, puuid: string, observedStartedAt: Date) {
  const info = data(data(match).info);
  const participant = list(info.participants)
    .map(data)
    .find((value) => text(value.puuid) === puuid);
  const start = number(info.gameStartTimestamp);
  const supported =
    number(info.mapId) === 11 &&
    [400, 420, 430, 440, 490].includes(number(info.queueId)) &&
    text(info.gameMode) === "CLASSIC";
  return participant &&
    supported &&
    Math.abs(start - observedStartedAt.getTime()) <= 300_000
    ? { info, participant }
    : null;
}
import { levelProgress } from "@/features/reports/domain/player-economy";
