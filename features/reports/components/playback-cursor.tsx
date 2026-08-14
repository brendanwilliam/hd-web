"use client";

import { clampCursor } from "@/features/reports/domain/playback-model";
import { createContext, useContext, useMemo, useState } from "react";

type Cursor = { cursorMs: number; seek(cursorMs: number): void; durationMs: number };
const PlaybackCursor = createContext<Cursor | null>(null);

export function PlaybackCursorProvider({
  durationMs,
  children,
}: {
  durationMs: number;
  children: React.ReactNode;
}) {
  const [cursorMs, setCursorMs] = useState(0);
  const value = useMemo(
    () => ({
      cursorMs,
      durationMs,
      seek: (next: number) => setCursorMs(clampCursor(next, durationMs)),
    }),
    [cursorMs, durationMs],
  );
  return <PlaybackCursor.Provider value={value}>{children}</PlaybackCursor.Provider>;
}

export function usePlaybackCursor() {
  const value = useContext(PlaybackCursor);
  if (!value) throw new Error("PlaybackCursorProvider is required");
  return value;
}
