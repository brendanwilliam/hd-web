"use server";

import { requireAccount } from "@/features/auth/server/account";
import { importRecentMatches } from "@/features/reports/server/import-recent-matches";
import { redirect } from "next/navigation";

export async function fetchRecentMatchesAction(formData: FormData) {
  const account = await requireAccount();
  if (!account) redirect("/link");
  const riotId = String(formData.get("riot_id") ?? "").trim();
  const separator = riotId.lastIndexOf("#");
  const gameName = riotId.slice(0, separator).trim();
  const tagLine = riotId.slice(separator + 1).trim();
  if (separator < 1 || !gameName || !tagLine) redirect("/reports?fetch_error=invalid_riot_id");

  let imported: number;
  try { imported = await importRecentMatches(account.id, gameName, tagLine); } catch (error) {
    const code = error instanceof Error && ["riot_not_configured", "riot_id_not_found", "riot_matches_unavailable", "riot_429"].includes(error.message) ? error.message : "riot_fetch_failed";
    redirect(`/reports?fetch_error=${code}`);
  }
  redirect(`/reports?imported=${imported}`);
}
