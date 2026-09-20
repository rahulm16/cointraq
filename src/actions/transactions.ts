"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { transactions, accounts, paymentMethods, categories } from "@/db/schema";
import { requireAuth, okResult, errResult, type ActionResult } from "./shared";
import { amountSchema, dateSchema, titleSchema, incomeSourceSchema, fieldErrors } from "@/lib/validation";
import { todayIST } from "@/lib/dates";
import { deriveSpendType, categoryAllowed } from "@/lib/txn-rules";
import { INCOME_SOURCE_LABEL } from "@/lib/txn-display";
import type { AccountType, TransactionType } from "@/lib/types";

/*
  All transaction mutations. The client never sends a `type` for spends — the
  server derives expense vs cc_spend from the chosen method (SPEC §4 rule 1) and
  re-derives on edit if the method crosses the CC boundary. Every rule in §4 is
  enforced here, never trusting the client.
*/

// The form kinds the UI presents (tabs). "spend" splits into expense/cc_spend.
const FORM_KINDS = ["spend", "bill_pay", "transfer", "withdrawal", "income"] as const;
type FormKind = (typeof FORM_KINDS)[number];

interface Lookups {
  accountType: Map<number, AccountType>;
  methodAccountType: Map<number, AccountType>;
  methodAccountId: Map<number, number>;
  methodName: Map<number, string>;
  categoryIds: Set<number>;
}

async function loadLookups(allow?: {
  accountIds?: number[];
  methodId?: number | null;
  categoryId?: number | null;
}): Promise<Lookups> {
  const accs = await db.select({ id: accounts.id, type: accounts.type, isArchived: accounts.isArchived }).from(accounts);
  const meths = await db
    .select({ id: paymentMethods.id, accountId: paymentMethods.accountId, name: paymentMethods.name, isArchived: paymentMethods.isArchived })
    .from(paymentMethods);
  const cats = await db.select({ id: categories.id, isArchived: categories.isArchived }).from(categories);
  const allowedAccounts = new Set(allow?.accountIds ?? []);
  const existingMethodAccount = meths.find((m) => m.id === allow?.methodId)?.accountId;
  if (existingMethodAccount != null) allowedAccounts.add(existingMethodAccount);
  const usableAccounts = accs.filter((a) => !a.isArchived || allowedAccounts.has(a.id));
  const accountType = new Map(usableAccounts.map((a) => [a.id, a.type]));
  const usableMethods = meths.filter(
    (m) => (!m.isArchived || m.id === allow?.methodId) && accountType.has(m.accountId),
  );
  const methodAccountId = new Map(usableMethods.map((m) => [m.id, m.accountId]));
  const methodAccountType = new Map(
    usableMethods.map((m) => [m.id, accountType.get(m.accountId)!]),
  );
  const methodName = new Map(usableMethods.map((m) => [m.id, m.name]));
  const categoryIds = new Set(
    cats.filter((c) => !c.isArchived || c.id === allow?.categoryId).map((c) => c.id),
  );
  return { accountType, methodAccountType, methodAccountId, methodName, categoryIds };
}

function futureRejected(date: string): boolean {
  return date > todayIST();
}

/** Type-aware default when the user leaves title blank. */
function defaultTitle(
  kind: FormKind,
  ctx: { methodId?: number | null; incomeSource?: string | null; methodName: Map<number, string> },
): string {
  switch (kind) {
    case "spend":
      return (ctx.methodId != null ? ctx.methodName.get(ctx.methodId) : undefined) ?? "Spend";
    case "bill_pay":
      return "credit card bill";
    case "transfer":
      return "Transfer";
    case "withdrawal":
      return "Withdrawal";
    case "income":
      return INCOME_SOURCE_LABEL[ctx.incomeSource ?? "other"] ?? "Income";
  }
}

interface BuiltTxn {
  type: TransactionType;
  amount: number;
  date: string;
  title: string;
  categoryId: number | null;
  methodId: number | null;
  fromAccountId: number | null;
  toAccountId: number | null;
  incomeSource: "salary" | "refund" | "cashback" | "other" | null;
}

