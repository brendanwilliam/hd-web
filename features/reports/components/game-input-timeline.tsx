"use client";

import { brushX, line, scaleLinear, select } from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  championAssetUrls,
  nextChampionAssetUrl,
  RIOT_ATTRIBUTION,
} from "@/features/reports/domain/data-dragon";
import {
  eventLane,
  groupTimelineEvents,
  type ReportTimelineView,
  type TimelineEventGroup,
} from "@/features/reports/domain/timeline-view";
import { usePlaybackCursor } from "./playback-cursor";

const COLORS = {
  ally: "#58cfca",
  enemy: "#e87878",
  neutral: "#d9b45a",
  gold: "#d9b45a",
  cs: "#72b8ef",
  left: "#58cfca",
  right: "#9ad17b",
  key: "#ad8ce5",
  velocity: "#e69755",
};
const labels = {
  takedown: "Takedown",
  death: "Death",
  monster: "Neutral monster",
  tower: "Tower",
  inhibitor: "Inhibitor",
};
const eventEmoji = {
  takedown: "⚔️",
  death: "💀",
  monster: "🐉",
  tower: "🏰",
  inhibitor: "💎",
};
const laneLabels = {
  combat: "KILLS / DEATHS",
  objective: "EPIC MONSTERS",
  structure: "STRUCTURES",
};
const laneY = { combat: 42, objective: 68, structure: 94 };
const minorGridIntervalMs = 60_000;
const majorGridIntervalMs = 5 * 60_000;
const time = (value: number) =>
  `${Math.floor(value / 60_000)}:${Math.floor((value / 1_000) % 60)
    .toString()
    .padStart(2, "0")}`;
const valid = (value: number | null): value is number =>
  value !== null && Number.isFinite(value);

