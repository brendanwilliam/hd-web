"use server";
import { db } from "@/lib/db";
import { requireAccount } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function approveDevice(formData: FormData) {
  const account = await requireAccount();
  const userCode = String(formData.get("userCode") ?? "").trim().toUpperCase();
  if (!account || !/^[A-F0-9]{4}-[A-F0-9]{4}$/.test(userCode)) redirect("/link?approved=0");
  const result = await db.deviceGrant.updateMany({ where: { userCode, approvedAt: null, consumedAt: null, expiresAt: { gt: new Date() } }, data: { approvedAt: new Date(), accountId: account.id } });
  revalidatePath("/link");
  redirect(`/link?approved=${result.count === 1 ? "1" : "0"}`);
}