/** Validate one form-kind's fields and produce the canonical row. */
async function buildTxn(
  kind: FormKind,
  form: FormData,
  lk: Lookups,
): Promise<{ ok: true; txn: BuiltTxn } | { ok: false; errors: Record<string, string> }> {
  const base = z
    .object({ amount: amountSchema, date: dateSchema, title: titleSchema })
    .safeParse({
      amount: Number(form.get("amount")),
      date: String(form.get("date") ?? ""),
      title: (form.get("title") as string) || undefined,
    });
  if (!base.success) return { ok: false, errors: fieldErrors(base.error) };
  if (futureRejected(base.data.date)) return { ok: false, errors: { date: "Future dates aren't allowed" } };

  const amount = base.data.amount;
  const date = base.data.date;
  const typedTitle = base.data.title?.trim() ? base.data.title.trim() : null;

  const num = (k: string): number | null => {
    const v = form.get(k);
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isInteger(n) ? n : null;
  };

  switch (kind) {
    case "spend": {
      const methodId = num("methodId");
      if (methodId == null || !lk.methodAccountType.has(methodId))
        return { ok: false, errors: { methodId: "Pick a method" } };
      const methodType = lk.methodAccountType.get(methodId)!;
      const type = deriveSpendType(methodType);
      const categoryId = num("categoryId");
      if (categoryId != null && !lk.categoryIds.has(categoryId)) {
        return { ok: false, errors: { categoryId: "Pick an active category" } };
      }
      return {
        ok: true,
        txn: {
          type,
          amount,
          date,
          title: typedTitle ?? defaultTitle(kind, { methodId, methodName: lk.methodName }),
          categoryId: categoryAllowed(type) ? categoryId : null,
          methodId,
          fromAccountId: null,
          toAccountId: null,
          incomeSource: null,
        },
      };
    }

    case "bill_pay": {
      const methodId = num("methodId");
      const toAccountId = num("toAccountId");
      if (methodId == null || !lk.methodAccountType.has(methodId))
        return { ok: false, errors: { methodId: "Pick a method" } };
      // method must not be a credit-card method (can't pay a card with a card)
      if (lk.methodAccountType.get(methodId) === "credit_card")
        return { ok: false, errors: { methodId: "Can't pay a card with a card" } };
      if (toAccountId == null || lk.accountType.get(toAccountId) !== "credit_card")
        return { ok: false, errors: { toAccountId: "Choose the credit card being paid" } };
      return {
        ok: true,
        txn: {
          type: "bill_pay",
          amount,
          date,
          title: typedTitle ?? defaultTitle(kind, { methodName: lk.methodName }),
          categoryId: null,
          methodId,
          fromAccountId: null,
          toAccountId,
          incomeSource: null,
        },
      };
    }

    case "transfer": {
      const fromAccountId = num("fromAccountId");
      const toAccountId = num("toAccountId");
      // Unknown ids get a field error here instead of a foreign-key failure on insert.
      if (fromAccountId == null || !lk.accountType.has(fromAccountId))
        return { ok: false, errors: { fromAccountId: "Pick a source" } };
      if (toAccountId == null || !lk.accountType.has(toAccountId))
        return { ok: false, errors: { toAccountId: "Pick a destination" } };
      if (fromAccountId === toAccountId)
        return { ok: false, errors: { toAccountId: "Must differ from source" } };
      if (lk.accountType.get(fromAccountId) === "credit_card" || lk.accountType.get(toAccountId) === "credit_card")
        return { ok: false, errors: { toAccountId: "Transfers use non-credit accounts" } };
      return {
        ok: true,
        txn: {
          type: "transfer",
          amount,
          date,
          title: typedTitle ?? defaultTitle(kind, { methodName: lk.methodName }),
          categoryId: null,
          methodId: null,
          fromAccountId,
          toAccountId,
          incomeSource: null,
        },
      };
    }

    case "withdrawal": {
      const fromAccountId = num("fromAccountId");
      if (fromAccountId == null || lk.accountType.get(fromAccountId) !== "bank")
        return { ok: false, errors: { fromAccountId: "Pick a bank account" } };
      // Destination is the active cash account — the same one the dashboard's Cash
      // tile shows (lowest sort order if old data has more than one).
      const cash = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.type, "cash"), eq(accounts.isArchived, false)))
        .orderBy(asc(accounts.sortOrder), asc(accounts.id))
        .limit(1);
      if (!cash[0]) return { ok: false, errors: { _: "No cash account exists" } };
      return {
        ok: true,
        txn: {
          type: "withdrawal",
          amount,
          date,
          title: typedTitle ?? defaultTitle(kind, { methodName: lk.methodName }),
          categoryId: null,
          methodId: null,
          fromAccountId,
          toAccountId: cash[0].id,
          incomeSource: null,
        },
      };
    }

    case "income": {
      const toAccountId = num("toAccountId");
      const src = incomeSourceSchema.safeParse(String(form.get("incomeSource") ?? ""));
      if (toAccountId == null || lk.accountType.get(toAccountId) === "credit_card" || !lk.accountType.has(toAccountId))
        return { ok: false, errors: { toAccountId: "Pick where it landed" } };
      if (!src.success) return { ok: false, errors: { incomeSource: "Pick a source" } };
      return {
        ok: true,
        txn: {
          type: "income",
          amount,
          date,
          title: typedTitle ?? defaultTitle(kind, { incomeSource: src.data, methodName: lk.methodName }),
          categoryId: null,
          methodId: null,
          fromAccountId: null,
          toAccountId,
          incomeSource: src.data,
        },
      };
    }
  }
}

