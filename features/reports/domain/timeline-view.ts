import type {
  TimelineEvent,
  TimelineSnapshot,
} from "@/features/reports/domain/reconciliation";

type Data = Record<string, unknown>;
const data = (value: unknown): Data =>
  typeof value === "object" && value !== null ? (value as Data) : {};
const list = (value: unknown) => (Array.isArray(value) ? value : []);
const number = (value: unknown) => (typeof value === "number" ? value : 0);
const text = (value: unknown) => (typeof value === "string" ? value : "");

export type TimelineBin = {
  timestamp: number;
  csPerMinute: number | null;
  goldPerMinute: number | null;
  leftClicks: number | null;
  rightClicks: number | null;
  gameplayKeys: number | null;
  apm: number | null;
  peakApm: number | null;
  meanVelocity: number | null;
  peakVelocity: number | null;
};
export type ReportTimelineView = {
  gameVersion: string;
  playerChampion: string;
  events: TimelineEvent[];
  bins: TimelineBin[];
  inputAvailable: boolean;
  gameAvailable: boolean;
};
type Detail = { second: number; kind: string };
export type TimelineEventGroup = {
  timestamp: number;
  events: TimelineEvent[];
};

const eventGroupWindowMs = 6_000;

export function eventLane(event: TimelineEvent) {
  if (event.kind === "takedown" || event.kind === "death") return "combat";
  if (event.kind === "monster") return "objective";
  return "structure";
}

export function groupTimelineEvents(events: TimelineEvent[]): TimelineEventGroup[] {
  const groupsByLane = new Map<string, TimelineEventGroup[]>();
  const orderedEvents = [...events].sort(
    (first, second) => first.timestamp - second.timestamp,
  );
  for (const event of orderedEvents) {
    const lane = eventLane(event);
    const groups = groupsByLane.get(lane) ?? [];
    const previous = groups.at(-1);
    if (previous && event.timestamp - previous.timestamp <= eventGroupWindowMs) {
      previous.events.push(event);
    } else {
      groups.push({ timestamp: event.timestamp, events: [event] });
    }
    groupsByLane.set(lane, groups);
  }
  return [...groupsByLane.values()]
    .flat()
    .sort((first, second) => first.timestamp - second.timestamp);
}

export function createReportTimelineView(report: {
  durationMs: number;
  riotEvents: unknown;
  payload: unknown;
  inputEvents: Detail[];
}): ReportTimelineView {
  const timeline = data(report.riotEvents);
  const snapshots = list(timeline.snapshots)
    .map(snapshot)
    .filter((item): item is TimelineSnapshot => item !== null);
  const events = list(timeline.events)
    .map(event)
    .filter((item): item is TimelineEvent => item !== null);
  const roster = list(timeline.roster).map(data);
  const playerChampion = text(
    roster.find((player) => player.isLinkedPlayer === true)?.championName,
  );
  const input = data(data(report.payload).input);
  const intensity = list(input.intensity_by_second)
    .map(data)
    .map((value) => ({
      second: number(value.second),
      apm: typeof value.apm === "number" ? value.apm : null,
      velocity: number(value.mouse_velocity),
    }));
  const inputAvailable = report.inputEvents.length > 0;
  const gameAvailable = snapshots.length > 1;
  const end = Math.max(
    report.durationMs,
    ...snapshots.map((item) => item.timestamp),
    ...intensity.map((item) => item.second * 1_000),
    0,
  );
  return {
    gameVersion: text(timeline.gameVersion),
    playerChampion,
    events,
    inputAvailable,
    gameAvailable,
    bins: buildBins(end, snapshots, report.inputEvents, intensity, inputAvailable),
  };
}

function snapshot(value: unknown): TimelineSnapshot | null {
  const item = data(value),
    timestamp = number(item.timestamp);
  return timestamp >= 0
    ? {
        timestamp,
        totalGold: number(item.totalGold),
        laneCs: number(item.laneCs),
        jungleCs: number(item.jungleCs),
        currentGold: number(item.currentGold),
        level: number(item.level),
        totalXp: number(item.totalXp),
        position: null,
        precision: "frame",
        players: [],
      }
    : null;
}

function event(value: unknown): TimelineEvent | null {
  const item = data(value),
    kind = text(item.kind);
  if (!["takedown", "death", "monster", "tower", "inhibitor"].includes(kind)) return null;
  const side = text(item.side);
  return {
    timestamp: number(item.timestamp),
    kind: kind as TimelineEvent["kind"],
    side: side === "ally" || side === "enemy" ? side : "neutral",
    championName: text(item.championName) || null,
  };
}

function buildBins(
  end: number,
  snapshots: TimelineSnapshot[],
  details: Detail[],
  intensity: { second: number; apm: number | null; velocity: number }[],
  inputAvailable: boolean,
) {
  const bins: TimelineBin[] = [];
  let latestRates: { cs: number; gold: number } | null = null;
  for (let start = 0; start <= end; start += 30_000) {
    const current = [...snapshots]
      .reverse()
      .find((item) => item.timestamp <= start + 30_000);
    const previous = current
      ? [...snapshots].reverse().find((item) => item.timestamp < current.timestamp)
      : undefined;
    const elapsed = current && previous ? current.timestamp - previous.timestamp : 0;
    const observedRates =
      current && previous && elapsed > 0
        ? {
            cs:
              ((current.laneCs + current.jungleCs - previous.laneCs - previous.jungleCs) *
                60_000) /
              elapsed,
            gold: ((current.totalGold - previous.totalGold) * 60_000) / elapsed,
          }
        : null;
    latestRates = observedRates ?? latestRates;
    const actions = details.filter(
      (item) => item.second * 1_000 >= start && item.second * 1_000 < start + 30_000,
    );
    const velocities = intensity
      .filter(
        (item) => item.second * 1_000 >= start && item.second * 1_000 < start + 30_000,
      )
      .map((item) => item.velocity);
    const apm = intensity
      .filter(
        (item) => item.second * 1_000 >= start && item.second * 1_000 < start + 30_000,
      )
      .map((item) => item.apm)
      .filter((value): value is number => value !== null);
    bins.push({
      timestamp: start,
      csPerMinute: latestRates?.cs ?? null,
      goldPerMinute: latestRates?.gold ?? null,
      leftClicks: inputAvailable
        ? actions.filter((item) => item.kind === "left_click").length * 2
        : null,
      rightClicks: inputAvailable
        ? actions.filter((item) => item.kind === "right_click").length * 2
        : null,
      gameplayKeys: inputAvailable
        ? actions.filter((item) => item.kind === "gameplay_key").length * 2
        : null,
      apm: apm.length ? apm.reduce((sum, value) => sum + value, 0) / apm.length : null,
      peakApm: apm.length ? Math.max(...apm) : null,
      meanVelocity: velocities.length
        ? velocities.reduce((sum, value) => sum + value, 0) / velocities.length
        : null,
      peakVelocity: velocities.length ? Math.max(...velocities) : null,
    });
  }
  return bins;
}
