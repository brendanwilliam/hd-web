import { requireAccount } from "@/features/auth/server/account";
import { revokeToken } from "@/features/devices/server/revoke-token";
import { db } from "@/shared/server/db";
import { redirect } from "next/navigation";
import Link from "next/link";

function dateDescription(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
        date,
      )
    : "Not used yet";
}

export default async function TokensPage() {
  const account = await requireAccount();
  if (!account) redirect("/link");
  const tokens = await db.apiToken.findMany({
    where: { accountId: account.id },
    include: { grant: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main>
      <h1>Linked devices</h1>
      {tokens.length === 0 ? (
        <p>No linked devices.</p>
      ) : (
        <ul>
          {tokens.map((token) => (
            <li key={token.id}>
              <strong>{token.grant?.clientName ?? "Input Activity OBS"}</strong>
              <p>
                {token.revokedAt ? "Revoked" : "Active"} · Linked{" "}
                {dateDescription(token.createdAt)} · Last used{" "}
                {dateDescription(token.lastUsedAt)}
              </p>
              {!token.revokedAt && (
                <form action={revokeToken}>
                  <input type="hidden" name="id" value={token.id} />
                  <button>Revoke</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link href="/link">Link another device</Link>
      </p>
    </main>
  );
}
