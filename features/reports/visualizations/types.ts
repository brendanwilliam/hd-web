export type ReportData = Record<string, unknown>;

export type VisualizationMode = "cumulative" | "rate" | "acceleration";

export type ChartPoint = {
  x: number;
  y: number;
};

export type ChartSeries = {
  key: string;
  label: string;
  color: string;
  points: ChartPoint[];
  step?: boolean;
  unit?: string;
};

export type VisualizationGroup = "input" | "economy" | "combat";

export type ChartSeriesGroup = {
  key: VisualizationGroup;
  label: string;
  description: string;
  series: ChartSeries[];
};

export type TimelineEventKind =
  | "kills"
  | "deaths"
  | "levels"
  | "items"
  | "enemy_structures"
  | "team_structures"
  | "objectives";

export type TimelineEvent = {
  event: ReportData;
  kind: TimelineEventKind;
  seconds: number;
  endSeconds?: number;
};
