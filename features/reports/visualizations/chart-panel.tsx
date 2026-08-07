"use client";

import { useMemo, useState } from "react";
import { reportSeriesGroups } from "@/features/reports/visualizations/data";
import { ComparisonChart } from "@/features/reports/visualizations/comparison-chart";
import type { ReportData, VisualizationGroup, VisualizationMode } from "@/features/reports/visualizations/types";

export function ChartPanel({ payload, group, duration, onHoverTime }: { payload: ReportData; group: VisualizationGroup; duration: number; onHoverTime: (time: number | null) => void }) {
  const [mode, setMode] = useState<VisualizationMode>("cumulative");
  const definition = useMemo(() => reportSeriesGroups(payload, mode).find(item => item.key === group)!, [group, mode, payload]);
  const [enabled, setEnabled] = useState<Set<string> | null>(null);
  const active = definition.series.filter(series => enabled === null || enabled.has(series.key));

  return <section className="report-panel report-chart-panel">
    <div className="report-panel-heading"><div><p className="eyebrow">MATCH DATA</p><h2>{definition.label}</h2></div><div className="report-controls"><label>{definition.label} view <select value={mode} onChange={event => setMode(event.target.value as VisualizationMode)} aria-label={`${definition.label} chart view`}><option value="cumulative">Cumulative</option><option value="rate">Velocity</option><option value="acceleration">Acceleration</option></select></label></div></div>
    <div className="report-legend" aria-label={`${definition.label} series`}>
      {definition.series.map(item => <button key={item.key} className={enabled === null || enabled.has(item.key) ? "active" : ""} aria-pressed={enabled === null || enabled.has(item.key)} onClick={() => setEnabled(previous => { const next = new Set(previous ?? definition.series.map(value => value.key)); next.has(item.key) ? next.delete(item.key) : next.add(item.key); return next; })}><i style={{ background: item.color }} />{item.label}</button>)}
    </div>
    {active.length ? <ComparisonChart active={active} mode={mode} duration={duration} label={definition.label} onHoverTime={onHoverTime} /> : <p className="report-note">Select a series to compare recorded data.</p>}
    <p className="report-note">{definition.description} Each series is independently normalized to 0–100; exact sample intervals are used without interpolation.</p>
  </section>;
}
