import { normalizeRiotId } from "@/features/reports/domain/payload";
import { digest } from "@/shared/crypto";

export const profileSlug = (riotId: string) => normalizeRiotId(riotId).replace("#", "-");

export const collisionSlug = (riotId: string) => `${profileSlug(riotId)}-${digest(normalizeRiotId(riotId)).slice(0, 8)}`;
export const profilePath = (slug: string) => `/${encodeURIComponent(slug)}`;
export const reportPath = (slug: string, reportId: string) => `${profilePath(slug)}/reports/${encodeURIComponent(reportId)}`;
