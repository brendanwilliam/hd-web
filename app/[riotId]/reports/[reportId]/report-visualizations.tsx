"use client";

import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";

type Data = Record<string, unknown>;
type Mode = "cumulative" | "rate" | "acceleration";
type Point = { x: number; y: number };
type Series = { key: string; label: string; color: string; points: Point[]; step?: boolean; unit?: string };
const colors = ["#d9b45a", "#72b8ef", "#e87878", "#9ad17b", "#ad8ce5", "#58cfca", "#e69755"];
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const items = (value: unknown) => Array.isArray(value) ? value.filter((x): x is Data => !!x && typeof x === "object") : [];
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
function recorded(values: Data[], key: string) { return values.flatMap(value => { const x = number(value.seconds), y = number(value[key]); return x === null || y === null ? [] : [{ x, y }]; }); }
function cumulative(values: Data[], key: string) { let total = 0; return values.flatMap(value => { const x = number(value.seconds), delta = number(value[key]); if (x === null || delta === null) return []; total += delta; return [{ x, y: total }]; }); }
function derivative(source: Point[], mode: Mode, multiplier = 1) {
  if (mode === "cumulative") return source;
  const rates = source.slice(1).flatMap((point, index) => { const prior = source[index], elapsed = point.x - prior.x; return elapsed > 0 ? [{ x: point.x, y: (point.y - prior.y) / elapsed * multiplier }] : []; });
  if (mode === "rate") return rates;
  return rates.slice(1).flatMap((point, index) => { const elapsed = point.x - rates[index].x; return elapsed > 0 ? [{ x: point.x, y: (point.y - rates[index].y) / elapsed }] : []; });
}
function reportSeries(payload: Data, mode: Mode): Series[] {
  const timeline = items(payload.timeline_samples).length ? items(payload.timeline_samples) : items(payload.samples).map(sample => ({ seconds: sample.seconds, gold_earned: sample.estimated_gold ?? sample.gold }));
  const input = items(payload.input_samples);
  const timelines: [string, string, boolean?][] = [["gold_earned", "Gold earned"], ["experience", "Experience"], ["gold_spent", "Gold spent", true], ["damage_to_enemy_champions", "Champion damage"], ["damage_to_objectives", "Objective damage"]];
  return [...timelines.map(([key, label, step], index) => ({ key, label, step, color: colors[index], points: derivative(recorded(timeline, key), mode) })), { key: "actions", label: "Actions", color: colors[5], unit: mode === "cumulative" ? "" : " APM", points: derivative(cumulative(input, "actions"), mode, 60) }, { key: "distance", label: "Mouse distance", color: colors[6], unit: mode === "cumulative" ? " px" : " px/s", points: derivative(cumulative(input, "mouse_distance_pixels"), mode) }].filter(series => series.points.length);
}
function strip(event: Data) { const value = `${event.type ?? ""} ${event.category ?? ""} ${event.detail ?? ""}`.toLowerCase(); if (value.includes("level")) return "levels"; if (value.includes("item")) return "items"; if (/tower|turret|building/.test(value)) return "structures"; if (/dragon|baron|herald|voidgrub|scuttler|objective/.test(value)) return "objectives"; if (value.includes("kill")) return event.actor === "enemy" || event.victim === "player" ? "deaths" : "kills"; return null; }

