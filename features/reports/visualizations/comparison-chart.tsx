"use client";

import * as d3 from "d3";
import { useRef, useState } from "react";
import { formatTime, nearestPoint, normalizedPoints } from "@/features/reports/visualizations/data";
import type { ChartSeries, VisualizationMode } from "@/features/reports/visualizations/types";

const width = 800;
const height = 340;
const margin = { top: 20, right: 24, bottom: 0, left: 190 };

export function ComparisonChart({ active, mode, duration, label, onHoverTime }: { active: ChartSeries[]; mode: VisualizationMode; duration: number; label: string; onHoverTime: (time: number | null) => void }) {
  const chartRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; time: number } | null>(null);
  const x = d3.scaleLinear().domain([0, duration]).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, 100]).range([height - margin.bottom, margin.top]);
  const path = (series: ChartSeries) => d3.line<{ x: number; normalized: number }>()
    .x(point => x(point.x)).y(point => y(point.normalized))
    .curve(series.step && mode === "cumulative" ? d3.curveStepAfter : d3.curveLinear)(normalizedPoints(series)) ?? "";

  return <div className="report-chart">
    <svg ref={chartRef} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} independently normalized match chart`}
      onPointerMove={event => {
        const bounds = event.currentTarget.getBoundingClientRect(), offset = event.clientX - bounds.left;
        const time = x.invert((offset / bounds.width) * width);
        setTooltip({ x: offset, time }); onHoverTime(time);
      }} onPointerLeave={() => { setTooltip(null); onHoverTime(null); }}>
      {d3.ticks(0, 100, 5).map(value => <g key={value}><line className="chart-grid" x1={margin.left} x2={width - margin.right} y1={y(value)} y2={y(value)} /><text className="chart-label" x={margin.left - 7} y={y(value) + 4} textAnchor="end">{value}%</text></g>)}
      {active.map(series => <path key={series.key} className="chart-series" stroke={series.color} d={path(series)} />)}
      {mode === "cumulative" && active.filter(series => series.key === "gold_spent").flatMap(normalizedPoints).map((point, index) => <circle key={index} className="purchase-dot" cx={x(point.x)} cy={y(point.normalized)} r="3" />)}
      {tooltip && <line className="chart-cursor" x1={x(tooltip.time)} x2={x(tooltip.time)} y1={margin.top} y2={height} />}
    </svg>
    {tooltip && <aside className="chart-tooltip" style={{ left: `${Math.min(76, Math.max(1, (tooltip.x / (chartRef.current?.clientWidth || width)) * 100))}%` }}><b>{formatTime(tooltip.time)}</b>{active.map(series => { const point = nearestPoint(series, tooltip.time); return <span key={series.key}><i style={{ background: series.color }} />{series.label}: {point.y.toLocaleString(undefined, { maximumFractionDigits: 2 })}{series.unit} <small>{formatTime(point.x)}</small></span>; })}</aside>}
  </div>;
}
