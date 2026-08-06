import { z } from "zod";

export const reportSchema = z
  .object({
    schema_version: z.literal(4),
    id: z.string().uuid(),
    completed_at: z.string().datetime(),
    player: z.string().min(1).max(64),
    game_id: z.string().max(128).optional().default(""),
    champion: z.string().max(64).optional().default(""),
    outcome: z.string().max(32).optional().default("unavailable"),
  })
  .passthrough();

export type ReportPayload = z.infer<typeof reportSchema>;

export function normalizeRiotId(value: string) {
  return value.trim().normalize("NFKC").toLocaleLowerCase();
}