export function MouseDwellHeatmap({ payload, compact = false }: { payload: Data; compact?: boolean }) {
  const bins = items(payload.hexbins), geometry = payload.mouse_geometry as Data | undefined;
  const aspect = number(payload.frame_aspect_ratio) ?? ((number(geometry?.frame_width) ?? 16) / (number(geometry?.frame_height) ?? 9));
  const recordedRadius = number(payload.hex_radius_percent), hexWidth = recordedRadius === null ? number(geometry?.hex_width_percent) ?? 2 : Math.sqrt(3) * recordedRadius;
  const hexRadius = hexWidth / Math.sqrt(3), heatmapHeight = 100 / Math.max(.01, aspect);
  const totalDwell = d3.sum(bins, bin => number(bin.dwell_ms) ?? 0);
  const maxDwell = Math.max(1, d3.max(bins, bin => number(bin.dwell_ms) ?? 0) ?? 1);
  if (!bins.length) return compact ? null : <p className="report-note">Mouse dwell-time data was not recorded for this report.</p>;
  return <div className={compact ? "report-heatmap report-heatmap-compact" : "report-heatmap"}>
    <svg viewBox={`0 0 100 ${heatmapHeight}`} role="img" aria-label="Mouse dwell time in the recorded game frame">
      {bins.map((bin, index) => {
        const row = number(bin.row) ?? 0, column = number(bin.column) ?? 0, dwell = number(bin.dwell_ms) ?? 0;
        const cx = hexWidth * (column + (row & 1 ? .5 : 0)), cy = hexRadius * (1 + 1.5 * row);
        const points = Array.from({ length: 6 }, (_, corner) => `${cx + hexRadius * Math.cos((30 + corner * 60) * Math.PI / 180)},${cy + hexRadius * Math.sin((30 + corner * 60) * Math.PI / 180)}`).join(" ");
        const dwellPercent = totalDwell ? dwell / totalDwell * 100 : 0;
        return <polygon key={index} points={points} fill={`hsl(${190 - 130 * dwell / maxDwell} 76% ${37 + 31 * dwell / maxDwell}%)`} tabIndex={0}>
          <title>{`${(dwell / 1000).toFixed(2)}s dwell · ${dwellPercent.toFixed(1)}% of recorded dwell · ${cx.toFixed(1)}%, ${(cy / heatmapHeight * 100).toFixed(1)}% of game frame`}</title>
        </polygon>;
      })}
    </svg>
  </div>;
}

