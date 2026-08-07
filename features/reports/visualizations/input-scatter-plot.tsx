"use client";

import * as d3 from "d3";
import { useMemo, useRef, useState, type FocusEvent, type PointerEvent } from "react";
import { formatTime } from "@/features/reports/visualizations/data";
import type { InputScatterPoint } from "@/features/reports/visualizations/types";

const width = 800;
const height = 400;
const margin = { top: 86, right: 120, bottom: 55, left: 105 };

function scale(values: number[], range: [number, number]) {
  const [minimum, maximum] = d3.extent([0, ...values]) as [number, number];
  return d3.scaleLinear().domain(minimum === maximum ? [minimum - 1, maximum + 1] : [minimum, maximum]).nice().range(range);
}

export function InputScatterPlot({ points, previewTime, onHoverTime, onScrubTime }: { points: InputScatterPoint[]; previewTime: number; onHoverTime: (time: number | null) => void; onScrubTime: (time: number) => void }) {
  const plotRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: InputScatterPoint } | null>(null);
  const x = scale(points.map(point => point.apm), [margin.left, width - margin.right]);
  const y = scale(points.map(point => point.velocityCms), [height - margin.bottom, margin.top]);
  const actionDomain = x.domain() as [number, number], distanceDomain = y.domain() as [number, number];
  const actionBins = d3.bin<InputScatterPoint, number>().value(point => point.apm).domain(actionDomain).thresholds(x.ticks(16))(points);
  const distanceBins = d3.bin<InputScatterPoint, number>().value(point => point.velocityCms).domain(distanceDomain).thresholds(y.ticks(16))(points);
  const actionCount = scale(actionBins.map(bin => bin.length), [margin.top - 10, 12]);
  const distanceCount = scale(distanceBins.map(bin => bin.length), [width - margin.right + 10, width - 8]);
  const frame = useMemo(() => points.reduce((latest, point, index) => point.seconds <= previewTime ? index : latest, 0), [points, previewTime]);
  const trail = points.slice(0, frame + 1);

  const showTooltip = (event: PointerEvent<SVGCircleElement> | FocusEvent<SVGCircleElement>, point: InputScatterPoint) => {
    const bounds = plotRef.current?.getBoundingClientRect(), target = event.currentTarget.getBoundingClientRect();
    if (bounds) setTooltip({ x: ((target.left + target.width / 2 - bounds.left) / bounds.width) * 100, y: ((target.top - bounds.top) / bounds.height) * 100, point });
    onHoverTime(point.seconds); onScrubTime(point.seconds);
  };

  return <div className="report-chart input-scatter-chart">
    <svg ref={plotRef} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Input sample scatterplot with 3-second rolling Actions per minute on the horizontal axis, mouse velocity in centimeters per second on the vertical axis, and marginal distribution histograms">
      {x.ticks(6).map(value => <g key={value}><line className="chart-grid" x1={x(value)} x2={x(value)} y1={margin.top} y2={height - margin.bottom} /><text className="chart-label" x={x(value)} y={height - margin.bottom + 18} textAnchor="middle">{value.toLocaleString()}</text></g>)}
      {y.ticks(6).map(value => <g key={value}><line className="chart-grid" x1={margin.left} x2={width - margin.right} y1={y(value)} y2={y(value)} /><text className="chart-label" x={margin.left - 7} y={y(value) + 4} textAnchor="end">{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</text></g>)}
      {actionBins.map((bin, index) => <rect key={index} className="input-histogram actions" x={x(bin.x0 ?? 0)} y={actionCount(bin.length)} width={Math.max(1, x(bin.x1 ?? 0) - x(bin.x0 ?? 0) - 1)} height={margin.top - 10 - actionCount(bin.length)} />)}
      {distanceBins.map((bin, index) => <rect key={index} className="input-histogram distance" x={width - margin.right + 10} y={y(bin.x1 ?? 0)} width={distanceCount(bin.length) - (width - margin.right + 10)} height={Math.max(1, y(bin.x0 ?? 0) - y(bin.x1 ?? 0) - 1)} />)}
      {points.map((point, index) => <circle key={index} className="input-scatter-point" cx={x(point.apm)} cy={y(point.velocityCms)} r="2" tabIndex={0} aria-label={`${formatTime(point.seconds)}: ${point.apm.toFixed(1)} APM, ${point.velocityCms.toFixed(2)} cm/s`} onPointerEnter={event => showTooltip(event, point)} onPointerLeave={() => setTooltip(null)} onFocus={event => showTooltip(event, point)} onBlur={() => setTooltip(null)} />)}
      {trail.slice(1).map((point, index) => { const prior = trail[index], opacity = Math.max(.15, .95 * ((index + 1) / (trail.length - 1))); return <line key={point.seconds} className="input-scatter-trail" x1={x(prior.apm)} y1={y(prior.velocityCms)} x2={x(point.apm)} y2={y(point.velocityCms)} strokeOpacity={opacity} />; })}
      {trail.length > 0 && <circle className="input-scatter-current" cx={x(trail.at(-1)!.apm)} cy={y(trail.at(-1)!.velocityCms)} r="4" />}
      <text className="chart-axis-title" x={(margin.left + width - margin.right) / 2} y={height - 10} textAnchor="middle">3-second rolling APM</text>
      <text className="chart-axis-title" transform={`translate(16 ${(margin.top + height - margin.bottom) / 2}) rotate(-90)`} textAnchor="middle">Mouse velocity (cm/s)</text>
      <text className="chart-axis-title chart-axis-actions" x={margin.left} y="11">APM distribution</text>
      <text className="chart-axis-title chart-axis-distance" transform={`translate(${width - 13} ${(margin.top + height - margin.bottom) / 2}) rotate(-90)`} textAnchor="middle">Mouse velocity distribution</text>
    </svg>
    {tooltip && <aside className="chart-tooltip" style={{ left: `${Math.min(72, Math.max(1, tooltip.x))}%`, top: `${Math.min(72, Math.max(2, tooltip.y))}%` }}><b>{formatTime(tooltip.point.seconds)}</b><span>3-second rolling APM: {tooltip.point.apm.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span><span>Mouse velocity: {tooltip.point.velocityCms.toLocaleString(undefined, { maximumFractionDigits: 2 })} cm/s</span></aside>}
  </div>;
}
