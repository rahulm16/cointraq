"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { accounts, appState, paymentMethods, snapshots, transactions } from "@/db/schema";
import { accountInputSchema, billingDaySchema } from "@/lib/validation";
import { fieldErrors } from "@/lib/validation";
import { AMOUNT_MAX } from "@/lib/constants";
import { requireAuth, okResult, errResult, type ActionResult } from "./shared";

const ONE_CASH_ACCOUNT = "You already have a cash account. Archive it before adding another.";

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

/** True when transactions or reconciliation snapshots make the account's type historical. */
async function accountHasHistory(accountId: number): Promise<boolean> {
  const methodIds = (
    await db.select({ id: paymentMethods.id }).from(paymentMethods).where(eq(paymentMethods.accountId, accountId))
  ).map((m) => m.id);
  const refs: SQL[] = [eq(transactions.fromAccountId, accountId), eq(transactions.toAccountId, accountId)];
  if (methodIds.length > 0) refs.push(inArray(transactions.methodId, methodIds));
  const [txnRows, snapshotRows] = await Promise.all([
    db.select({ id: transactions.id }).from(transactions).where(or(...refs)).limit(1),
    db.select({ id: snapshots.id }).from(snapshots).where(eq(snapshots.accountId, accountId)).limit(1),
  ]);
  return txnRows.length > 0 || snapshotRows.length > 0;
}

/** Whether another active cash account exists. Withdrawals need exactly one destination. */
async function otherActiveCash(excludeId?: number): Promise<boolean> {
  const conds: SQL[] = [eq(accounts.type, "cash"), eq(accounts.isArchived, false)];
  if (excludeId != null) conds.push(ne(accounts.id, excludeId));
  const rows = await db.select({ id: accounts.id }).from(accounts).where(and(...conds)).limit(1);
  return rows.length > 0;
}

export async function createAccount(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const parsed = parseAccountForm(formData);
  if (!parsed.success) return errResult(fieldErrors(parsed.error));

  const data = parsed.data;
  if (data.type === "credit_card" && data.billingDay == null) {
    return errResult({ billingDay: "Billing day required for a credit card" });
  }
  if (data.type === "cash" && (await otherActiveCash())) {
    return errResult({ type: ONE_CASH_ACCOUNT });
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

  const [existing] = await db
    .select({ type: accounts.type, isArchived: accounts.isArchived })
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  if (!existing) return errResult({ _: "This account no longer exists" });

  // Balances are recomputed from history using the account's CURRENT type, so
  // retyping an account that has transactions would silently rewrite them all.
  if (existing.type !== data.type && (await accountHasHistory(id))) {
    return errResult({
      type: "This account has transaction or reconciliation history, so its type can't change. Archive it and add a new account instead.",
    });
  }
  if (data.type === "cash" && !existing.isArchived && (await otherActiveCash(id))) {
    return errResult({ type: ONE_CASH_ACCOUNT });
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
  revalidatePath("/");
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
  if (!archived) {
    const [acc] = await db.select({ type: accounts.type }).from(accounts).where(eq(accounts.id, id)).limit(1);
    if (acc?.type === "cash" && (await otherActiveCash(id))) {
      const message = "Archive your other cash account before restoring this one.";
      return errResult({ _: message }, message);
    }
  }
  await db.update(accounts).set({ isArchived: archived }).where(eq(accounts.id, id));
  revalidatePath("/settings");
  revalidatePath("/");
  return okResult(archived ? "Archived" : "Restored");
}

/**
 * Set several opening balances at once — the first-run setup step.
 * Opening balance is the baseline every derived balance counts forward from
 * (SPEC §5), so getting it right here is what makes the first reconcile useful.
 * Negative is allowed: an overdrawn account or a card in credit.
 */
export async function setOpeningBalances(
  entries: { accountId: number; openingBalance: number }[],
): Promise<ActionResult> {
  await requireAuth();

  const parsed = z
    .array(
      z.object({
        accountId: z.number().int().positive(),
        openingBalance: z.number().int().min(-AMOUNT_MAX).max(AMOUNT_MAX),
      }),
    )
    .safeParse(entries);
  if (!parsed.success) return errResult(fieldErrors(parsed.error), "Invalid balance");

  const accountRows = await db.select({ id: accounts.id, type: accounts.type }).from(accounts);
  const accountTypes = new Map(accountRows.map((a) => [a.id, a.type]));
  for (const entry of parsed.data) {
    const type = accountTypes.get(entry.accountId);
    if (!type) return errResult({ _: "Unknown account" }, "An account no longer exists");
    if (type === "cash" && entry.openingBalance < 0) {
      return errResult({ _: "Cash balance can't be negative" }, "Cash balance can't be negative");
    }
  }

  for (const e of parsed.data) {
    await db
      .update(accounts)
      .set({ openingBalance: e.openingBalance })
      .where(eq(accounts.id, e.accountId));
  }

  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/reconcile");
  return okResult("Balances saved");
}

/** Persist first-run completion independently of balances, budgets, or transactions. */
export async function completeSetup(): Promise<ActionResult> {
  await requireAuth();
  await db
    .insert(appState)
    .values({ id: 1, setupCompleted: true, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appState.id,
      set: { setupCompleted: true, updatedAt: new Date() },
    });
  revalidatePath("/");
  return okResult();
}
