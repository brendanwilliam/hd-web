import { requireAccount } from "@/features/auth/server/account";
import { approveDevice } from "@/features/devices/server/approve-device";
import { LinkStatus } from "./link-status";
import Link from "next/link";

export default async function LinkPage({
  searchParams,
}: {
  searchParams: Promise<{ approved?: string; code?: string }>;
}) {
  const account = await requireAccount();
  const { approved, code: candidate } = await searchParams;
  const code = candidate?.toUpperCase();
  const linkCode = code && /^[A-F0-9]{4}-[A-F0-9]{4}$/.test(code) ? code : "";
  const signIn = linkCode
    ? `/api/auth/github?code=${encodeURIComponent(linkCode)}`
    : "/api/auth/github";
  return (
    <main>
      <h1>Link Hands Diff</h1>
      {!account ? (
        <p>
          Sign in with GitHub to approve your device.{" "}
          <Link href={signIn}>Continue with GitHub</Link>
        </p>
      ) : (
        <>
          {approved === "1" && linkCode && <LinkStatus code={linkCode} />}
          {approved === "0" && (
            <p role="alert">That code is invalid, expired, or has already been used.</p>
          )}
          <p>
            Signed in as <strong>{account.login}</strong>.
          </p>
          <form action={approveDevice}>
            <label htmlFor="userCode">Device code</label>
            <input
              id="userCode"
              name="userCode"
              required
              defaultValue={linkCode}
              placeholder="ABCD-1234"
              pattern="[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}"
              autoCapitalize="characters"
            />
            <button type="submit">Approve device</button>
          </form>
          <p>
            <Link href="/tokens">Manage linked devices</Link>
          </p>
        </>
      )}
    </main>
  );
}
