"use client";

import { useMemo, useState } from "react";
import { numberValue, reportSeries, timelineEvents } from "@/features/reports/visualizations/data";
import { ChartPanel } from "@/features/reports/visualizations/chart-panel";
import { EventTimeline } from "@/features/reports/visualizations/event-timeline";
import type { ReportData } from "@/features/reports/visualizations/types";

export function ReportVisualizations({ payload }: { payload: ReportData }) {
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const events = useMemo(() => timelineEvents(payload), [payload]);
  const duration = useMemo(() => Math.max(1, numberValue(payload.duration_seconds) ?? 0, ...reportSeries(payload, "cumulative").flatMap(series => series.points.map(point => point.x)), ...events.map(event => event.seconds)), [events, payload]);

  const activeTime = previewTime ?? hoverTime;

  return <>
    <EventTimeline events={events} duration={duration} hoverTime={activeTime} onHoverTime={setHoverTime} />
    <ChartPanel payload={payload} group="input" duration={duration} onHoverTime={setHoverTime} onPreviewTime={setPreviewTime} />
    <ChartPanel payload={payload} group="economy" duration={duration} onHoverTime={setHoverTime} />
    <ChartPanel payload={payload} group="combat" duration={duration} onHoverTime={setHoverTime} />
  </>;
}
