"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { snapshots, accounts, paymentMethods, transactions } from "@/db/schema";
import { requireAuth, okResult, errResult, type ActionResult } from "./shared";
import { dateSchema } from "@/lib/validation";
import { todayIST } from "@/lib/dates";
import { accountExpected } from "@/lib/compute";
import type { Account, Snapshot, TxnEffect } from "@/lib/types";
import { AMOUNT_MAX } from "@/lib/constants";

const entrySchema = z.object({
  accountId: z.number().int().positive(),
  // Negative is real: an overdrawn account.
  actual: z.number().int().min(-AMOUNT_MAX).max(AMOUNT_MAX),
});

/**
 * Save reconciliation snapshots (SPEC §8). For each touched account we compute
 * expected as of the chosen date at save time and freeze it, so history stays
 * truthful even if transactions are later edited. Bank & cash only (CC excluded).
 */
export async function saveSnapshots(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAuth();

  const dateParsed = dateSchema.safeParse(String(form.get("date") ?? ""));
  if (!dateParsed.success) return errResult({ date: "Invalid date" });
  const date = dateParsed.data;
  if (date > todayIST()) return errResult({ date: "Can't reconcile a future date" });

  // Collect entries: fields named actual_<accountId>. Skip untouched (empty).
  const entries: { accountId: number; actual: number }[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("actual_")) continue;
    const str = String(value).trim();
    if (str === "") continue; // untouched
    const accountId = Number(key.slice("actual_".length));
    const actual = Number(str);
    const parsed = entrySchema.safeParse({ accountId, actual });
    if (!parsed.success) return errResult({ [key]: "Enter a whole rupee amount" });
    entries.push(parsed.data);
  }

  if (entries.length === 0) return errResult({ _: "Enter at least one balance." });

  // Load data to compute expected per account.
  const [accs, methods, effectRows] = await Promise.all([
    db.select().from(accounts),
    db.select({ id: paymentMethods.id, accountId: paymentMethods.accountId }).from(paymentMethods),
    db
      .select({
        type: transactions.type,
        amount: transactions.amount,
        date: transactions.date,
        methodId: transactions.methodId,
        fromAccountId: transactions.fromAccountId,
        toAccountId: transactions.toAccountId,
        categoryId: transactions.categoryId,
        createdAt: transactions.createdAt,
      })
      .from(transactions),
  ]);
  const effects = effectRows as TxnEffect[];
  const priorSnapshots = (await db.select().from(snapshots)).map((s) => ({
    id: s.id,
    accountId: s.accountId,
    date: s.date,
    actualBalance: s.actualBalance,
    expectedBalance: s.expectedBalance,
    createdAt: s.createdAt,
  })) as Snapshot[];

  const accById = new Map(accs.map((a) => [a.id, a as unknown as Account]));

  for (const entry of entries) {
    const acc = accById.get(entry.accountId);
    if (acc?.type === "cash" && entry.actual < 0) {
      return errResult({ [`actual_${entry.accountId}`]: "Cash balance can't be negative" });
    }
  }

  const rows = entries
    .map((e) => {
      const acc = accById.get(e.accountId);
      if (!acc || acc.type === "credit_card") return null; // CC excluded from snapshots
      const expected = accountExpected(acc, date, effects, priorSnapshots, methods);
      return { accountId: e.accountId, date, actualBalance: e.actual, expectedBalance: expected };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) return errResult({ _: "No valid accounts to snapshot." });

  await db.insert(snapshots).values(rows);
  revalidatePath("/reconcile");
  revalidatePath("/");
  return okResult("Snapshot saved");
}

export async function deleteSnapshotGroup(date: string): Promise<ActionResult> {
  await requireAuth();
  // A "group" in the UI = all snapshots saved on the same date. Delete them.
  await db.delete(snapshots).where(eq(snapshots.date, date));
  revalidatePath("/reconcile");
  revalidatePath("/");
  return okResult("Snapshot deleted");
}
