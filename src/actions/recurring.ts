"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { recurringTemplates, transactions, accounts, paymentMethods } from "@/db/schema";
import { recurringInputSchema, fieldErrors } from "@/lib/validation";
import { requireAuth, okResult, errResult, type ActionResult } from "./shared";
import { deriveSpendType, categoryAllowed } from "@/lib/txn-rules";
import { todayIST } from "@/lib/dates";
import { currentOccurrence } from "@/lib/recurring";
import type { AccountType } from "@/lib/types";

/*
  Recurring templates never write transactions on their own — there is no cron and
  no background job. `logFromTemplate` is always user-initiated, and stamps
  `lastLoggedDate` so the occurrence stops showing as due.
*/

function num(form: FormData, key: string): number | null {
  const raw = String(form.get(key) ?? "");
  if (raw === "" || raw === "none") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseTemplateForm(formData: FormData) {
  const recurrence = String(formData.get("recurrence") ?? "monthly");
  return recurringInputSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    type: String(formData.get("type") ?? "expense"),
    amount: Number(formData.get("amount") ?? 0),
    categoryId: num(formData, "categoryId"),
    methodId: num(formData, "methodId"),
    fromAccountId: num(formData, "fromAccountId"),
    toAccountId: num(formData, "toAccountId"),
    incomeSource: (formData.get("incomeSource") as string) || null,
    recurrence,
    dayOfMonth: recurrence === "weekly" ? null : num(formData, "dayOfMonth"),
    dayOfWeek: recurrence === "weekly" ? num(formData, "dayOfWeek") : null,
    monthOfYear: recurrence === "yearly" ? num(formData, "monthOfYear") : null,
  });
}

function revalidateRecurring() {
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/transactions");
}

export async function createRecurring(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const parsed = parseTemplateForm(formData);
  if (!parsed.success) return errResult(fieldErrors(parsed.error));

  const d = parsed.data;
  await db.insert(recurringTemplates).values({
    title: d.title,
    type: d.type,
    amount: d.amount,
    categoryId: categoryAllowed(d.type) ? (d.categoryId ?? null) : null,
    methodId: d.methodId ?? null,
    fromAccountId: d.fromAccountId ?? null,
    toAccountId: d.toAccountId ?? null,
    incomeSource: d.type === "income" ? (d.incomeSource ?? null) : null,
    recurrence: d.recurrence,
    dayOfMonth: d.dayOfMonth ?? null,
    dayOfWeek: d.dayOfWeek ?? null,
    monthOfYear: d.monthOfYear ?? null,
  });

  revalidateRecurring();
  return okResult("Recurring added");
}

export async function updateRecurring(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return errResult({ _: "Bad id" });

  const parsed = parseTemplateForm(formData);
  if (!parsed.success) return errResult(fieldErrors(parsed.error));

  const d = parsed.data;
  await db
    .update(recurringTemplates)
    .set({
      title: d.title,
      type: d.type,
      amount: d.amount,
      categoryId: categoryAllowed(d.type) ? (d.categoryId ?? null) : null,
      methodId: d.methodId ?? null,
      fromAccountId: d.fromAccountId ?? null,
      toAccountId: d.toAccountId ?? null,
      incomeSource: d.type === "income" ? (d.incomeSource ?? null) : null,
      recurrence: d.recurrence,
      dayOfMonth: d.dayOfMonth ?? null,
      dayOfWeek: d.dayOfWeek ?? null,
      monthOfYear: d.monthOfYear ?? null,
      updatedAt: new Date(),
    })
    .where(eq(recurringTemplates.id, id));

  revalidateRecurring();
  return okResult("Recurring saved");
}

export async function setRecurringArchived(id: number, archived: boolean): Promise<ActionResult> {
  await requireAuth();
  await db
    .update(recurringTemplates)
    .set({ isArchived: archived, updatedAt: new Date() })
    .where(eq(recurringTemplates.id, id));
  revalidateRecurring();
  return okResult(archived ? "Paused" : "Resumed");
}

