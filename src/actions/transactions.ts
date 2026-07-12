"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { transactions, accounts, paymentMethods } from "@/db/schema";
import { requireAuth, okResult, errResult, type ActionResult } from "./shared";
import { amountSchema, dateSchema, noteSchema, incomeSourceSchema, fieldErrors } from "@/lib/validation";
import { todayIST } from "@/lib/dates";
import { deriveSpendType, categoryAllowed } from "@/lib/txn-rules";
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
}

async function loadLookups(): Promise<Lookups> {
  const accs = await db.select({ id: accounts.id, type: accounts.type }).from(accounts);
  const meths = await db
    .select({ id: paymentMethods.id, accountId: paymentMethods.accountId })
    .from(paymentMethods);
  const accountType = new Map(accs.map((a) => [a.id, a.type]));
  const methodAccountId = new Map(meths.map((m) => [m.id, m.accountId]));
  const methodAccountType = new Map(
    meths.map((m) => [m.id, accountType.get(m.accountId) ?? ("bank" as AccountType)]),
  );
  return { accountType, methodAccountType, methodAccountId };
}

function futureRejected(date: string): boolean {
  return date > todayIST();
}

interface BuiltTxn {
  type: TransactionType;
  amount: number;
  date: string;
  note: string | null;
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
    .object({ amount: amountSchema, date: dateSchema, note: noteSchema })
    .safeParse({
      amount: Number(form.get("amount")),
      date: String(form.get("date") ?? ""),
      note: (form.get("note") as string) || undefined,
    });
  if (!base.success) return { ok: false, errors: fieldErrors(base.error) };
  if (futureRejected(base.data.date)) return { ok: false, errors: { date: "Future dates aren't allowed" } };

  const amount = base.data.amount;
  const date = base.data.date;
  const note = base.data.note?.trim() ? base.data.note.trim() : null;

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
      return {
        ok: true,
        txn: {
          type,
          amount,
          date,
          note,
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
          note: note ?? "credit card bill",
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
      if (fromAccountId == null) return { ok: false, errors: { fromAccountId: "Pick a source" } };
      if (toAccountId == null) return { ok: false, errors: { toAccountId: "Pick a destination" } };
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
          note,
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
      // Destination is the single cash account.
      const cash = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.type, "cash")).limit(1);
      if (!cash[0]) return { ok: false, errors: { _: "No cash account exists" } };
      return {
        ok: true,
        txn: {
          type: "withdrawal",
          amount,
          date,
          note,
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
          note,
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
  return okResult("Saved");
}

export async function updateTransaction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAuth();
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return errResult({ _: "Bad id" });
  const kind = kindFromForm(form);
  if (!kind) return errResult({ _: "Unknown form" });

  const lk = await loadLookups();
  const built = await buildTxn(kind, form, lk);
  if (!built.ok) return errResult(built.errors);

  await db
    .update(transactions)
    .set({ ...built.txn, updatedAt: new Date() })
    .where(eq(transactions.id, id));
  revalidatePath("/");
  revalidatePath("/transactions");
  return okResult("Updated");
}

export async function deleteTransaction(id: number): Promise<ActionResult> {
  await requireAuth();
  await db.delete(transactions).where(eq(transactions.id, id));
  revalidatePath("/");
  revalidatePath("/transactions");
  return okResult("Deleted");
}
