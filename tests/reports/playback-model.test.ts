import { describe, expect, it } from "vitest";
import {
  clampCursor,
  playbackCursorSnapshot,
  replayAdapter,
} from "@/features/reports/domain/playback-model";

describe("report playback model", () => {
  const markers = Array.from({ length: 22 }, (_, index) => ({
    gameTimeMs: index * 100,
    kind: index === 0 ? "pointer_sample" : "gameplay_action",
    normalizedX: index ? null : 0.2,
    normalizedY: index ? null : 0.8,
    actionLabel: index ? "spell_1" : null,
  }));
  it("clamps its one integer game-time cursor and bounds marker history", () => {
    expect(clampCursor(100.7, 100)).toBe(100);
    const snapshot = playbackCursorSnapshot(9_999, 2_000, markers);
    expect(snapshot.cursorMs).toBe(2_000);
    expect(snapshot.markers).toHaveLength(20);
    expect(snapshot.pointer?.gameTimeMs).toBe(0);
  });
  it("maps replay time without changing stored marker timestamps", () => {
    expect(replayAdapter(50, 1.1).toCursorMs(100)).toBe(160);
    expect(markers[0].gameTimeMs).toBe(0);
  });
});
