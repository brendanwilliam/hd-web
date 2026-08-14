"use server";
import { requireAccount } from "@/features/auth/server/account";
import { db } from "@/shared/server/db";
import { revalidatePath } from "next/cache";

export async function revokeToken(formData: FormData) {
  const account = await requireAccount();
  const id = String(formData.get("id") ?? "");
  if (account)
    await db.apiToken.updateMany({
      where: { id, accountId: account.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  revalidatePath("/tokens");
}