export default function GameInputTimeline({ model }: { model: ReportTimelineView }) {
  const { cursorMs: hover, seek: setHover } = usePlaybackCursor();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [enabled, setEnabled] = useState(new Set(Object.keys(labels)));
  const [domain, setDomain] = useState<[number, number] | null>(null);
  const brushRef = useRef<SVGGElement>(null);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(320, entry.contentRect.width)),
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const outer = Math.round(width),
    margin = { left: 54, right: 54, top: 20, bottom: 38 },
    inner = outer - margin.left - margin.right,
    height = 474;
  const full: [number, number] = [
    0,
    Math.max(...model.bins.map((bin) => bin.timestamp), 30_000),
  ];
  const activeDomain = domain ?? full;
  const x = useMemo(
    () =>
      scaleLinear()
        .domain(activeDomain)
        .range([margin.left, margin.left + inner]),
    [activeDomain, inner, margin.left],
  );
  useEffect(() => {
    if (!brushRef.current) return;
    const brush = brushX<unknown>()
      .extent([
        [margin.left, 394],
        [margin.left + inner, 410],
      ])
      .on("end", ({ selection }: { selection: [number, number] | null }) => {
        if (!selection) return setDomain(null);
        const next: [number, number] = [x.invert(selection[0]), x.invert(selection[1])];
        if (next[1] - next[0] > (activeDomain[1] - activeDomain[0]) * 0.03)
          setDomain(next);
      });
    select<SVGGElement, unknown>(brushRef.current).call(brush);
  }, [activeDomain, inner, margin.left, x]);
  const bins = model.bins.filter(
    (bin) => bin.timestamp >= activeDomain[0] && bin.timestamp <= activeDomain[1],
  );
  const events = model.events.filter(
    (event) =>
      event.timestamp >= activeDomain[0] &&
      event.timestamp <= activeDomain[1] &&
      enabled.has(event.kind),
  );
  const eventGroups = groupTimelineEvents(events);
  const timeTicks = minuteTicks(activeDomain);
  const selected =
    hover === null
      ? null
      : model.bins.reduce(
          (near, bin) =>
            Math.abs(bin.timestamp - hover) < Math.abs(near.timestamp - hover)
              ? bin
              : near,
          model.bins[0],
        );
  const cursorTimestamp = selected?.timestamp ?? hover;
  const cursorX = cursorTimestamp === null ? null : x(cursorTimestamp);
  const cursorLabelX =
    cursorX === null
      ? null
      : Math.max(margin.left + 23, Math.min(margin.left + inner - 23, cursorX));
  const linePath = (
    values: (number | null)[],
    top: number,
    rowHeight: number,
    color: string,
    dashed = false,
  ) => {
    const finite = values.filter(valid);
    if (!finite.length) return null;
    const y = scaleLinear()
      .domain([0, Math.max(...finite) || 1])
      .range([top + rowHeight, top]);
    return (
      <path
        d={
          line<number | null>()
            .defined(valid)
            .x((_, index) => x(bins[index].timestamp))
            .y((value) => y(value as number))(values) ?? undefined
        }
        stroke={color}
        className={dashed ? "unified-line dashed" : "unified-line"}
      />
    );
  };
  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHover(x.invert(((event.clientX - rect.left) * outer) / rect.width));
  };
  const toggle = (kind: string) =>
    setEnabled((current) => {
      const next = new Set(current);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });
  return (
    <section
      className="unified-timeline"
      ref={ref}
      aria-describedby="timeline-equivalent"
    >
      <div className="report-panel-heading">
        <div>
          <p className="eyebrow">POST-GAME TIMELINE</p>
          <h2>Game and input activity</h2>
        </div>
        {domain ? (
          <button type="button" onClick={() => setDomain(null)}>
            Clear zoom
          </button>
        ) : null}
      </div>
      <div className="timeline-legend" aria-label="Event filters">
        {Object.entries(labels).map(([kind, label]) => (
          <button
            type="button"
            key={kind}
            aria-pressed={enabled.has(kind)}
            onClick={() => toggle(kind)}
          >
            <i style={{ background: kind === "death" ? COLORS.enemy : COLORS.ally }} />
            {eventEmoji[kind as keyof typeof eventEmoji]} {label}
          </button>
        ))}
      </div>
      {!model.gameAvailable ? (
        <p role="status">Game-state snapshots are unavailable for this matched report.</p>
      ) : null}
      {!model.inputAvailable ? (
        <p role="status">
          Detailed input action timeline unavailable for this legacy report. Mouse
          velocity and APM remain available.
        </p>
      ) : null}
      <svg
        viewBox={`0 0 ${outer} ${height}`}
        role="img"
        aria-label="Synchronized game event, game-state, and input timeline"
        onPointerMove={onMove}
      >
        <text x={margin.left} y="14" className="timeline-label">
          GAME EVENTS
        </text>
        {timeTicks.map((tick) => (
          <line
            key={tick}
            x1={x(tick)}
            x2={x(tick)}
            y1="20"
            y2="370"
            className={
              tick % majorGridIntervalMs === 0
                ? "timeline-time-grid major"
                : "timeline-time-grid"
            }
          />
        ))}
        <line
          x1={margin.left}
          x2={margin.left + inner}
          y1="105"
          y2="105"
          className="timeline-grid"
        />
        {Object.entries(laneLabels).map(([lane, label]) => (
          <text
            key={lane}
            x={margin.left}
            y={laneY[lane as keyof typeof laneY] - 13}
            className="timeline-lane-label"
          >
            {label}
          </text>
        ))}
        {eventGroups.map((group, index) => (
          <EventGroup
            key={`${group.timestamp}-${index}`}
            group={group}
            x={x(group.timestamp)}
            version={model.gameVersion}
          />
        ))}
        <text x={margin.left} y="128" className="timeline-label">
          CS/MIN · GOLD/MIN
        </text>
        <DualYAxis
          left={{
            label: "CS/min",
            color: COLORS.cs,
            values: bins.map((bin) => bin.csPerMinute),
            activeValue: selected?.csPerMinute ?? null,
          }}
          right={{
            label: "Gold/min",
            color: COLORS.gold,
            values: bins.map((bin) => bin.goldPerMinute),
            activeValue: selected?.goldPerMinute ?? null,
          }}
          leftX={margin.left}
          rightX={margin.left + inner}
          top={136}
          height={94}
        />
        {linePath(
          bins.map((bin) => bin.csPerMinute),
          136,
          94,
          COLORS.cs,
        )}
        {linePath(
          bins.map((bin) => bin.goldPerMinute),
          136,
          94,
          COLORS.gold,
        )}
        <text x={margin.left} y="252" className="timeline-label">
          INPUT APM · MOUSE VELOCITY
        </text>
        <DualYAxis
          left={{
            label: "APM",
            color: COLORS.left,
            values: bins.map(actionsPerMinute),
            activeValue: selected ? actionsPerMinute(selected) : null,
          }}
          right={{
            label: "Velocity px/s",
            color: COLORS.velocity,
            values: bins.map((bin) => bin.meanVelocity),
            activeValue: selected?.meanVelocity ?? null,
          }}
          leftX={margin.left}
          rightX={margin.left + inner}
          top={260}
          height={110}
        />
        {linePath(
          bins.map(actionsPerMinute),
          260,
          110,
          COLORS.left,
        )}
        {linePath(
          bins.map((bin) => bin.peakApm),
          260,
          110,
          COLORS.left,
          true,
        )}
        {linePath(
          bins.map((bin) => bin.meanVelocity),
          260,
          110,
          COLORS.velocity,
        )}
        {linePath(
          bins.map((bin) => bin.peakVelocity),
          260,
          110,
          COLORS.velocity,
          true,
        )}
        {cursorX !== null && cursorLabelX !== null ? (
          <>
            <line
              x1={cursorX}
              x2={cursorX}
              y1="20"
              y2="370"
              className="timeline-cursor"
            />
            <g
              transform={`translate(${cursorLabelX},20)`}
              className="timeline-cursor-time"
            >
              <rect x="-23" y="-12" width="46" height="17" rx="3" />
              <text textAnchor="middle" y="0">
                {time(cursorTimestamp)}
              </text>
            </g>
            {selected ? (
              <ChartHoverValues
                bin={selected}
                bins={bins}
                x={cursorX}
                leftX={margin.left}
                rightX={margin.left + inner}
              />
            ) : null}
          </>
        ) : null}
        <rect
          x={margin.left}
          y="394"
          width={inner}
          height="16"
          className="timeline-brush"
          opacity=".45"
        />
        <g ref={brushRef} />
        {timeTicks
          .filter((tick) => tick % majorGridIntervalMs === 0)
          .map((tick) => (
          <text
            key={tick}
            x={x(tick)}
            y="388"
            textAnchor="middle"
            className="timeline-tick-label"
          >
            {time(tick)}
          </text>
          ))}
        <text x={margin.left} y="434" className="timeline-axis-title">
          GAME TIME (MM:SS)
        </text>
        <text
          x={margin.left + inner}
          y="434"
          textAnchor="end"
          className="timeline-axis-title"
        >
          {time(activeDomain[0])}–{time(activeDomain[1])}
        </text>
        <text x={margin.left} y="452" className="timeline-label">
          Drag the gold strip to zoom
        </text>
      </svg>
      {selected ? (
        <div className="timeline-tooltip" role="status">
          <b>{time(selected.timestamp)}</b>
          <span>
            CS/min {format(selected.csPerMinute)} · Gold/min{" "}
            {format(selected.goldPerMinute)}
          </span>
          <span>
            Left {format(selected.leftClicks)} · Right {format(selected.rightClicks)} ·
            Keys {format(selected.gameplayKeys)}
          </span>
          <span>
            Mouse velocity mean {format(selected.meanVelocity)} · peak{" "}
            {format(selected.peakVelocity)}
          </span>
          <span>{nearby(model.events, selected.timestamp)}</span>
        </div>
      ) : null}
      <p id="timeline-equivalent" className="report-note">
        Rates use actual Riot frame elapsed time. Ally and enemy are relative to your
        team; no player names are shown.
      </p>
      <p className="riot-attribution">{RIOT_ATTRIBUTION}</p>
    </section>
  );
}

