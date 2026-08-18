"use client";

import { brushX, line, scaleLinear, select } from "d3";
import type { ScaleLinear } from "d3";
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
    margin = { left: 42, right: 14, top: 20, bottom: 38 },
    inner = outer - margin.left - margin.right,
    height = 456;
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
        [margin.left, 362],
        [margin.left + inner, 378],
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
  const linePath = (
    values: (number | null)[],
    top: number,
    rowHeight: number,
    color: string,
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
        className="unified-line"
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
          velocity remains available.
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
        <rect
          x={margin.left}
          y="136"
          width={inner}
          height="94"
          className="timeline-background"
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
        <rect
          x={margin.left}
          y="260"
          width={inner}
          height="110"
          className="timeline-background"
        />
        {renderBars(bins, x, 260, 110)}
        {linePath(
          bins.map((bin) => bin.meanVelocity),
          260,
          110,
          COLORS.velocity,
        )}
        {bins.map((bin) =>
          valid(bin.peakVelocity) ? (
            <circle
              key={bin.timestamp}
              cx={x(bin.timestamp)}
              cy={velocityY(bins, bin.peakVelocity, 260, 110)}
              r="2.5"
              fill="#e6975588"
            />
          ) : null,
        )}
        {hover !== null ? (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1="20"
            y2="370"
            className="timeline-cursor"
          />
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
        <text x={margin.left} y="434" className="timeline-label">
          Drag the gold strip to zoom · {time(activeDomain[0])}–{time(activeDomain[1])}
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
          <text textAnchor="middle" x="10" y="9" className="timeline-event-emoji">
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

function renderBars(
  bins: ReportTimelineView["bins"],
  x: ScaleLinear<number, number>,
  top: number,
  height: number,
) {
  const max = Math.max(
    1,
    ...bins.map(
      (bin) => (bin.leftClicks ?? 0) + (bin.rightClicks ?? 0) + (bin.gameplayKeys ?? 0),
    ),
  );
  return bins.map((bin) => {
    const values = [
      [bin.leftClicks, COLORS.left],
      [bin.rightClicks, COLORS.right],
      [bin.gameplayKeys, COLORS.key],
    ] as const;
    let offset = top + height;
    return values.map(([value, color], index) => {
      const h = ((value ?? 0) / max) * height;
      offset -= h;
      return (
        <rect
          key={index}
          x={x(bin.timestamp) - 4}
          y={offset}
          width="8"
          height={h}
          fill={color}
        />
      );
    });
  });
}
function velocityY(
  bins: ReportTimelineView["bins"],
  value: number,
  top: number,
  height: number,
) {
  const max = Math.max(1, ...bins.map((bin) => bin.peakVelocity ?? 0));
  return top + height - (value / max) * height;
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
