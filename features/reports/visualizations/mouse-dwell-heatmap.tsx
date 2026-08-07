"use client";

import * as d3 from "d3";
import { dataItems, numberValue } from "@/features/reports/visualizations/data";
import type { ReportData } from "@/features/reports/visualizations/types";

type MouseDwellHeatmapProps = {
  payload: ReportData;
  compact?: boolean;
};

export function MouseDwellHeatmap({ payload, compact = false }: MouseDwellHeatmapProps) {
  const bins = dataItems(payload.hexbins);
  const geometry = payload.mouse_geometry as ReportData | undefined;
  const aspect = numberValue(payload.frame_aspect_ratio) ??
    ((numberValue(geometry?.frame_width) ?? 16) / (numberValue(geometry?.frame_height) ?? 9));
  const recordedRadius = numberValue(payload.hex_radius_percent);
  const hexWidth = recordedRadius === null
    ? numberValue(geometry?.hex_width_percent) ?? 2
    : Math.sqrt(3) * recordedRadius;
  const hexRadius = hexWidth / Math.sqrt(3);
  const heatmapHeight = 100 / Math.max(0.01, aspect);
  const totalDwell = d3.sum(bins, bin => numberValue(bin.dwell_ms) ?? 0);
  const maxDwell = Math.max(1, d3.max(bins, bin => numberValue(bin.dwell_ms) ?? 0) ?? 1);

  if (!bins.length) {
    return compact ? null : <p className="report-note">Mouse dwell-time data was not recorded for this report.</p>;
  }

  return (
    <div className={compact ? "report-heatmap report-heatmap-compact" : "report-heatmap"}>
      <svg viewBox={`0 0 100 ${heatmapHeight}`} role="img" aria-label="Mouse dwell time in the recorded game frame">
        {bins.map((bin, index) => {
          const row = numberValue(bin.row) ?? 0;
          const column = numberValue(bin.column) ?? 0;
          const dwell = numberValue(bin.dwell_ms) ?? 0;
          const cx = hexWidth * (column + (row & 1 ? 0.5 : 0));
          const cy = hexRadius * (1 + 1.5 * row);
          const points = Array.from(
            { length: 6 },
            (_, corner) => `${cx + hexRadius * Math.cos(((30 + corner * 60) * Math.PI) / 180)},${cy + hexRadius * Math.sin(((30 + corner * 60) * Math.PI) / 180)}`,
          ).join(" ");
          const dwellPercent = totalDwell ? (dwell / totalDwell) * 100 : 0;
          return (
            <polygon
              key={index}
              points={points}
              fill={`hsl(${190 - (130 * dwell) / maxDwell} 76% ${37 + (31 * dwell) / maxDwell}%)`}
              tabIndex={0}
            >
              <title>{`${(dwell / 1000).toFixed(2)}s dwell · ${dwellPercent.toFixed(1)}% of recorded dwell · ${cx.toFixed(1)}%, ${((cy / heatmapHeight) * 100).toFixed(1)}% of game frame`}</title>
            </polygon>
          );
        })}
      </svg>
    </div>
  );
}
