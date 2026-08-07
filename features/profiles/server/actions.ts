"use server";

import { revalidatePath } from "next/cache";
import type { HistoryActionState } from "@/features/profiles/domain/history-action-state";
import { profilePath } from "@/features/profiles/domain/paths";
import { refreshProfileHistory } from "@/features/profiles/server/history";

export async function refreshHistoryAction(_previous: HistoryActionState, formData: FormData): Promise<HistoryActionState> {
  const profileId = String(formData.get("profileId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!profileId || !slug) return { status: "error", message: "Player profile not found." };
  const result = await refreshProfileHistory(profileId);
  if (result.status === "updated") revalidatePath(profilePath(slug));
  return result;
}