function eventTooltip(event: Data, seconds: number, kind: string) {
  const description = String(event.detail ?? event.type ?? event.category ?? kind);
  const values = Object.entries(event).filter(([key, value]) => !["id", "seconds", "detail", "type", "category"].includes(key) && value !== null && value !== undefined && value !== "").slice(0, 3).map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`);
  return [formatTime(seconds), description, ...values].join(" · ");
}

export function ReportVisualizations({ payload }: { payload: Data }) {
  const [mode, setMode] = useState<Mode>("cumulative");
  const series = useMemo(() => reportSeries(payload, mode), [payload, mode]);
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set());
  const active = series.filter(item => !enabled.size || enabled.has(item.key));
  const chartRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; time: number } | null>(null);
  useEffect(() => { if (!enabled.size) setEnabled(new Set(series.map(item => item.key))); }, [series, enabled.size]);
  const width = 800, height = 340, margin = { top: 20, right: 24, bottom: 12, left: 46 };
  const allPoints = active.flatMap(item => item.points);
  const eventItems = (items(payload.timeline_events).length ? items(payload.timeline_events) : items(payload.events)).map(event => ({ event, kind: strip(event), seconds: number(event.seconds) })).filter((entry): entry is { event: Data; kind: string; seconds: number } => !!entry.kind && entry.seconds !== null);
  const duration = Math.max(1, number(payload.duration_seconds) ?? 0, ...allPoints.map(point => point.x), ...eventItems.map(item => item.seconds));
  const x = d3.scaleLinear().domain([0, duration]).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, 100]).range([height - margin.bottom, margin.top]);
  const normalized = (item: Series) => { const extent = d3.extent(item.points, point => point.y) as [number, number]; return item.points.map(point => ({ ...point, normalized: extent[0] === extent[1] ? 50 : (point.y - extent[0]) * 100 / (extent[1] - extent[0]) })); };
  const nearest = (item: Series, time: number) => item.points.reduce((best, point) => Math.abs(point.x - time) < Math.abs(best.x - time) ? point : best);
  const strips = [["kills", "Player kills"], ["deaths", "Deaths"], ["levels", "Levels"], ["items", "Purchases / completed items"], ["structures", "All structures"], ["objectives", "Neutral objectives"]] as const;
  const timelineHeight = strips.length * 33 + 32;
  return <>
    <section className="report-panel"><div className="report-heading"><div><p className="eyebrow">RECORDED HISTORIES</p><h2>Match comparison</h2></div><label>View <select value={mode} onChange={event => setMode(event.target.value as Mode)}><option value="cumulative">Cumulative</option><option value="rate">Rate</option><option value="acceleration">Acceleration</option></select></label></div><div className="report-legend">{series.map(item => <button key={item.key} className={enabled.has(item.key) || !enabled.size ? "active" : ""} onClick={() => setEnabled(previous => { const next = new Set(previous.size ? previous : series.map(value => value.key)); next.has(item.key) ? next.delete(item.key) : next.add(item.key); return next; })}><i style={{ background: item.color }} />{item.label}</button>)}</div>{active.length ? <div className="report-chart"><svg ref={chartRef} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Independently normalized match comparison chart" onPointerMove={event => { const bounds = event.currentTarget.getBoundingClientRect(); setTooltip({ x: event.clientX - bounds.left, time: x.invert((event.clientX - bounds.left) / bounds.width * width) }); }} onPointerLeave={() => setTooltip(null)}>{d3.ticks(0, 100, 5).map(value => <g key={value}><line className="chart-grid" x1={margin.left} x2={width - margin.right} y1={y(value)} y2={y(value)} /><text className="chart-label" x={margin.left - 7} y={y(value) + 4} textAnchor="end">{value}%</text></g>)}{active.map(item => <path key={item.key} className="chart-series" stroke={item.color} d={d3.line<{ x: number; normalized: number }>().x(point => x(point.x)).y(point => y(point.normalized)).curve(item.step && mode === "cumulative" ? d3.curveStepAfter : d3.curveLinear)(normalized(item)) ?? ""} />)}{mode === "cumulative" && active.filter(item => item.key === "gold_spent").flatMap(item => normalized(item)).map((point, index) => <circle key={index} className="purchase-dot" cx={x(point.x)} cy={y(point.normalized)} r="3" />)}{tooltip && <line className="chart-cursor" x1={x(tooltip.time)} x2={x(tooltip.time)} y1={margin.top} y2={height - margin.bottom} />}</svg>{tooltip && <aside className="chart-tooltip" style={{ left: `${Math.min(76, Math.max(1, tooltip.x / (chartRef.current?.clientWidth || width) * 100))}%` }}><b>{formatTime(tooltip.time)}</b>{active.map(item => { const point = nearest(item, tooltip.time); return <span key={item.key}><i style={{ background: item.color }} />{item.label}: {point.y.toLocaleString(undefined, { maximumFractionDigits: 2 })}{item.unit} <small>{formatTime(point.x)}</small></span>; })}</aside>}</div> : <p className="report-note">Select a series to compare recorded data.</p>}<div className="event-timeline"><p className="eyebrow">MATCH TIME</p><h2>Event timeline</h2><svg viewBox={`0 0 ${width} ${timelineHeight}`} role="img" aria-label="Match events aligned to the comparison chart game-time axis">{strips.map(([kind, label], row) => <g key={kind}><text className="chart-label" x={margin.left - 7} y={row * 33 + 18} textAnchor="end">{label}</text><line className="chart-grid" x1={margin.left} x2={width - margin.right} y1={row * 33 + 14} y2={row * 33 + 14} />{eventItems.filter(item => item.kind === kind).map((item, index) => <circle className={`event-dot ${kind}`} key={index} cx={x(item.seconds)} cy={row * 33 + 14} r="6"><title>{eventTooltip(item.event, item.seconds, kind)}</title></circle>)}</g>)}{x.ticks(6).map(value => <g key={value}><line className="chart-grid" x1={x(value)} x2={x(value)} y1="0" y2={timelineHeight - 27} /><text className="chart-label" x={x(value)} y={timelineHeight - 8} textAnchor="middle">{formatTime(value)}</text></g>)}</svg></div><p className="report-note">Each series is independently normalized to 0–100. Rates and acceleration use exact sample intervals; no values are interpolated.</p></section>
  </>;
}
