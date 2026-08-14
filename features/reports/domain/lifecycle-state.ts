import {
  predictedRespawnAtMs,
  selectLifecycleRules,
  type PlayerDeathInterval,
} from "@/features/reports/domain/lifecycle-rules";
import type {
  DragonElement,
  ObjectiveLifecycle,
} from "@/features/reports/domain/lifecycle-rules";

type Player = { participantId: number; teamId: number; level: number };
type Kill = { timestamp: number; victimId: number };

export function deathIntervals(gameVersion: string, players: Player[], kills: Kill[]) {
  const selected = selectLifecycleRules(gameVersion);
  if (!selected.rules) return [] as PlayerDeathInterval[];
  const byId = new Map(players.map((player) => [player.participantId, player]));
  return kills.flatMap((kill) => {
    const player = byId.get(kill.victimId);
    const respawn =
      player && predictedRespawnAtMs(kill.timestamp, player.level, selected.rules);
    return player && respawn !== null
      ? [
          {
            participantId: player.participantId,
            teamId: player.teamId,
            diedAtMs: kill.timestamp,
            predictedRespawnAtMs: respawn,
            endedAtMs: respawn,
            precision: "rule_predicted" as const,
            availability: "available" as const,
            confidence: "rule_predicted" as const,
          },
        ]
      : [];
  });
}

export function aliveAdvantage(
  intervals: PlayerDeathInterval[],
  players: Player[],
  atMs: number,
) {
  const alive = new Map<number, number>();
  for (const player of players)
    alive.set(player.teamId, (alive.get(player.teamId) ?? 0) + 1);
  for (const interval of intervals)
    if (
      atMs >= interval.diedAtMs &&
      interval.endedAtMs !== null &&
      atMs < interval.endedAtMs
    )
      alive.set(interval.teamId, (alive.get(interval.teamId) ?? 1) - 1);
  const counts = [...alive.entries()].map(([teamId, count]) => ({ teamId, count }));
  return {
    counts,
    advantage: counts.length === 2 ? counts[0].count - counts[1].count : null,
  };
}

type ObjectiveKill = {
  timestamp: number;
  kind: ObjectiveLifecycle["kind"];
  subtype?: DragonElement;
  killerTeamId: number | null;
};

export function objectiveLifetimes(gameVersion: string, kills: ObjectiveKill[]) {
  const selected = selectLifecycleRules(gameVersion);
  if (!selected.rules || !selected.applicableRulePatch) return [] as ObjectiveLifecycle[];
  const order = new Map<string, number>();
  return kills.map((kill) => {
    const rule = selected.rules.objectives[kill.kind];
    const count = (order.get(kill.kind) ?? 0) + 1;
    order.set(kill.kind, count);
    return {
      kind: kill.kind,
      subtype: kill.subtype ?? null,
      gameOrder: kill.kind === "elemental_dragon" ? count : null,
      expectedSpawnAtMs: count === 1 ? rule.initialSpawnAtMs : null,
      observedSpawnAtMs: null,
      slainAtMs: kill.timestamp,
      slainByTeamId: kill.killerTeamId,
      respawnAtMs: rule.respawnAfterMs ? kill.timestamp + rule.respawnAfterMs : null,
      despawnAtMs: null,
      endReason: "slain" as const,
      applicableRulePatch: selected.applicableRulePatch,
      precision: "event" as const,
      availability: "available" as const,
      confidence: "observed" as const,
    };
  });
}

export function dragonState(kills: ObjectiveKill[], atMs: number) {
  const stacks = new Map<number, number>();
  let element: DragonElement | null = null;
  for (const kill of kills.filter(
    (item) => item.kind === "elemental_dragon" && item.timestamp <= atMs,
  )) {
    if (kill.killerTeamId !== null)
      stacks.set(kill.killerTeamId, (stacks.get(kill.killerTeamId) ?? 0) + 1);
    if ((stacks.get(kill.killerTeamId ?? -1) ?? 0) >= 3)
      element = kill.subtype ?? element;
  }
  return [...stacks].map(([teamId, count]) => ({
    teamId,
    stacks: count,
    hasSoul: count >= 4,
    soulElement: count >= 4 ? element : null,
    establishedRiftElement: element,
  }));
}
