import { z } from "zod";

const bucket = z.object({ second: z.number().int().nonnegative(), apm: z.number().nonnegative(), mouse_velocity: z.number().nonnegative() }).strict();
const inputEvent = z.object({ second: z.number().int().nonnegative(), kind: z.enum(["left_click", "right_click", "gameplay_key"]) }).strict();
const payload = z.object({
  schema_version: z.literal(2),
  report_id: z.string().uuid(),
  capture_policy_version: z.literal(1),
  payload_hash: z.string().regex(/^[a-f0-9]{64}$/),
  capture: z.object({
    started_at_utc: z.string().datetime(), duration_ms: z.number().int().positive().max(86_400_000),
    game_mode: z.enum(["CLASSIC", "PRACTICETOOL"]), map_number: z.literal(11),
    riot_id: z.object({ game_name: z.string().min(1).max(100), tag_line: z.string().min(1).max(100) }).strict(),
    frontmost_capture: z.literal(true), complete: z.boolean(), event_detail_truncated: z.boolean()
  }).strict(),
  input: z.object({
    left_clicks: z.number().int().nonnegative(), right_clicks: z.number().int().nonnegative(), gameplay_key_actions: z.number().int().nonnegative(),
    intensity_by_second: z.array(bucket).max(10_000),
    event_details: z.array(inputEvent).max(100_000).optional(),
    summary: z.object({ peak_apm: z.number().nonnegative(), median_apm: z.number().nonnegative(), peak_mouse_velocity: z.number().nonnegative(), median_mouse_velocity: z.number().nonnegative() }).strict()
  }).strict(),
  live_context: z.object({ changes: z.array(z.object({ second: z.number().int().nonnegative(), kind: z.string().max(80) }).strict()).max(2_000) }).strict()
}).strict();

export type ReportPayload = z.infer<typeof payload>;
export function validateReport(value: unknown) {
  const parsed = payload.safeParse(value);
  if (!parsed.success) return parsed;
  const seconds = parsed.data.input.intensity_by_second.map(value => value.second);
  if (seconds.some((second, index) => index > 0 && second <= seconds[index - 1])) return { success: false as const, error: new z.ZodError([]) };
  return parsed;
}

export function canonicalPayload(value: ReportPayload) {
  const { payload_hash: _hash, ...withoutHash } = value;
  return JSON.stringify(sortedValue(withoutHash));
}

function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortedValue(item)]));
}
