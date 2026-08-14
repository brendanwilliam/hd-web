import type { TimelineEvent, TimelineSnapshot } from "@/features/reports/domain/reconciliation";

type Data = Record<string, unknown>;
const data = (value: unknown): Data => typeof value === "object" && value !== null ? value as Data : {};
const list = (value: unknown) => Array.isArray(value) ? value : [];
const number = (value: unknown) => typeof value === "number" ? value : 0;
const text = (value: unknown) => typeof value === "string" ? value : "";

export type TimelineBin = { timestamp: number; csPerMinute: number | null; goldPerMinute: number | null; leftClicks: number | null; rightClicks: number | null; gameplayKeys: number | null; meanVelocity: number | null; peakVelocity: number | null };
export type ReportTimelineView = { gameVersion: string; playerChampion: string; events: TimelineEvent[]; bins: TimelineBin[]; inputAvailable: boolean; gameAvailable: boolean };
type Detail = { second: number; kind: string };

export function createReportTimelineView(report: { durationMs: number; riotEvents: unknown; payload: unknown; inputEvents: Detail[] }): ReportTimelineView {
  const timeline = data(report.riotEvents);
  const snapshots = list(timeline.snapshots).map(snapshot).filter((item): item is TimelineSnapshot => item !== null);
  const events = list(timeline.events).map(event).filter((item): item is TimelineEvent => item !== null);
  const roster = list(timeline.roster).map(data);
  const playerChampion = text(roster.find(player => player.isLinkedPlayer === true)?.championName);
  const input = data(data(report.payload).input);
  const intensity = list(input.intensity_by_second).map(data).map(value => ({ second: number(value.second), velocity: number(value.mouse_velocity) }));
  const inputAvailable = report.inputEvents.length > 0;
  const gameAvailable = snapshots.length > 1;
  const end = Math.max(report.durationMs, ...snapshots.map(item => item.timestamp), ...intensity.map(item => item.second * 1_000), 0);
  return { gameVersion: text(timeline.gameVersion), playerChampion, events, inputAvailable, gameAvailable, bins: buildBins(end, snapshots, report.inputEvents, intensity, inputAvailable) };
}

function snapshot(value: unknown): TimelineSnapshot | null {
  const item = data(value), timestamp = number(item.timestamp);
  return timestamp >= 0 ? { timestamp, totalGold: number(item.totalGold), laneCs: number(item.laneCs), jungleCs: number(item.jungleCs) } : null;
}

function event(value: unknown): TimelineEvent | null {
  const item = data(value), kind = text(item.kind);
  if (!["takedown", "death", "monster", "tower", "inhibitor"].includes(kind)) return null;
  const side = text(item.side);
  return { timestamp: number(item.timestamp), kind: kind as TimelineEvent["kind"], side: side === "ally" || side === "enemy" ? side : "neutral", championName: text(item.championName) || null };
}

function buildBins(end: number, snapshots: TimelineSnapshot[], details: Detail[], intensity: { second: number; velocity: number }[], inputAvailable: boolean) {
  const bins: TimelineBin[] = [];
  for (let start = 0; start <= end; start += 30_000) {
    const current = [...snapshots].reverse().find(item => item.timestamp >= start && item.timestamp < start + 30_000);
    const previous = current ? [...snapshots].reverse().find(item => item.timestamp < current.timestamp) : undefined;
    const elapsed = current && previous ? current.timestamp - previous.timestamp : 0;
    const rates = current && previous && elapsed > 0 ? { cs: ((current.laneCs + current.jungleCs - previous.laneCs - previous.jungleCs) * 60_000) / elapsed, gold: ((current.totalGold - previous.totalGold) * 60_000) / elapsed } : null;
    const actions = details.filter(item => item.second * 1_000 >= start && item.second * 1_000 < start + 30_000);
    const velocities = intensity.filter(item => item.second * 1_000 >= start && item.second * 1_000 < start + 30_000).map(item => item.velocity);
    bins.push({ timestamp: start,
      csPerMinute: rates?.cs ?? null,
      goldPerMinute: rates?.gold ?? null,
      leftClicks: inputAvailable ? actions.filter(item => item.kind === "left_click").length * 2 : null,
      rightClicks: inputAvailable ? actions.filter(item => item.kind === "right_click").length * 2 : null,
      gameplayKeys: inputAvailable ? actions.filter(item => item.kind === "gameplay_key").length * 2 : null,
      meanVelocity: velocities.length ? velocities.reduce((sum, value) => sum + value, 0) / velocities.length : null,
      peakVelocity: velocities.length ? Math.max(...velocities) : null,
    });
  }
  return bins;
}
