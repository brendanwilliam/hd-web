import { requireAccount } from "@/lib/auth";
import { approveDevice } from "./actions";
import Link from "next/link";

export default async function LinkPage({ searchParams }: { searchParams: Promise<{ approved?: string }> }) {
  const account = await requireAccount();
  const approved = (await searchParams).approved;
  return <main><h1>Link Input Activity OBS</h1>{!account ? <p>Sign in with GitHub to approve your device. <Link href="/api/auth/github">Continue with GitHub</Link></p> : <>{approved === "1" && <p role="status">Device approved. Return to OBS; it will finish linking shortly.</p>}{approved === "0" && <p role="alert">That code is invalid, expired, or has already been used.</p>}<p>Signed in as <strong>{account.login}</strong>.</p><form action={approveDevice}><label htmlFor="userCode">Code shown in OBS</label><input id="userCode" name="userCode" required placeholder="ABCD-1234" pattern="[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}" autoCapitalize="characters" /><button type="submit">Approve device</button></form><p><Link href="/tokens">Manage linked devices</Link></p></>}</main>;
}
