"use client";

import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <><button type="submit" disabled={pending}>{pending ? "Fetching match and timeline data…" : "Fetch last 20 games"}</button>{pending ? <p role="status">Waiting for Riot match and timeline responses.</p> : null}</>;
}

export function RecentMatchImportForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  return <form action={action}><label htmlFor="riot_id">Riot ID</label><input id="riot_id" name="riot_id" placeholder="Game Name#Tag" required /><SubmitButton /></form>;
}
