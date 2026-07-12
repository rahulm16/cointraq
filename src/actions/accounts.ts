"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts } from "@/db/schema";
import { accountInputSchema, billingDaySchema } from "@/lib/validation";
import { fieldErrors } from "@/lib/validation";
import { requireAuth, okResult, errResult, type ActionResult } from "./shared";

function parseAccountForm(formData: FormData) {
  const type = String(formData.get("type") ?? "");
  const rawBilling = formData.get("billingDay");
  return accountInputSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    type,
    openingBalance: Number(formData.get("openingBalance") ?? 0),
    billingDay:
      type === "credit_card" && rawBilling != null && rawBilling !== ""
        ? Number(rawBilling)
        : null,
    icon: (formData.get("icon") as string) || null,
  });
}

export async function createAccount(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const parsed = parseAccountForm(formData);
  if (!parsed.success) return errResult(fieldErrors(parsed.error));

  const data = parsed.data;
  if (data.type === "credit_card" && data.billingDay == null) {
    return errResult({ billingDay: "Billing day required for a credit card" });
  }

  const maxOrder = await db
    .select({ m: sql<number>`coalesce(max(${accounts.sortOrder}), -1)` })
    .from(accounts);

  await db.insert(accounts).values({
    name: data.name,
    type: data.type,
    openingBalance: data.openingBalance ?? 0,
    billingDay: data.type === "credit_card" ? data.billingDay : null,
    icon: data.icon ?? null,
    sortOrder: (maxOrder[0]?.m ?? -1) + 1,
  });

  revalidatePath("/settings");
  return okResult("Account added");
}

export async function updateAccount(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return errResult({ _: "Bad id" });

  const parsed = parseAccountForm(formData);
  if (!parsed.success) return errResult(fieldErrors(parsed.error));
  const data = parsed.data;
  if (data.type === "credit_card" && data.billingDay == null) {
    return errResult({ billingDay: "Billing day required for a credit card" });
  }

  await db
    .update(accounts)
    .set({
      name: data.name,
      type: data.type,
      openingBalance: data.openingBalance ?? 0,
      billingDay: data.type === "credit_card" ? data.billingDay : null,
      icon: data.icon ?? null,
    })
    .where(eq(accounts.id, id));

  revalidatePath("/settings");
  return okResult("Account saved");
}

/** Billing-day editor per credit-card account. SPEC §11. */
export async function setBillingDay(id: number, day: number): Promise<ActionResult> {
  await requireAuth();
  const parsed = billingDaySchema.safeParse(day);
  if (!parsed.success) return errResult({ billingDay: "Day must be 1–31" });
  await db.update(accounts).set({ billingDay: parsed.data }).where(eq(accounts.id, id));
  revalidatePath("/settings");
  revalidatePath("/");
  return okResult();
}

export async function setAccountArchived(id: number, archived: boolean): Promise<ActionResult> {
  await requireAuth();
  await db.update(accounts).set({ isArchived: archived }).where(eq(accounts.id, id));
  revalidatePath("/settings");
  return okResult(archived ? "Archived" : "Restored");
}
