import type {
  ChartPoint,
  ChartSeries,
  ChartSeriesGroup,
  InputScatterPoint,
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

function applyMode(source: ChartPoint[], mode: VisualizationMode, perMinute = false): ChartPoint[] {
  if (mode === "cumulative") return source;
  const multiplier = perMinute ? 60 : 1;
  const rates = source.slice(1).flatMap((point, index) => {
    const prior = source[index];
    const elapsed = point.x - prior.x;
    return elapsed > 0 ? [{ x: point.x, y: ((point.y - prior.y) / elapsed) * multiplier }] : [];
  });
  if (mode === "rate") return rates;
  return rates.slice(1).flatMap((point, index) => {
    const elapsed = point.x - rates[index].x;
    return elapsed > 0 ? [{ x: point.x, y: ((point.y - rates[index].y) / elapsed) * multiplier }] : [];
  });
}

function unit(mode: VisualizationMode, cumulative: string, velocity: string, acceleration: string) {
  return mode === "cumulative" ? cumulative : mode === "rate" ? velocity : acceleration;
}

function timeline(payload: ReportData) {
  return dataItems(payload.timeline_samples).length
    ? dataItems(payload.timeline_samples)
    : dataItems(payload.samples).map(sample => ({
        seconds: sample.seconds,
        gold_earned: sample.estimated_gold ?? sample.gold,
      }));
}

function timelineSeries(values: ReportData[], mode: VisualizationMode, definitions: [string, string, string, boolean?][], offset = 0): ChartSeries[] {
  return definitions.map(([key, label, seriesUnit, step], index) => ({
    key,
    label,
    step,
    color: colors[index + offset],
    unit: unit(mode, ` ${seriesUnit}`, ` ${seriesUnit}/min`, ` ${seriesUnit}/min²`),
    points: applyMode(recordedValues(values, key), mode, true),
  })).filter(series => series.points.length);
}

export function reportSeriesGroups(payload: ReportData, mode: VisualizationMode): ChartSeriesGroup[] {
  const samples = timeline(payload);
  const input = dataItems(payload.input_samples);
  const totalGoldEarned = Math.max(0, ...recordedValues(samples, "gold_earned").map(point => point.y));
  const goldNormalization = totalGoldEarned > 0 ? { minimum: 0, maximum: totalGoldEarned } : undefined;
  return [
    {
      key: "input",
      label: "Input",
      description: "Each point pairs a 3-second rolling Actions-per-minute value with mouse velocity in cm/s. The top and right histograms show their individual distributions.",
      series: [
        {
          key: "actions",
          label: "Actions",
          color: colors[6],
          unit: unit(mode, " actions", " APM", " APM/s"),
          points: applyMode(cumulativeValues(input, "actions"), mode, true),
        },
        {
          key: "distance",
          label: "Mouse distance",
          color: colors[7],
          unit: unit(mode, " px", " px/s", " px/s²"),
          points: applyMode(cumulativeValues(input, "mouse_distance_pixels"), mode),
        },
      ].filter(series => series.points.length),
    },
    {
      key: "economy",
      label: "Economy",
      description: "Gold earned, spent, and unspent share the player's total earned gold scale. Velocity and Acceleration are measured per minute and per minute².",
      series: timelineSeries(samples, mode, [
        ["gold_earned", "Gold earned", "gold"],
        ["gold_spent", "Gold spent", "gold", true],
        ["unspent_gold", "Unspent gold", "gold", true],
        ["experience", "Experience", "XP"],
        ["cs", "CS", "CS"],
      ]).map(series => ["gold_earned", "gold_spent", "unspent_gold"].includes(series.key) && mode === "cumulative" ? { ...series, normalization: goldNormalization } : series),
    },
    {
      key: "combat",
      label: "Combat",
      description: "Velocity and Acceleration are measured per minute and per minute².",
      series: timelineSeries(samples, mode, [
        ["damage_to_enemy_champions", "Champion damage", "damage"],
        ["damage_to_objectives", "Objective damage", "damage"],
      ], 4),
    },
  ];
}

export function reportSeries(payload: ReportData, mode: VisualizationMode): ChartSeries[] {
  return reportSeriesGroups(payload, mode).flatMap(group => group.series);
}

export function inputScatterPoints(payload: ReportData): InputScatterPoint[] {
  const dpi = Math.max(1, numberValue(payload.dpi) ?? 800);
  const samples = dataItems(payload.input_samples).flatMap(sample => {
    const seconds = numberValue(sample.seconds), actions = numberValue(sample.actions), distance = numberValue(sample.mouse_distance_pixels);
    return seconds === null || actions === null || distance === null ? [] : [{ seconds, actions, distance }];
  }).sort((first, second) => first.seconds - second.seconds);
  return samples.slice(1).flatMap((sample, index) => {
    const prior = samples[index], elapsed = sample.seconds - prior.seconds;
    if (elapsed <= 0) return [];
    const window = samples.filter(candidate => candidate.seconds >= sample.seconds - 3 && candidate.seconds <= sample.seconds);
    const windowElapsed = sample.seconds - window[0].seconds;
    if (windowElapsed <= 0) return [];
    return [{ seconds: sample.seconds, apm: (window.reduce((total, candidate) => total + candidate.actions, 0) / windowElapsed) * 60, velocityCms: (sample.distance / elapsed) * 2.54 / dpi }];
  });
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
  const minimum = series.normalization?.minimum ?? Math.min(...values);
  const maximum = series.normalization?.maximum ?? Math.max(...values);
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