function EventGroup({
  group,
  x,
  version,
}: {
  group: TimelineEventGroup;
  x: number;
  version: string;
}) {
  const lane = eventLane(group.events[0]);
  const offsets = groupedOffsets(group.events.length);
  const label = group.events
    .map((event) => `${labels[event.kind]} (${event.side})`)
    .join(", ");
  return (
    <g transform={`translate(${x},${laneY[lane]})`} className="timeline-event">
      {group.events.map((event, index) => (
        <g
          key={`${event.timestamp}-${index}`}
          transform={`translate(${offsets[index]},0)`}
        >
          <circle r="11" fill={COLORS[event.side]} />
          {event.championName ? (
            <ChampionMarker version={version} champion={event.championName} />
          ) : null}
          <text
            x="0"
            y="0"
            textAnchor="middle"
            dominantBaseline="central"
            className="timeline-event-emoji"
          >
            {eventEmoji[event.kind]}
          </text>
        </g>
      ))}
      {group.events.length > 1 ? (
        <g transform={`translate(${offsets.at(-1)! + 12},-12)`}>
          <circle r="8" className="timeline-event-count-background" />
          <text textAnchor="middle" dy="4" className="timeline-event-count">
            {group.events.length}
          </text>
        </g>
      ) : null}
      <title>{`${time(group.timestamp)} · ${label}`}</title>
    </g>
  );
}

