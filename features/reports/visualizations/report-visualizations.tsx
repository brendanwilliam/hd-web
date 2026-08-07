"use client";

import { useEffect, useMemo, useState } from "react";
import { numberValue, reportSeries, timelineEvents } from "@/features/reports/visualizations/data";
import { ChartPanel } from "@/features/reports/visualizations/chart-panel";
import { EventTimeline } from "@/features/reports/visualizations/event-timeline";
import type { ReportData } from "@/features/reports/visualizations/types";

export function ReportVisualizations({ payload }: { payload: ReportData }) {
  const [previewTime, setPreviewTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState<Set<"input" | "economy">>(() => new Set(["input", "economy"]));
  const events = useMemo(() => timelineEvents(payload), [payload]);
  const duration = useMemo(() => Math.max(1, numberValue(payload.duration_seconds) ?? 0, ...reportSeries(payload, "cumulative").flatMap(series => series.points.map(point => point.x)), ...events.map(event => event.seconds)), [events, payload]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setPreviewTime(time => {
      if (time >= duration) { setPlaying(false); return duration; }
      return Math.min(duration, time + 1);
    }), 75);
    return () => window.clearInterval(timer);
  }, [duration, playing]);
  const scrub = (time: number) => { setPlaying(false); setPreviewTime(Math.max(0, Math.min(duration, time))); };
  const toggleVisible = (group: "input" | "economy") => setVisible(previous => { const next = new Set(previous); next.has(group) ? next.delete(group) : next.add(group); return next.size ? next : previous; });
  return <>
    <div className="report-preview-switcher"><span>Preview panels</span><button className={visible.has("input") ? "active" : ""} aria-pressed={visible.has("input")} onClick={() => toggleVisible("input")}>Input</button><button className={visible.has("economy") ? "active" : ""} aria-pressed={visible.has("economy")} onClick={() => toggleVisible("economy")}>Economy</button></div>
    <div className="report-preview-grid">{visible.has("input") && <ChartPanel payload={payload} group="input" duration={duration} onHoverTime={time => { if (time !== null) scrub(time); }} previewTime={previewTime} onScrubTime={scrub} />}{visible.has("economy") && <ChartPanel payload={payload} group="economy" duration={duration} onHoverTime={time => { if (time !== null) scrub(time); }} />}</div>
    <ChartPanel payload={payload} group="combat" duration={duration} onHoverTime={time => { if (time !== null) scrub(time); }} />
    <EventTimeline events={events} duration={duration} hoverTime={previewTime} onScrubTime={scrub} playing={playing} onPlayPause={() => setPlaying(previous => !previous)} onJump={seconds => scrub(previewTime + seconds)} onRestart={() => scrub(0)} />
  </>;
}
