import type { PlaybackMarker } from "@/features/reports/domain/playback-model";

export type HexBin = { q: number; r: number; count: number };

export function hexBins(markers: PlaybackMarker[], radius = 0.08): HexBin[] {
  const bins = new Map<string, HexBin>();
  for (const marker of markers) {
    if (marker.normalizedX === null || marker.normalizedY === null) continue;
    const q = Math.round(
      ((Math.sqrt(3) / 3) * marker.normalizedX - marker.normalizedY / 3) / radius,
    );
    const r = Math.round(((2 / 3) * marker.normalizedY) / radius);
    const key = `${q},${r}`;
    const bin = bins.get(key) ?? { q, r, count: 0 };
    bin.count += 1;
    bins.set(key, bin);
  }
  return [...bins.values()];
}

export function activityTrail(markers: PlaybackMarker[], cursorMs: number) {
  const preceding = markers.filter((marker) => marker.gameTimeMs <= cursorMs);
  return {
    pointer:
      [...preceding].reverse().find((marker) => marker.kind === "pointer_sample") ?? null,
    markers: preceding.slice(-20),
  };
}
