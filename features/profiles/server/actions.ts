"use server";

import { revalidatePath } from "next/cache";
import { profilePath } from "@/features/profiles/domain/paths";
import { refreshProfileHistory } from "@/features/profiles/server/history";

export type HistoryActionState = { status: "idle" | "updated" | "cooldown" | "error"; message: string };
export const initialHistoryActionState: HistoryActionState = { status: "idle", message: "" };

export async function refreshHistoryAction(_previous: HistoryActionState, formData: FormData): Promise<HistoryActionState> {
  const profileId = String(formData.get("profileId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!profileId || !slug) return { status: "error", message: "Player profile not found." };
  const result = await refreshProfileHistory(profileId);
  if (result.status === "updated") revalidatePath(profilePath(slug));
  return result;
}
