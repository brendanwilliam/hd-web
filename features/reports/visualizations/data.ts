import type {
  ChartPoint,
  ChartSeries,
  ReportData,
  TimelineEvent,
  TimelineEventKind,
  VisualizationMode,
} from "@/features/reports/visualizations/types";

const colors = ["#d9b45a", "#72b8ef", "#e87878", "#9ad17b", "#ad8ce5", "#f08ac3", "#58cfca", "#e69755"];

export const numberValue = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const dataItems = (value: unknown): ReportData[] =>
  Array.isArray(value)
    ? value.filter((item): item is ReportData => !!item && typeof item === "object")
    : [];

export const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

function recordedValues(values: ReportData[], key: string): ChartPoint[] {
  return values.flatMap(value => {
    const x = numberValue(value.seconds);
    const y = numberValue(value[key]);
    return x === null || y === null ? [] : [{ x, y }];
  });
}

function cumulativeValues(values: ReportData[], key: string): ChartPoint[] {
  let total = 0;
  return values.flatMap(value => {
    const x = numberValue(value.seconds);
    const delta = numberValue(value[key]);
    if (x === null || delta === null) return [];
    total += delta;
    return [{ x, y: total }];
  });
}

function applyMode(source: ChartPoint[], mode: VisualizationMode, multiplier = 1): ChartPoint[] {
  if (mode === "cumulative") return source;
  const rates = source.slice(1).flatMap((point, index) => {
    const prior = source[index];
    const elapsed = point.x - prior.x;
    return elapsed > 0 ? [{ x: point.x, y: ((point.y - prior.y) / elapsed) * multiplier }] : [];
  });
  if (mode === "rate") return rates;
  return rates.slice(1).flatMap((point, index) => {
    const elapsed = point.x - rates[index].x;
    return elapsed > 0 ? [{ x: point.x, y: (point.y - rates[index].y) / elapsed }] : [];
  });
}

export function reportSeries(payload: ReportData, mode: VisualizationMode): ChartSeries[] {
  const timeline = dataItems(payload.timeline_samples).length
    ? dataItems(payload.timeline_samples)
    : dataItems(payload.samples).map(sample => ({
        seconds: sample.seconds,
        gold_earned: sample.estimated_gold ?? sample.gold,
      }));
  const input = dataItems(payload.input_samples);
  const timelineSeries: [string, string, boolean?][] = [
    ["gold_earned", "Gold earned"],
    ["experience", "Experience"],
    ["gold_spent", "Gold spent", true],
    ["unspent_gold", "Unspent gold", true],
    ["damage_to_enemy_champions", "Champion damage"],
    ["damage_to_objectives", "Objective damage"],
  ];
  return [
    ...timelineSeries.map(([key, label, step], index) => ({
      key,
      label,
      step,
      color: colors[index],
      points: applyMode(recordedValues(timeline, key), mode),
    })),
    {
      key: "actions",
      label: "Actions",
      color: colors[6],
      unit: mode === "cumulative" ? "" : " APM",
      points: applyMode(cumulativeValues(input, "actions"), mode, 60),
    },
    {
      key: "distance",
      label: "Mouse distance",
      color: colors[7],
      unit: mode === "cumulative" ? " px" : " px/s",
      points: applyMode(cumulativeValues(input, "mouse_distance_pixels"), mode),
    },
  ].filter(series => series.points.length);
}

function eventKind(event: ReportData): TimelineEventKind | null {
  const kind = String(event.kind ?? "");
  if (kind === "player_kill") return "kills";
  if (kind === "player_death") return "deaths";
  if (["skill_level", "level_up"].includes(kind)) return "levels";
  if (kind === "item_transaction") return "items";
  if (kind === "team_structure") return "team_structures";
  if (kind === "enemy_structure") return "enemy_structures";
  if (["objective", "objective_buff"].includes(kind)) return "objectives";
  const value = `${event.type ?? ""} ${event.category ?? ""} ${event.detail ?? ""}`.toLowerCase();
  if (value.includes("level")) return "levels";
  if (value.includes("item")) return "items";
  if (/tower|turret|building/.test(value)) return "team_structures";
  if (/dragon|baron|herald|voidgrub|scuttler|objective/.test(value)) return "objectives";
  if (value.includes("kill")) return event.actor === "enemy" || event.victim === "player" ? "deaths" : "kills";
  return null;
}

export function timelineEvents(payload: ReportData): TimelineEvent[] {
  const source = dataItems(payload.timeline_events).length
    ? dataItems(payload.timeline_events)
    : dataItems(payload.events);
  return source.flatMap(event => {
    const kind = eventKind(event);
    const seconds = numberValue(event.seconds);
    const endSeconds = numberValue(event.end_seconds);
    return kind && seconds !== null ? [{ event, kind, seconds, ...(endSeconds !== null && endSeconds > seconds ? { endSeconds } : {}) }] : [];
  });
}

export function normalizedPoints(series: ChartSeries) {
  const values = series.points.map(point => point.y);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  return series.points.map(point => ({
    ...point,
    normalized: minimum === maximum ? 50 : ((point.y - minimum) * 100) / (maximum - minimum),
  }));
}

export function nearestPoint(series: ChartSeries, time: number) {
  return series.points.reduce((best, point) =>
    Math.abs(point.x - time) < Math.abs(best.x - time) ? point : best,
  );
}
