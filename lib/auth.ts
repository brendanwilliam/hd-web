import { db } from "@/lib/db";
import { sessionAccountId } from "@/lib/session";

export async function requireAccount() {
  const id = await sessionAccountId();
  return id ? db.account.findUnique({ where: { id } }) : null;
}
export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
