"use server";

import { revalidatePath } from "next/cache";
import { eq, sql, and, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { paymentMethods, accounts, transactions } from "@/db/schema";
import { methodInputSchema, fieldErrors } from "@/lib/validation";
import { requireAuth, okResult, errResult, type ActionResult } from "./shared";

function parseMethodForm(formData: FormData) {
  return methodInputSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    accountId: Number(formData.get("accountId") ?? 0),
    icon: (formData.get("icon") as string) || null,
  });
}

async function assertAccountExists(accountId: number): Promise<boolean> {
  const rows = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
  return rows.length > 0;
}

export async function createMethod(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const parsed = parseMethodForm(formData);
  if (!parsed.success) return errResult(fieldErrors(parsed.error));
  const data = parsed.data;
  if (!(await assertAccountExists(data.accountId))) {
    return errResult({ accountId: "Pick an account" });
  }

  const maxOrder = await db
    .select({ m: sql<number>`coalesce(max(${paymentMethods.sortOrder}), -1)` })
    .from(paymentMethods);

  await db.insert(paymentMethods).values({
    name: data.name,
    accountId: data.accountId,
    icon: data.icon ?? null,
    isDefault: false,
    sortOrder: (maxOrder[0]?.m ?? -1) + 1,
  });

  revalidatePath("/settings");
  return okResult("Method added");
}

export async function updateMethod(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return errResult({ _: "Bad id" });
  const parsed = parseMethodForm(formData);
  if (!parsed.success) return errResult(fieldErrors(parsed.error));
  const data = parsed.data;
  if (!(await assertAccountExists(data.accountId))) {
    return errResult({ accountId: "Pick an account" });
  }

  const [existing] = await db
    .select({ accountId: paymentMethods.accountId })
    .from(paymentMethods)
    .where(eq(paymentMethods.id, id))
    .limit(1);
  if (!existing) return errResult({ _: "This method no longer exists" });

  // Past spends are attributed to the method's CURRENT account, so moving a method
  // that has history would silently rewrite old balances and card statements.
  if (existing.accountId !== data.accountId) {
    const used = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.methodId, id))
      .limit(1);
    if (used.length > 0) {
      return errResult({
        accountId: "This method has transactions, so its account can't change. Archive it and add a new method instead.",
      });
    }
  }

  await db
    .update(paymentMethods)
    .set({ name: data.name, accountId: data.accountId, icon: data.icon ?? null })
    .where(eq(paymentMethods.id, id));

  revalidatePath("/settings");
  return okResult("Method saved");
}

/**
 * Set the default method, atomically unsetting the previous one so the partial
 * unique index (is_default = true) is never violated. SPEC §3 / §11.
 */
export async function setDefaultMethod(id: number): Promise<ActionResult> {
  await requireAuth();
  // Unsetting first would leave no default at all if the target is gone or archived.
  const [target] = await db
    .select({ isArchived: paymentMethods.isArchived })
    .from(paymentMethods)
    .where(eq(paymentMethods.id, id))
    .limit(1);
  if (!target || target.isArchived) {
    const message = "That method is archived or no longer exists";
    return errResult({ _: message }, message);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(paymentMethods)
      .set({ isDefault: false })
      .where(and(eq(paymentMethods.isDefault, true), ne(paymentMethods.id, id)));
    await tx.update(paymentMethods).set({ isDefault: true }).where(eq(paymentMethods.id, id));
  });
  revalidatePath("/settings");
  revalidatePath("/add");
  return okResult("Default updated");
}

export async function setMethodArchived(id: number, archived: boolean): Promise<ActionResult> {
  await requireAuth();
  // Refuse to archive the default method — there must always be a default.
  if (archived) {
    const rows = await db
      .select({ isDefault: paymentMethods.isDefault })
      .from(paymentMethods)
      .where(eq(paymentMethods.id, id))
      .limit(1);
    if (rows[0]?.isDefault) {
      const message = "Make another method default before archiving this one.";
      return errResult({ _: message }, message);
    }
  }
  await db.update(paymentMethods).set({ isArchived: archived }).where(eq(paymentMethods.id, id));
  revalidatePath("/settings");
  return okResult(archived ? "Archived" : "Restored");
}
