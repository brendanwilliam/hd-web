"use client";

import { useActionState } from "react";
import { initialHistoryActionState } from "@/features/profiles/domain/history-action-state";
import { refreshHistoryAction } from "@/features/profiles/server/actions";

export function HistoryRefresh({ profileId, slug, fetchedAt }: { profileId: string; slug: string; fetchedAt: Date | null }) {
  const [state, action, pending] = useActionState(refreshHistoryAction, initialHistoryActionState);
  return <form action={action} className="history-refresh"><input type="hidden" name="profileId" value={profileId} /><input type="hidden" name="slug" value={slug} /><p>{fetchedAt ? `Last refreshed ${fetchedAt.toLocaleString()}` : "Match history has not been loaded yet."}</p><button type="submit" disabled={pending}>{pending ? "Refreshing…" : "Refresh match history"}</button>{state.status !== "idle" && <p className={state.status === "error" ? "history-error" : "report-note"} aria-live="polite">{state.message}</p>}</form>;
}