function groupedOffsets(count: number) {
  return Array.from({ length: count }, (_, index) => (index - (count - 1) / 2) * 9);
}

function minuteTicks(domain: [number, number]) {
  const first = Math.ceil(domain[0] / minorGridIntervalMs) * minorGridIntervalMs;
  const count = Math.floor((domain[1] - first) / minorGridIntervalMs) + 1;
  return count > 0
    ? Array.from({ length: count }, (_, index) => first + index * minorGridIntervalMs)
    : [];
}

function ChampionMarker({ version, champion }: { version: string; champion: string }) {
  const urls = championAssetUrls(version, champion);
  const [src, setSrc] = useState(urls.primary ?? urls.fallback);
  if (!src) return null;
  return (
    <image
      href={src}
      width="20"
      height="20"
      x="-10"
      y="-10"
      onError={() => setSrc(nextChampionAssetUrl(urls, src))}
    />
  );
}

function ChartHoverValues({
  bin,
  bins,
  x,
  leftX,
  rightX,
}: {
  bin: ReportTimelineView["bins"][number];
  bins: ReportTimelineView["bins"];
  x: number;
  leftX: number;
  rightX: number;
}) {
  const csY = valueY(
    bins.map((item) => item.csPerMinute),
    bin.csPerMinute,
    136,
    94,
  );
  const goldY = valueY(
    bins.map((item) => item.goldPerMinute),
    bin.goldPerMinute,
    136,
    94,
  );
  const velocityY = valueY(
    bins.map((item) => item.meanVelocity),
    bin.meanVelocity,
    260,
    110,
  );
  const apm = actionsPerMinute(bin);
  const apmY = valueY(bins.map(actionsPerMinute), apm, 260, 110);
  return (
    <g className="timeline-hover-values">
      {csY === null ? null : (
        <line x1={leftX} x2={rightX} y1={csY} y2={csY} stroke={COLORS.cs} />
      )}
      {goldY === null ? null : (
        <line x1={leftX} x2={rightX} y1={goldY} y2={goldY} stroke={COLORS.gold} />
      )}
      {apmY === null ? null : (
        <line x1={leftX} x2={rightX} y1={apmY} y2={apmY} stroke={COLORS.left} />
      )}
      {velocityY === null ? null : (
        <line
          x1={leftX}
          x2={rightX}
          y1={velocityY}
          y2={velocityY}
          stroke={COLORS.velocity}
        />
      )}
      {csY === null ? null : <circle cx={x} cy={csY} r="3" fill={COLORS.cs} />}
      {goldY === null ? null : <circle cx={x} cy={goldY} r="3" fill={COLORS.gold} />}
      {apmY === null ? null : <circle cx={x} cy={apmY} r="3" fill={COLORS.left} />}
      {velocityY === null ? null : (
        <circle cx={x} cy={velocityY} r="3" fill={COLORS.velocity} />
      )}
    </g>
  );
}

