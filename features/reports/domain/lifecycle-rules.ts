export type GamePatch = { major: number; minor: number; patch: number };
export type SourcePrecision = "event" | "frame" | "rule_predicted";
export type Availability = "available" | "unavailable" | "unknown" | "truncated";
export type Confidence = "observed" | "rule_predicted" | "unknown";
export type ObjectiveKind = "elemental_dragon" | "elder_dragon" | "baron_nashor" | "rift_herald" | "voidgrubs";
export type DragonElement = "chemtech" | "cloud" | "hextech" | "infernal" | "mountain" | "ocean";

export type ObjectiveLifecycle = {
  kind: ObjectiveKind; subtype: DragonElement | null; gameOrder: number | null;
  expectedSpawnAtMs: number | null; observedSpawnAtMs: number | null;
  slainAtMs: number | null; slainByTeamId: number | null;
  respawnAtMs: number | null; despawnAtMs: number | null;
  endReason: "slain" | "despawned" | "replaced" | "game_end" | "unknown" | null;
  applicableRulePatch: string; precision: SourcePrecision; availability: Availability; confidence: Confidence;
};

export type PlayerDeathInterval = {
  participantId: number; teamId: number; diedAtMs: number; predictedRespawnAtMs: number | null;
  endedAtMs: number | null; precision: SourcePrecision; availability: Availability; confidence: Confidence;
};

export type TeamDragonState = {
  teamId: number; stacks: number; hasSoul: boolean; soulElement: DragonElement | null; establishedRiftElement: DragonElement | null;
  elderAspect: { grantedAtMs: number | null; expiresAtMs: number | null; recipientParticipantIds: number[]; availability: Availability };
};

export type ObjectiveRule = {
  initialSpawnAtMs: number | null; respawnAfterMs: number | null;
  despawnAtMs: number | null; despawnInCombatAtMs: number | null;
  replacement: "none" | "elder_after_dragon_soul";
};

export type LifecycleRules = {
  effectiveFromPatch: string; sourcePatch: string; championBaseRespawnMs: number[];
  objectives: Record<ObjectiveKind, ObjectiveRule>; dragonSequence: { initialDistinctCount: 3; soulStackCount: 4; elements: DragonElement[] };
  elderAspectDurationMs: number;
};

const minute = 60_000;
const currentObjectives: Record<ObjectiveKind, ObjectiveRule> = {
  elemental_dragon: { initialSpawnAtMs: 5 * minute, respawnAfterMs: 5 * minute, despawnAtMs: null, despawnInCombatAtMs: null, replacement: "elder_after_dragon_soul" },
  elder_dragon: { initialSpawnAtMs: null, respawnAfterMs: 6 * minute, despawnAtMs: null, despawnInCombatAtMs: null, replacement: "none" },
  baron_nashor: { initialSpawnAtMs: 20 * minute, respawnAfterMs: 6 * minute, despawnAtMs: null, despawnInCombatAtMs: null, replacement: "none" },
  rift_herald: { initialSpawnAtMs: 15 * minute, respawnAfterMs: null, despawnAtMs: 19 * minute + 45_000, despawnInCombatAtMs: 19 * minute + 55_000, replacement: "none" },
  voidgrubs: { initialSpawnAtMs: 8 * minute, respawnAfterMs: null, despawnAtMs: 14 * minute + 45_000, despawnInCombatAtMs: 14 * minute + 55_000, replacement: "none" },
};

const pre1416RespawnMs = [6_000, 6_000, 8_000, 8_000, 10_000, 12_000, 16_000, 21_000, 26_000, 32_500, 35_000, 37_500, 40_000, 42_500, 45_000, 47_500, 50_000, 52_500];
const currentRespawnMs = [10_000, 10_000, 12_000, 12_000, 14_000, 16_000, 20_000, 25_000, 28_000, 32_500, 35_000, 37_500, 40_000, 42_500, 45_000, 47_500, 50_000, 52_500];

export const LIFECYCLE_RULESETS: LifecycleRules[] = [
  { effectiveFromPatch: "0.0.0", sourcePatch: "14.15.0", championBaseRespawnMs: pre1416RespawnMs, objectives: currentObjectives, dragonSequence: { initialDistinctCount: 3, soulStackCount: 4, elements: ["chemtech", "cloud", "hextech", "infernal", "mountain", "ocean"] }, elderAspectDurationMs: 150_000 },
  { effectiveFromPatch: "14.16.0", sourcePatch: "26.15.0", championBaseRespawnMs: currentRespawnMs, objectives: currentObjectives, dragonSequence: { initialDistinctCount: 3, soulStackCount: 4, elements: ["chemtech", "cloud", "hextech", "infernal", "mountain", "ocean"] }, elderAspectDurationMs: 150_000 },
];

export function parseGamePatch(value: string): GamePatch | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\D.*)?$/.exec(value);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function compareGamePatches(left: GamePatch, right: GamePatch) {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

export function selectLifecycleRules(gameVersion: string, rulesets = LIFECYCLE_RULESETS) {
  const patch = parseGamePatch(gameVersion);
  if (!patch) return { availability: "unavailable" as const, rules: null, applicableRulePatch: null };
  const selected = [...rulesets].sort((left, right) => compareGamePatches(parseRequiredPatch(left.effectiveFromPatch), parseRequiredPatch(right.effectiveFromPatch)))
    .filter(rules => compareGamePatches(parseRequiredPatch(rules.effectiveFromPatch), patch) <= 0).at(-1);
  return selected ? { availability: "available" as const, rules: selected, applicableRulePatch: selected.effectiveFromPatch } : { availability: "unknown" as const, rules: null, applicableRulePatch: null };
}

export function predictedRespawnAtMs(diedAtMs: number, level: number, rules: LifecycleRules) {
  if (!Number.isInteger(level) || level < 1 || level > rules.championBaseRespawnMs.length) return null;
  const base = rules.championBaseRespawnMs[level - 1];
  return diedAtMs + Math.round(base * (1 + respawnTimeIncrease(diedAtMs)));
}

export function respawnTimeIncrease(diedAtMs: number) {
  const gameMinutes = diedAtMs / minute;
  if (gameMinutes < 15) return 0;
  if (gameMinutes < 30) return Math.ceil(2 * (gameMinutes - 15)) * 0.00425;
  if (gameMinutes < 45) return 0.1275 + Math.ceil(2 * (gameMinutes - 30)) * 0.003;
  return Math.min(0.5, 0.2175 + Math.ceil(2 * (gameMinutes - 45)) * 0.0145);
}

function parseRequiredPatch(value: string) {
  const parsed = parseGamePatch(value);
  if (!parsed) throw new Error(`Invalid lifecycle rules patch: ${value}`);
  return parsed;
}