export async function deleteRecurring(id: number): Promise<ActionResult> {
  await requireAuth();
  if (!Number.isInteger(id)) return errResult({ _: "Bad id" });
  await db.delete(recurringTemplates).where(eq(recurringTemplates.id, id));
  revalidateRecurring();
  return okResult("Recurring deleted");
}

/**
 * Log one occurrence of a template as a real transaction — the one-tap action on
 * the dashboard's Due strip.
 *
 * `amountOverride` lets a variable bill (an EMI that changed, a higher electricity
 * bill) be corrected at log time without editing the template. The spend type is
 * re-derived from the method exactly as the Add form does (SPEC §4 rule 1), so a
 * template pointing at a credit-card method correctly logs `cc_spend`.
 */
export async function logFromTemplate(
  id: number,
  opts?: { date?: string; amountOverride?: number },
): Promise<ActionResult> {
  await requireAuth();

  const [t] = await db.select().from(recurringTemplates).where(eq(recurringTemplates.id, id)).limit(1);
  if (!t) return errResult({ _: "Not found" }, "Template not found");

  const today = todayIST();
  const date = opts?.date ?? currentOccurrence(mapForOccurrence(t), today) ?? today;

  // Never log into the future — the same rule the Add form enforces (SPEC §2).
  const safeDate = date > today ? today : date;

  const amount = opts?.amountOverride ?? t.amount;
  if (!Number.isInteger(amount) || amount < 1) return errResult({ amount: "Invalid amount" });

  // Re-derive expense vs cc_spend from the method's account type.
  let type = t.type;
  if (t.type === "expense" && t.methodId != null) {
    const [m] = await db
      .select({ accountId: paymentMethods.accountId })
      .from(paymentMethods)
      .where(eq(paymentMethods.id, t.methodId))
      .limit(1);
    if (m) {
      const [a] = await db
        .select({ type: accounts.type })
        .from(accounts)
        .where(eq(accounts.id, m.accountId))
        .limit(1);
      if (a) type = deriveSpendType(a.type as AccountType);
    }
  }

  await db.insert(transactions).values({
    type,
    amount,
    date: safeDate,
    title: t.title,
    categoryId: categoryAllowed(type) ? t.categoryId : null,
    methodId: t.methodId,
    fromAccountId: t.fromAccountId,
    toAccountId: t.toAccountId,
    incomeSource: type === "income" ? t.incomeSource : null,
  });

  await db
    .update(recurringTemplates)
    .set({ lastLoggedDate: safeDate, updatedAt: new Date() })
    .where(eq(recurringTemplates.id, id));

  revalidateRecurring();
  return okResult(`Logged ${t.title}`);
}

/** Mark an occurrence handled without creating a transaction (e.g. skipped a month). */
export async function skipOccurrence(id: number): Promise<ActionResult> {
  await requireAuth();
  const [t] = await db.select().from(recurringTemplates).where(eq(recurringTemplates.id, id)).limit(1);
  if (!t) return errResult({ _: "Not found" });

  const due = currentOccurrence(mapForOccurrence(t), todayIST());
  if (!due) return errResult({ _: "Nothing due" });

  await db
    .update(recurringTemplates)
    .set({ lastLoggedDate: due, updatedAt: new Date() })
    .where(eq(recurringTemplates.id, id));

  revalidateRecurring();
  return okResult("Skipped");
}

/** Narrow a DB row to the shape the pure scheduling helpers expect. */
function mapForOccurrence(r: typeof recurringTemplates.$inferSelect) {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    amount: r.amount,
    categoryId: r.categoryId,
    methodId: r.methodId,
    fromAccountId: r.fromAccountId,
    toAccountId: r.toAccountId,
    incomeSource: r.incomeSource,
    recurrence: r.recurrence,
    dayOfMonth: r.dayOfMonth,
    dayOfWeek: r.dayOfWeek,
    monthOfYear: r.monthOfYear,
    lastLoggedDate: r.lastLoggedDate,
    isArchived: r.isArchived,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
