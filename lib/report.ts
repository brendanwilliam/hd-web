import { z } from "zod";

const object = z.record(z.unknown());
export const reportSchema = z.object({
  schema_version: z.union([z.literal(4), z.literal(5)]), id: z.string().uuid(), completed_at: z.string().datetime(),
  player: z.string().min(3).max(100), champion: z.string().max(100).optional(),
  game_mode: z.string().max(100).optional(), duration_seconds: z.number().int().nonnegative().max(86_400).optional(),
  samples: z.array(object).max(2_000).default([]), timeline_samples: z.array(object).max(2_000).default([]),
  events: z.array(object).max(2_000).default([]), timeline_events: z.array(object).max(2_000).default([]),
  input_samples: z.array(object).max(2_000).default([]), hexbins: z.array(object).max(2_000).default([]),
  chapters: z.array(object).max(500).default([]), assets: object.optional(), enrichment: object.optional()
}).passthrough();
export type ReportPayload = z.infer<typeof reportSchema>;
export const normalizeRiotId = (riotId: string) => riotId.normalize("NFKC").trim().toLocaleLowerCase();
export function safeReport(payload: ReportPayload) {
  // The client never sends raw keys; explicitly remove any accidental key-shaped fields too.
  const { keys: _keys, key_events: _keyEvents, raw_keys: _rawKeys, ...report } = payload as ReportPayload & Record<string, unknown>;
  return report;
}