function kindFromForm(form: FormData): FormKind | null {
  const k = String(form.get("kind") ?? "");
  return (FORM_KINDS as readonly string[]).includes(k) ? (k as FormKind) : null;
}

export async function createTransaction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAuth();
  const kind = kindFromForm(form);
  if (!kind) return errResult({ _: "Unknown form" });

  const lk = await loadLookups();
  const built = await buildTxn(kind, form, lk);
  if (!built.ok) return errResult(built.errors);

  await db.insert(transactions).values(built.txn);
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/add");
  return okResult("Saved");
}

export async function updateTransaction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAuth();
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return errResult({ _: "Bad id" });
  const kind = kindFromForm(form);
  if (!kind) return errResult({ _: "Unknown form" });

  const [existing] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!existing) {
    const message = "This transaction no longer exists";
    return errResult({ _: message }, message);
  }
  const lk = await loadLookups({
    accountIds: [existing.fromAccountId, existing.toAccountId].filter((value): value is number => value != null),
    methodId: existing.methodId,
    categoryId: existing.categoryId,
  });
  const built = await buildTxn(kind, form, lk);
  if (!built.ok) return errResult(built.errors);

  const updated = await db
    .update(transactions)
    .set({ ...built.txn, updatedAt: new Date() })
    .where(eq(transactions.id, id))
    .returning({ id: transactions.id });
  if (updated.length === 0) return errResult({ _: "This transaction no longer exists" });
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/add");
  return okResult("Updated");
}

export async function deleteTransaction(id: number): Promise<ActionResult> {
  await requireAuth();
  await db.delete(transactions).where(eq(transactions.id, id));
  revalidatePath("/");
  revalidatePath("/transactions");
  return okResult("Deleted");
}

/**
 * Delete, returning the full row so the client can offer an Undo that recreates
 * it. Simpler than a soft-delete column: nothing else in the app has to learn to
 * filter out tombstones, and the undo window lives entirely in the toast.
 */
export async function deleteTransactionWithUndo(
  id: number,
): Promise<ActionResult & { restore?: BuiltTxn }> {
  await requireAuth();
  const [row] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  if (!row) return errResult({ _: "Not found" }, "Not found");

  await db.delete(transactions).where(eq(transactions.id, id));
  revalidatePath("/");
  revalidatePath("/transactions");

  return {
    ...okResult("Deleted"),
    restore: {
      type: row.type,
      amount: row.amount,
      date: row.date,
      title: row.title,
      categoryId: row.categoryId,
      methodId: row.methodId,
      fromAccountId: row.fromAccountId,
      toAccountId: row.toAccountId,
      incomeSource: row.incomeSource,
    },
  };
}

