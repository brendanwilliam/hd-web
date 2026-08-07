"use client";

import * as d3 from "d3";
import { useRef, useState, type FocusEvent, type PointerEvent } from "react";
import { formatTime, numberValue } from "@/features/reports/visualizations/data";
import type { TimelineEvent, TimelineEventKind } from "@/features/reports/visualizations/types";

const width = 800;
const margin = { right: 24, left: 190 };
const rows: [TimelineEventKind, string][] = [["kills", "Player kills"], ["deaths", "Deaths"], ["levels", "Levels"], ["items", "Item transactions"], ["enemy_structures", "Enemy structures destroyed"], ["team_structures", "Team structures destroyed"], ["objectives", "Neutral objectives"]];

function eventTooltip(event: TimelineEvent) {
  if (event.event.kind === "level_up") {
    const ability = typeof event.event.ability === "string" ? event.event.ability : "Ability point", rank = typeof event.event.ability_rank === "number" ? ` rank ${event.event.ability_rank}` : "", skillAt = numberValue(event.event.ability_level_up_seconds), delay = numberValue(event.event.ability_level_up_delay_seconds), difference = delay === null ? "unavailable" : delay === 0 ? "at the same time" : `${Math.abs(delay)}s ${delay > 0 ? "after" : "before"}`;
    return [formatTime(event.seconds), String(event.event.detail ?? "Level up"), `Champion level: ${formatTime(event.seconds)}`, `${ability}${rank}: ${skillAt === null ? "unavailable" : formatTime(skillAt)}`, `Difference: ${difference}`].join(" · ");
  }
  if (event.event.kind === "item_transaction") { const amount = numberValue(event.event.transaction_gold), spent = numberValue(event.event.gold_spent); return [formatTime(event.seconds), `${String(event.event.transaction ?? "Item")}: ${String(event.event.item_name ?? event.event.detail ?? "Unknown item")}`, `Item ID: ${String(event.event.item_id ?? "unavailable")}`, `Gold change: ${amount === null ? "price unavailable" : amount.toLocaleString()}`, `Total spent: ${spent === null ? "unavailable" : spent.toLocaleString()}`].join(" · "); }
  if (event.event.kind === "objective" && Array.isArray(event.event.buff_holders)) { const holders = event.event.buff_holders.filter((holder): holder is Record<string, unknown> => !!holder && typeof holder === "object"); return [formatTime(event.seconds), String(event.event.detail ?? "Objective"), `Secured by: ${event.event.objective_team === "team" ? "your team" : "enemy team"}`, `Buff active: ${formatTime(numberValue(event.event.buff_active_seconds) ?? 0)}`, ...holders.map(holder => `${String(holder.name)} (${String(holder.role)}): ${formatTime(numberValue(holder.duration_seconds) ?? 0)}`)].join(" · "); }
  if (event.event.kind === "player_kill" || event.event.kind === "player_death") { const timer = numberValue(event.event.death_timer_seconds), total = numberValue(event.event.cumulative_dead_seconds); return [formatTime(event.seconds), String(event.event.detail ?? "Champion kill"), `Death timer: ${timer === null ? "unavailable" : formatTime(timer)}`, `Cumulative time dead: ${total === null ? "unavailable" : formatTime(total)}`, "Timer is estimated from participant-frame positions."].join(" · "); }
  if (typeof event.event.structure_down_seconds === "number") return [formatTime(event.seconds), String(event.event.detail ?? "Inhibitor destroyed"), `Inhibitor down: ${formatTime(event.event.structure_down_seconds)}`].join(" · ");
  const values = Object.entries(event.event).filter(([key, value]) => !["id", "seconds", "detail", "type", "category"].includes(key) && value !== null && value !== undefined && value !== "").slice(0, 6).map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`);
  return [formatTime(event.seconds), String(event.event.detail ?? event.event.type ?? event.event.category ?? event.kind), ...values].join(" · ");
}

function grouped(events: TimelineEvent[], kind: TimelineEventKind, x: d3.ScaleLinear<number, number>) {
  return events.filter(event => event.kind === kind).sort((first, second) => first.seconds - second.seconds).reduce<{ seconds: number; events: TimelineEvent[] }[]>((groups, event) => { const last = groups.at(-1); if (last && x(event.seconds) - x(last.events.at(-1)!.seconds) <= 12) { last.events.push(event); last.seconds = d3.mean(last.events, item => item.seconds) ?? event.seconds; } else groups.push({ seconds: event.seconds, events: [event] }); return groups; }, []);
}

export function EventTimeline({ events, duration, hoverTime }: { events: TimelineEvent[]; duration: number; hoverTime: number | null }) {
  const timelineRef = useRef<SVGSVGElement>(null), [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const height = rows.length * 33 + 32, x = d3.scaleLinear().domain([0, duration]).range([margin.left, width - margin.right]);
  const groups = rows.flatMap(([kind], row) => grouped(events, kind, x).map(group => ({ ...group, kind, row })));
  const tooltipFor = (events: TimelineEvent[]) => events.length === 1 ? eventTooltip(events[0]) : `${events.length} events · ${formatTime(Math.min(...events.map(event => event.seconds)))}–${formatTime(Math.max(...events.map(event => event.seconds)))}\n${events.map(eventTooltip).join("\n")}`;
  const cursorTooltips = hoverTime === null ? [] : groups.filter(group => Math.abs(x(group.seconds) - x(hoverTime)) <= (group.events.length > 1 ? 10 : 6)).map(group => ({ x: (x(group.seconds) / width) * 100, y: group.row * 33 + 14, content: tooltipFor(group.events) }));
  const showTooltip = (event: PointerEvent<SVGGElement> | FocusEvent<SVGGElement>, events: TimelineEvent[]) => { const bounds = timelineRef.current?.getBoundingClientRect(), target = event.currentTarget.getBoundingClientRect(); if (bounds) setTooltip({ x: ((target.left + target.width / 2 - bounds.left) / bounds.width) * 100, y: target.top - bounds.top, content: tooltipFor(events) }); };
  return <section className="report-panel event-timeline"><div className="report-panel-heading"><div><p className="eyebrow">MATCH DATA</p><h2>Event timeline</h2></div></div><svg ref={timelineRef} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Match events aligned to all chart game-time axes">
    {hoverTime !== null && <line className="chart-cursor" x1={x(hoverTime)} x2={x(hoverTime)} y1="0" y2={height - 27} />}
    {rows.map(([kind, label], row) => <g key={kind}><text className="chart-label" x={margin.left - 7} y={row * 33 + 18} textAnchor="end">{label}</text><line className="chart-grid" x1={margin.left} x2={width - margin.right} y1={row * 33 + 14} y2={row * 33 + 14} />
      {events.filter(event => event.kind === kind && event.endSeconds).map((event, index) => <rect key={`range-${index}`} className={`event-range ${String(event.event.objective_team ?? "")}`} x={x(event.seconds)} y={row * 33 + 9} width={Math.max(2, x(event.endSeconds!) - x(event.seconds))} height="10" />)}
      {groups.filter(group => group.kind === kind).map((group, index) => <g key={index} className="event-group" tabIndex={0} aria-label={tooltipFor(group.events)} onPointerEnter={event => showTooltip(event, group.events)} onPointerLeave={() => setTooltip(null)} onFocus={event => showTooltip(event, group.events)} onBlur={() => setTooltip(null)}><circle className={`event-dot ${kind} ${String(group.events[0].event.objective_team ?? "")}`} cx={x(group.seconds)} cy={row * 33 + 14} r={group.events.length > 1 ? 10 : 6} />{kind === "levels" && group.events.length === 1 && typeof group.events[0].event.ability === "string" && <text className="event-ability" x={x(group.seconds)} y={row * 33 + 5} textAnchor="middle">{group.events[0].event.ability}</text>}{group.events.length > 1 && <text className="event-group-count" x={x(group.seconds)} y={row * 33 + 17.5} textAnchor="middle">{group.events.length}</text>}</g>)}
    </g>)}
    {x.ticks(6).map(value => <g key={value}><line className="chart-grid" x1={x(value)} x2={x(value)} y1="0" y2={height - 27} /><text className="chart-label" x={x(value)} y={height - 8} textAnchor="middle">{formatTime(value)}</text></g>)}
  </svg>{(tooltip ? [tooltip] : cursorTooltips).map((item, index) => <aside key={`${item.content}-${index}`} className="event-tooltip" style={{ left: `${Math.min(78, Math.max(1, item.x))}%`, top: Math.max(0, item.y - 10) }}>{item.content}</aside>)}</section>;
}