function DualYAxis({
  left,
  right,
  leftX,
  rightX,
  top,
  height,
}: {
  left: AxisSeries;
  right: AxisSeries;
  leftX: number;
  rightX: number;
  top: number;
  height: number;
}) {
  const center = top + height / 2;
  return (
    <g className="timeline-y-axis">
      <AxisSide series={left} x={leftX} top={top} height={height} side="left" />
      <AxisSide series={right} x={rightX} top={top} height={height} side="right" />
      <line x1={leftX} x2={rightX} y1={center} y2={center} className="timeline-y-grid" />
    </g>
  );
}

type AxisSeries = {
  label: string;
  color: string;
  values: (number | null)[];
  activeValue: number | null;
};

function AxisSide({
  series,
  x,
  top,
  height,
  side,
}: {
  series: AxisSeries;
  x: number;
  top: number;
  height: number;
  side: "left" | "right";
}) {
  const max = seriesMax(series.values);
  const activeY = valueY(series.values, series.activeValue, top, height);
  const labelX = x + (side === "left" ? -7 : 7);
  const anchor = side === "left" ? "end" : "start";
  const guideX = x + (side === "left" ? 16 : -16);
  return (
    <g fill={series.color}>
      <line
        x1={x}
        x2={x}
        y1={top}
        y2={top + height}
        stroke={series.color}
        className="timeline-y-axis-line"
      />
      <text x={labelX} y={top - 19} textAnchor={anchor} className="timeline-y-axis-unit">
        {series.label}
      </text>
      <line
        x1={x}
        x2={guideX}
        y1={top}
        y2={top}
        stroke={series.color}
        className="timeline-y-axis-tick"
      />
      <text x={labelX} y={top + 8} textAnchor={anchor} className="timeline-y-axis-range">
        {formatAxis(max)}
      </text>
      <line
        x1={x}
        x2={guideX}
        y1={top + height}
        y2={top + height}
        stroke={series.color}
        className="timeline-y-axis-tick"
      />
      <text
        x={labelX}
        y={top + height}
        textAnchor={anchor}
        className="timeline-y-axis-range"
      >
        0
      </text>
      {activeY === null ? null : (
        <>
          <rect
            x={x - 4}
            y={activeY}
            width="8"
            height={top + height - activeY}
            fill={series.color}
            opacity="0.32"
          />
          <line
            x1={x}
            x2={guideX}
            y1={activeY}
            y2={activeY}
            stroke={series.color}
            className="timeline-y-axis-tick current"
          />
          <line
            x1={x}
            x2={x}
            y1={activeY - 6}
            y2={activeY + 6}
            stroke={series.color}
            strokeWidth="4"
          />
          <text
            x={labelX}
            y={activeY + 4}
            textAnchor={anchor}
            className="timeline-y-axis-current"
          >
            {formatAxis(series.activeValue ?? 0)}
          </text>
        </>
      )}
    </g>
  );
}

function actionsPerMinute(bin: ReportTimelineView["bins"][number]) {
  if (bin.apm !== null) return bin.apm;
  if (bin.leftClicks === null) return null;
  return (bin.leftClicks ?? 0) + (bin.rightClicks ?? 0) + (bin.gameplayKeys ?? 0);
}
function valueY(
  values: (number | null)[],
  value: number | null,
  top: number,
  height: number,
) {
  if (!valid(value)) return null;
  const max = Math.max(1, ...values.filter(valid));
  return top + height - (value / max) * height;
}
function seriesMax(values: (number | null)[]) {
  return Math.max(1, ...values.filter(valid));
}
function formatAxis(value: number) {
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}
function format(value: number | null) {
  return value === null ? "unavailable" : value.toFixed(1);
}
function nearby(events: ReportTimelineView["events"], timestamp: number) {
  const items = events
    .filter((event) => Math.abs(event.timestamp - timestamp) < 15_000)
    .map((event) => labels[event.kind]);
  return items.length ? `Nearby: ${items.join(", ")}` : "No nearby game events";
}