/** Re-insert a row captured by `deleteTransactionWithUndo`. */
export async function restoreTransaction(txn: BuiltTxn): Promise<ActionResult> {
  await requireAuth();
  const parsed = z
    .object({
      type: z.enum(["expense", "cc_spend", "bill_pay", "transfer", "withdrawal", "income"]),
      amount: amountSchema,
      date: dateSchema,
      title: z.string().trim().min(1),
      categoryId: z.number().int().positive().nullable(),
      methodId: z.number().int().positive().nullable(),
      fromAccountId: z.number().int().positive().nullable(),
      toAccountId: z.number().int().positive().nullable(),
      incomeSource: incomeSourceSchema.nullable(),
    })
    .safeParse(txn);
  if (!parsed.success) return errResult(fieldErrors(parsed.error));

  await db.insert(transactions).values(parsed.data);
  revalidatePath("/");
  revalidatePath("/transactions");
  return okResult("Restored");
}

/**
 * One-tap logging from a quick-add chip. Takes only what a chip carries and
 * re-derives everything else server-side — the spend type from the method's
 * account (SPEC §4 rule 1), and the date clamped to today so a stale client
 * can't post into the future.
 */
export async function quickLog(input: {
  title: string;
  amount: number;
  categoryId: number | null;
  methodId: number | null;
  date: string;
}): Promise<ActionResult> {
  await requireAuth();

  const parsed = z
    .object({
      title: z.string().trim().min(1).max(200),
      amount: amountSchema,
      categoryId: z.number().int().positive().nullable(),
      methodId: z.number().int().positive().nullable(),
      date: dateSchema,
    })
    .safeParse(input);
  if (!parsed.success) return errResult(fieldErrors(parsed.error));

  const d = parsed.data;
  if (futureRejected(d.date)) return errResult({ date: "Future dates are not allowed" });

  const lk = await loadLookups();
  const methodType = d.methodId != null ? lk.methodAccountType.get(d.methodId) : undefined;
  if (d.methodId != null && !methodType) return errResult({ methodId: "Unknown method" });

  const type = deriveSpendType(methodType ?? ("bank" as AccountType));

  await db.insert(transactions).values({
    type,
    amount: d.amount,
    date: d.date,
    title: d.title,
    categoryId: categoryAllowed(type) ? d.categoryId : null,
    methodId: d.methodId,
    fromAccountId: null,
    toAccountId: null,
    incomeSource: null,
  });

  revalidatePath("/");
  revalidatePath("/transactions");
  return okResult("Logged");
}

/** Reassign many transactions to one category at once (bulk edit, P6). */
export async function bulkSetCategory(ids: number[], categoryId: number | null): Promise<ActionResult> {
  await requireAuth();
  const clean = ids.filter((id) => Number.isInteger(id));
  if (clean.length === 0) return errResult({ _: "Nothing selected" });
  if (categoryId !== null) {
    const [cat] = Number.isInteger(categoryId)
      ? await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).limit(1)
      : [];
    if (!cat) {
      const message = "That category no longer exists";
      return errResult({ _: message }, message);
    }
  }

  // Only expense/cc_spend may carry a category (SPEC §4 rule 3) — skip the rest
  // rather than silently dropping the value.
  const rows = await db
    .select({ id: transactions.id, type: transactions.type })
    .from(transactions)
    .where(inArray(transactions.id, clean));

  const eligible = rows.filter((r) => categoryAllowed(r.type)).map((r) => r.id);
  if (eligible.length === 0) return errResult({ _: "No eligible transactions" }, "Categories apply to spends only");

  await db
    .update(transactions)
    .set({ categoryId, updatedAt: new Date() })
    .where(inArray(transactions.id, eligible));

  revalidatePath("/");
  revalidatePath("/transactions");

  const skipped = clean.length - eligible.length;
  return okResult(
    skipped > 0
      ? `Updated ${eligible.length}, skipped ${skipped} non-spend`
      : `Updated ${eligible.length}`,
  );
}

/** Delete many at once. */
export async function bulkDelete(ids: number[]): Promise<ActionResult> {
  await requireAuth();
  const clean = ids.filter((id) => Number.isInteger(id));
  if (clean.length === 0) return errResult({ _: "Nothing selected" });

  await db.delete(transactions).where(inArray(transactions.id, clean));
  revalidatePath("/");
  revalidatePath("/transactions");
  return okResult(`Deleted ${clean.length}`);
}
