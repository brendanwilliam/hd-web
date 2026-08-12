import { describe, expect, it } from "vitest";
import { canonicalPayload, validateReport } from "@/features/reports/domain/payload";
import { createHash } from "node:crypto";

function report() {
  const value = { schema_version: 2 as const, report_id: "a0f59d84-9d21-4d07-b903-2ec435ee0c1e", capture_policy_version: 1 as const, payload_hash: "", capture: { started_at_utc: "2026-08-10T19:30:00.000Z", duration_ms: 120_000, game_mode: "CLASSIC" as const, map_number: 11 as const, riot_id: { game_name: "Player", tag_line: "NA1" }, frontmost_capture: true as const, complete: true, event_detail_truncated: false }, input: { left_clicks: 2, right_clicks: 3, gameplay_key_actions: 4, intensity_by_second: [{ second: 1, apm: 20, mouse_velocity: 0.2 }], summary: { peak_apm: 20, median_apm: 20, peak_mouse_velocity: 0.2, median_mouse_velocity: 0.2 } }, live_context: { changes: [] } };
  value.payload_hash = createHash("sha256").update(JSON.stringify(value, (_key, item) => item === value.payload_hash ? undefined : item)).digest("hex");
  return value;
}

describe("v2 report payload", () => {
  it("accepts only an ordered strict v2 envelope", () => {
    const value = report();
    expect(validateReport(value).success).toBe(true);
    expect(canonicalPayload(value as never)).not.toContain("payload_hash");
  });
  it("accepts a partial capture", () => {
    const value = report(); value.capture.complete = false;
    value.payload_hash = createHash("sha256").update(JSON.stringify(value, (_key, item) => item === value.payload_hash ? undefined : item)).digest("hex");
    expect(validateReport(value).success).toBe(true);
  });
  it("rejects raw keys, old schemas, and duplicate seconds", () => {
    expect(validateReport({ ...report(), schema_version: 4 }).success).toBe(false);
    expect(validateReport({ ...report(), raw_keys: ["Q"] }).success).toBe(false);
    const value = report(); value.input.intensity_by_second.push({ second: 1, apm: 1, mouse_velocity: 0 });
    expect(validateReport(value).success).toBe(false);
  });
});
