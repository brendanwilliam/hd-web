"use client";

import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState, type FocusEvent, type PointerEvent } from "react";
import {
  formatTime,
  nearestPoint,
  normalizedPoints,
  numberValue,
  reportSeries,
  timelineEvents,
} from "@/features/reports/visualizations/data";
import type {
  ChartSeries,
  ReportData,
  TimelineEvent,
  TimelineEventKind,
  VisualizationMode,
} from "@/features/reports/visualizations/types";

const width = 800;
const chartHeight = 340;
const margin = { top: 20, right: 24, bottom: 0, left: 190 };
const timelineRows: [TimelineEventKind, string][] = [
  ["kills", "Player kills"],
  ["deaths", "Deaths"],
  ["levels", "Levels"],
  ["items", "Item transactions"],
  ["enemy_structures", "Enemy structures destroyed"],
  ["team_structures", "Team structures destroyed"],
  ["objectives", "Neutral objectives"],
];

function eventTooltip(event: TimelineEvent) {
  if (event.event.kind === "level_up") {
    const ability = typeof event.event.ability === "string" ? event.event.ability : "Ability point";
    const rank = typeof event.event.ability_rank === "number" ? ` rank ${event.event.ability_rank}` : "";
    const skillAt = numberValue(event.event.ability_level_up_seconds);
    const delay = numberValue(event.event.ability_level_up_delay_seconds);
    const difference = delay === null ? "unavailable" : delay === 0 ? "at the same time" : `${Math.abs(delay)}s ${delay > 0 ? "after" : "before"}`;
    return [formatTime(event.seconds), String(event.event.detail ?? "Level up"), `Champion level: ${formatTime(event.seconds)}`, `${ability}${rank}: ${skillAt === null ? "unavailable" : formatTime(skillAt)}`, `Difference: ${difference}`].join(" · ");
  }
  if (event.event.kind === "item_transaction") {
    const amount = numberValue(event.event.transaction_gold), spent = numberValue(event.event.gold_spent);
    return [formatTime(event.seconds), `${String(event.event.transaction ?? "Item")}: ${String(event.event.item_name ?? event.event.detail ?? "Unknown item")}`, `Item ID: ${String(event.event.item_id ?? "unavailable")}`, `Gold change: ${amount === null ? "unavailable" : amount.toLocaleString()}`, `Total spent: ${spent === null ? "unavailable" : spent.toLocaleString()}`].join(" · ");
  }
  if (event.event.kind === "objective" && Array.isArray(event.event.buff_holders)) {
    const holders = event.event.buff_holders.filter((holder): holder is Record<string, unknown> => !!holder && typeof holder === "object");
    return [formatTime(event.seconds), String(event.event.detail ?? "Objective"), `Secured by: ${event.event.objective_team === "team" ? "your team" : "enemy team"}`, `Buff active: ${formatTime(numberValue(event.event.buff_active_seconds) ?? 0)}`, ...holders.map(holder => `${String(holder.name)} (${String(holder.role)}): ${formatTime(numberValue(holder.duration_seconds) ?? 0)}`)].join(" · ");
  }
  if (event.event.kind === "player_kill" || event.event.kind === "player_death") {
    const timer = numberValue(event.event.death_timer_seconds), total = numberValue(event.event.cumulative_dead_seconds);
    return [formatTime(event.seconds), String(event.event.detail ?? "Champion kill"), `Death timer: ${timer === null ? "unavailable" : formatTime(timer)}`, `Cumulative time dead: ${total === null ? "unavailable" : formatTime(total)}`, "Timer is estimated from participant-frame positions."].join(" · ");
  }
  if (typeof event.event.structure_down_seconds === "number") return [formatTime(event.seconds), String(event.event.detail ?? "Inhibitor destroyed"), `Inhibitor down: ${formatTime(event.event.structure_down_seconds)}`].join(" · ");
  const description = String(event.event.detail ?? event.event.type ?? event.event.category ?? event.kind);
  const values = Object.entries(event.event)
    .filter(([key, value]) =>
      !["id", "seconds", "detail", "type", "category"].includes(key) &&
      value !== null && value !== undefined && value !== "",
    )
    .slice(0, 6)
    .map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`);
  return [formatTime(event.seconds), description, ...values].join(" · ");
}

function eventGroupTooltip(events: TimelineEvent[]) {
  if (events.length === 1) return eventTooltip(events[0]);
  const times = events.map(event => event.seconds);
  return `${events.length} events · ${formatTime(Math.min(...times))}–${formatTime(Math.max(...times))}\n${events.map(eventTooltip).join("\n")}`;
}

function groupNearbyEvents(events: TimelineEvent[], kind: TimelineEventKind, x: d3.ScaleLinear<number, number>) {
  return events
    .filter(event => event.kind === kind)
    .sort((first, second) => first.seconds - second.seconds)
    .reduce<{ seconds: number; events: TimelineEvent[] }[]>((groups, event) => {
      const last = groups[groups.length - 1];
      if (last && x(event.seconds) - x(last.events[last.events.length - 1].seconds) <= 12) {
        last.events.push(event);
        last.seconds = d3.mean(last.events, item => item.seconds) ?? event.seconds;
      } else {
        groups.push({ seconds: event.seconds, events: [event] });
      }
      return groups;
    }, []);
}

function ComparisonChart({ active, mode, duration, onHoverTime }: { active: ChartSeries[]; mode: VisualizationMode; duration: number; onHoverTime: (time: number | null) => void }) {
  const chartRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; time: number } | null>(null);
  const x = d3.scaleLinear().domain([0, duration]).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, 100]).range([chartHeight - margin.bottom, margin.top]);

  return (
    <div className="report-chart">
      <svg
        ref={chartRef}
        viewBox={`0 0 ${width} ${chartHeight}`}
        role="img"
        aria-label="Independently normalized match comparison chart"
        onPointerMove={event => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const offset = event.clientX - bounds.left;
          const time = x.invert((offset / bounds.width) * width);
          setTooltip({ x: offset, time });
          onHoverTime(time);
        }}
        onPointerLeave={() => { setTooltip(null); onHoverTime(null); }}
      >
        {d3.ticks(0, 100, 5).map(value => (
          <g key={value}>
            <line className="chart-grid" x1={margin.left} x2={width - margin.right} y1={y(value)} y2={y(value)} />
            <text className="chart-label" x={margin.left - 7} y={y(value) + 4} textAnchor="end">{value}%</text>
          </g>
        ))}
        {active.map(series => (
          <path
            key={series.key}
            className="chart-series"
            stroke={series.color}
            d={d3.line<{ x: number; normalized: number }>()
              .x(point => x(point.x))
              .y(point => y(point.normalized))
              .curve(series.step && mode === "cumulative" ? d3.curveStepAfter : d3.curveLinear)(normalizedPoints(series)) ?? ""}
          />
        ))}
        {mode === "cumulative" && active
          .filter(series => series.key === "gold_spent")
          .flatMap(normalizedPoints)
          .map((point, index) => (
            <circle key={index} className="purchase-dot" cx={x(point.x)} cy={y(point.normalized)} r="3" />
          ))}
        {tooltip && <line className="chart-cursor" x1={x(tooltip.time)} x2={x(tooltip.time)} y1={margin.top} y2={chartHeight} />}
      </svg>
      {tooltip && (
        <aside className="chart-tooltip" style={{ left: `${Math.min(76, Math.max(1, (tooltip.x / (chartRef.current?.clientWidth || width)) * 100))}%` }}>
          <b>{formatTime(tooltip.time)}</b>
          {active.map(series => {
            const point = nearestPoint(series, tooltip.time);
            return <span key={series.key}><i style={{ background: series.color }} />{series.label}: {point.y.toLocaleString(undefined, { maximumFractionDigits: 2 })}{series.unit} <small>{formatTime(point.x)}</small></span>;
          })}
        </aside>
      )}
    </div>
  );
}

function EventTimeline({ events, duration, hoverTime }: { events: TimelineEvent[]; duration: number; hoverTime: number | null }) {
  const timelineRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const timelineHeight = timelineRows.length * 33 + 32;
  const x = d3.scaleLinear().domain([0, duration]).range([margin.left, width - margin.right]);
  const groups = timelineRows.flatMap(([kind], row) => groupNearbyEvents(events, kind, x).map(group => ({ ...group, kind, row })));
  const cursorTooltips = hoverTime === null ? [] : groups.filter(group => Math.abs(x(group.seconds) - x(hoverTime)) <= (group.events.length > 1 ? 10 : 6)).map(group => ({ x: (x(group.seconds) / width) * 100, y: group.row * 33 + 14, content: eventGroupTooltip(group.events) }));
  const showTooltip = (event: PointerEvent<SVGGElement> | FocusEvent<SVGGElement>, group: TimelineEvent[]) => {
    const bounds = timelineRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const target = event.currentTarget.getBoundingClientRect();
    setTooltip({ x: ((target.left + target.width / 2 - bounds.left) / bounds.width) * 100, y: target.top - bounds.top, content: eventGroupTooltip(group) });
  };

  return (
    <div className="event-timeline">
      <svg ref={timelineRef} viewBox={`0 0 ${width} ${timelineHeight}`} role="img" aria-label="Match events aligned to the comparison chart game-time axis">
        {hoverTime !== null && <line className="chart-cursor" x1={x(hoverTime)} x2={x(hoverTime)} y1="0" y2={timelineHeight - 27} />}
        {timelineRows.map(([kind, label], row) => (
          <g key={kind}>
            <text className="chart-label" x={margin.left - 7} y={row * 33 + 18} textAnchor="end">{label}</text>
            <line className="chart-grid" x1={margin.left} x2={width - margin.right} y1={row * 33 + 14} y2={row * 33 + 14} />
            {events.filter(event => event.kind === kind && event.endSeconds).map((event, index) => (
              <rect key={`range-${index}`} className={`event-range ${String(event.event.objective_team ?? "")}`} x={x(event.seconds)} y={row * 33 + 9} width={Math.max(2, x(event.endSeconds!) - x(event.seconds))} height="10" />
            ))}
            {groups.filter(group => group.kind === kind).map((group, index) => (
              <g key={index} className="event-group" tabIndex={0} aria-label={eventGroupTooltip(group.events)} onPointerEnter={event => showTooltip(event, group.events)} onPointerLeave={() => setTooltip(null)} onFocus={event => showTooltip(event, group.events)} onBlur={() => setTooltip(null)}>
                <circle className={`event-dot ${kind} ${String(group.events[0].event.objective_team ?? "")}`} cx={x(group.seconds)} cy={row * 33 + 14} r={group.events.length > 1 ? 10 : 6} />
                {kind === "levels" && group.events.length === 1 && typeof group.events[0].event.ability === "string" && <text className="event-ability" x={x(group.seconds)} y={row * 33 + 5} textAnchor="middle">{group.events[0].event.ability}</text>}
                {group.events.length > 1 && <text className="event-group-count" x={x(group.seconds)} y={row * 33 + 17.5} textAnchor="middle">{group.events.length}</text>}
              </g>
            ))}
          </g>
        ))}
        {x.ticks(6).map(value => (
          <g key={value}>
            <line className="chart-grid" x1={x(value)} x2={x(value)} y1="0" y2={timelineHeight - 27} />
            <text className="chart-label" x={x(value)} y={timelineHeight - 8} textAnchor="middle">{formatTime(value)}</text>
          </g>
        ))}
      </svg>
      {(tooltip ? [tooltip] : cursorTooltips).map((item, index) => <aside key={`${item.content}-${index}`} className="event-tooltip" style={{ left: `${Math.min(78, Math.max(1, item.x))}%`, top: Math.max(0, item.y - 10) }}>{item.content}</aside>)}
    </div>
  );
}

export function ReportVisualizations({ payload }: { payload: ReportData }) {
  const [mode, setMode] = useState<VisualizationMode>("cumulative");
  const series = useMemo(() => reportSeries(payload, mode), [payload, mode]);
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set());
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const active = series.filter(series => !enabled.size || enabled.has(series.key));
  const events = useMemo(() => timelineEvents(payload), [payload]);
  const duration = Math.max(
    1,
    numberValue(payload.duration_seconds) ?? 0,
    ...active.flatMap(series => series.points.map(point => point.x)),
    ...events.map(event => event.seconds),
  );

  useEffect(() => {
    if (!enabled.size) setEnabled(new Set(series.map(series => series.key)));
  }, [series, enabled.size]);

  return (
    <section className="report-panel">
      <div className="report-controls">
        <label>View <select value={mode} onChange={event => setMode(event.target.value as VisualizationMode)}>
          <option value="cumulative">Cumulative</option>
          <option value="rate">Rate</option>
          <option value="acceleration">Acceleration</option>
        </select></label>
      </div>
      <div className="report-legend">
        {series.map(item => (
          <button
            key={item.key}
            className={enabled.has(item.key) || !enabled.size ? "active" : ""}
            onClick={() => setEnabled(previous => {
              const next = new Set<string>(previous.size ? previous : series.map(value => value.key));
              next.has(item.key) ? next.delete(item.key) : next.add(item.key);
              return next;
            })}
          >
            <i style={{ background: item.color }} />{item.label}
          </button>
        ))}
      </div>
      {active.length ? <ComparisonChart active={active} mode={mode} duration={duration} onHoverTime={setHoverTime} /> : <p className="report-note">Select a series to compare recorded data.</p>}
      <EventTimeline events={events} duration={duration} hoverTime={hoverTime} />
      <p className="report-note">Each series is independently normalized to 0–100. Rates and acceleration use exact sample intervals; no values are interpolated.</p>
    </section>
  );
}
