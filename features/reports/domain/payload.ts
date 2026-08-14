import { z } from "zod";

const bucket = z
  .object({
    second: z.number().int().nonnegative(),
    apm: z.number().nonnegative(),
    mouse_velocity: z.number().nonnegative(),
  })
  .strict();
const inputEvent = z
  .object({
    second: z.number().int().nonnegative(),
    kind: z.enum(["left_click", "right_click", "gameplay_key"]),
  })
  .strict();
const capture = z
  .object({
    started_at_utc: z.string().datetime(),
    duration_ms: z.number().int().positive().max(86_400_000),
    game_mode: z.enum(["CLASSIC", "PRACTICETOOL"]),
    map_number: z.literal(11),
    riot_id: z
      .object({
        game_name: z.string().min(1).max(100),
        tag_line: z.string().min(1).max(100),
      })
      .strict(),
    frontmost_capture: z.literal(true),
    complete: z.boolean(),
    event_detail_truncated: z.boolean(),
  })
  .strict();
const summary = z
  .object({
    peak_apm: z.number().nonnegative(),
    median_apm: z.number().nonnegative(),
    peak_mouse_velocity: z.number().nonnegative(),
    median_mouse_velocity: z.number().nonnegative(),
  })
  .strict();
const envelope = z
  .object({
    report_id: z.string().uuid(),
    capture_policy_version: z.literal(1),
    payload_hash: z.string().regex(/^[a-f0-9]{64}$/),
    capture,
    live_context: z
      .object({
        changes: z
          .array(
            z
              .object({
                second: z.number().int().nonnegative(),
                kind: z.string().max(80),
              })
              .strict(),
          )
          .max(2_000),
      })
      .strict(),
  })
  .strict();

const v2Payload = envelope.extend({
  schema_version: z.literal(2),
  input: z
    .object({
      left_clicks: z.number().int().nonnegative(),
      right_clicks: z.number().int().nonnegative(),
      gameplay_key_actions: z.number().int().nonnegative(),
      intensity_by_second: z.array(bucket).max(10_000),
      event_details: z.array(inputEvent).max(100_000).optional(),
      summary,
    })
    .strict(),
});

const actionLabel = new RegExp(
  [
    "^(?:(?:(?:self_cast|normal_cast|smart_cast|smart_plus_self_cast|",
    "smart_cast_with_indicator|smart_plus_self_cast_with_indicator)_)?",
    "(?:spell_[1-4]|summoner_[1-2]|item_[1-6]|trinket|role_bound)|",
    "recall|shop|attack_move|attack_move_click|attack_only_click|stop)$",
  ].join(""),
);
const point = z
  .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
  .strict();
const playbackRecord = z.discriminatedUnion("kind", [
  z
    .object({
      game_time_ms: z.number().int().min(0).max(3_600_000),
      kind: z.literal("pointer_sample"),
      pointer: point,
    })
    .strict(),
  z
    .object({
      game_time_ms: z.number().int().min(0).max(3_600_000),
      kind: z.enum(["left_click", "right_click", "middle_click"]),
      pointer: point,
    })
    .strict(),
  z
    .object({
      game_time_ms: z.number().int().min(0).max(3_600_000),
      kind: z.literal("gameplay_action"),
      pointer: point.optional(),
      action_label: z.string().regex(actionLabel),
    })
    .strict(),
]);
const v3Payload = envelope.extend({
  schema_version: z.literal(3),
  capture: capture.extend({ duration_ms: z.number().int().positive().max(3_600_000) }),
  input: z
    .object({
      left_clicks: z.number().int().nonnegative(),
      right_clicks: z.number().int().nonnegative(),
      gameplay_key_actions: z.number().int().nonnegative(),
      intensity_by_second: z.array(bucket).max(10_000),
      summary,
      playback: z
        .object({
          records: z.array(playbackRecord).max(50_000),
          truncated: z.boolean(),
          omitted_record_count: z.number().int().nonnegative(),
          timestamp_precision_ms: z.number().int().positive().max(2_000),
        })
        .strict(),
    })
    .strict(),
});

const payload = z.union([v2Payload, v3Payload]);

export type ReportPayload = z.infer<typeof payload>;
export function validateReport(value: unknown) {
  const parsed = payload.safeParse(value);
  if (!parsed.success) return parsed;
  const seconds = parsed.data.input.intensity_by_second.map((value) => value.second);
  if (seconds.some((second, index) => index > 0 && second <= seconds[index - 1]))
    return { success: false as const, error: new z.ZodError([]) };
  if (parsed.data.schema_version === 3) {
    const records = parsed.data.input.playback.records;
    if (
      records.filter((record) => record.kind === "pointer_sample").length > 36_000 ||
      records.some(
        (record, index) =>
          index > 0 && record.game_time_ms <= records[index - 1].game_time_ms,
      ) ||
      records
        .filter((record) => record.kind === "pointer_sample")
        .some(
          (record, index, samples) =>
            index > 0 && record.game_time_ms - samples[index - 1].game_time_ms < 100,
        ) ||
      Buffer.byteLength(JSON.stringify(sortedValue(records)), "utf8") > 5 * 1024 * 1024
    )
      return { success: false as const, error: new z.ZodError([]) };
  }
  return parsed;
}

export function canonicalPayload(value: ReportPayload) {
  const { payload_hash: _hash, ...withoutHash } = value;
  return JSON.stringify(sortedValue(withoutHash));
}

function sortedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortedValue(item)]),
  );
}
