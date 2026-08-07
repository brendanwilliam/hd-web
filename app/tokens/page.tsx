import { requireAccount } from "@/features/auth/server/account";
import { revokeToken } from "@/features/devices/server/revoke-token";
import { db } from "@/shared/server/db";
import { redirect } from "next/navigation";
import Link from "next/link";
export default async function TokensPage() { const account = await requireAccount(); if (!account) redirect("/link"); const tokens = await db.apiToken.findMany({ where: { accountId: account.id }, include: { grant: true }, orderBy: { createdAt: "desc" } }); return <main><h1>Linked devices</h1>{tokens.length === 0 ? <p>No linked devices.</p> : <ul>{tokens.map(token => <li key={token.id}>{token.grant?.clientName ?? "Input Activity OBS"} · {token.revokedAt ? "revoked" : "active"}{!token.revokedAt && <form action={revokeToken}><input type="hidden" name="id" value={token.id}/><button>Revoke</button></form>}</li>)}</ul>}<p><Link href="/link">Link another device</Link></p></main>; }
