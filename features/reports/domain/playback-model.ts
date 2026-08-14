export type PlaybackMarker = {
  gameTimeMs: number;
  kind: string;
  normalizedX: number | null;
  normalizedY: number | null;
  actionLabel: string | null;
};

export type ReplayAdapter = {
  offsetMs: number;
  driftMultiplier: number;
  toCursorMs(replayTimeMs: number): number;
};

export function replayAdapter(offsetMs = 0, driftMultiplier = 1): ReplayAdapter {
  return {
    offsetMs,
    driftMultiplier,
    toCursorMs: (replayTimeMs) => Math.round(replayTimeMs * driftMultiplier + offsetMs),
  };
}

export function clampCursor(cursorMs: number, durationMs: number) {
  return Math.max(0, Math.min(Math.max(0, Math.round(durationMs)), Math.round(cursorMs)));
}

export function playbackCursorSnapshot(
  cursorMs: number,
  durationMs: number,
  markers: PlaybackMarker[],
) {
  const cursor = clampCursor(cursorMs, durationMs);
  const preceding = markers.filter((marker) => marker.gameTimeMs <= cursor);
  const pointer = [...preceding]
    .reverse()
    .find((marker) => marker.kind === "pointer_sample");
  return { cursorMs: cursor, pointer: pointer ?? null, markers: preceding.slice(-20) };
}
