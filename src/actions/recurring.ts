"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { recurringTemplates, transactions, accounts, paymentMethods, categories } from "@/db/schema";
import { recurringInputSchema, fieldErrors } from "@/lib/validation";
import { requireAuth, okResult, errResult, type ActionResult } from "./shared";
import { normalizeTxn, ruleLookups, type RuleLookups, type TxnShape } from "@/lib/txn-rules";
import { shiftDate, todayIST } from "@/lib/dates";
import { currentOccurrence } from "@/lib/recurring";

/*
  Recurring templates never write transactions on their own — there is no cron and
  no background job. `logFromTemplate` is always user-initiated, and stamps
  `lastLoggedDate` so the occurrence stops showing as due.

  Every template goes through the same transaction rules as the Add form
  (lib/txn-rules) when it is saved AND when it is logged, since accounts can be
  archived or re-linked in between.
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

type TemplateInput = NonNullable<ReturnType<typeof parseTemplateForm>["data"]>;

async function loadRuleLookups(): Promise<RuleLookups> {
  const [accs, meths, cats] = await Promise.all([
    db
      .select({ id: accounts.id, type: accounts.type, isArchived: accounts.isArchived, sortOrder: accounts.sortOrder })
      .from(accounts),
    db
      .select({ id: paymentMethods.id, accountId: paymentMethods.accountId, isArchived: paymentMethods.isArchived })
      .from(paymentMethods),
    db.select({ id: categories.id, isArchived: categories.isArchived }).from(categories),
  ]);
  return ruleLookups(accs, meths, cats);
}

/** Validate a template's money fields; returns the cleaned ids or a form error. */
async function checkTemplate(d: TemplateInput): Promise<{ ok: true; shape: TxnShape } | { ok: false; result: ActionResult }> {
  const ruled = normalizeTxn(
    {
      type: d.type,
      categoryId: d.categoryId ?? null,
      methodId: d.methodId ?? null,
      fromAccountId: d.fromAccountId ?? null,
      toAccountId: d.toAccountId ?? null,
      incomeSource: d.incomeSource ?? null,
    },
    await loadRuleLookups(),
  );
  if (!ruled.ok) return { ok: false, result: errResult({ [ruled.field]: ruled.message }) };
  return { ok: true, shape: ruled.txn };
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
  const checked = await checkTemplate(d);
  if (!checked.ok) return checked.result;
  const s = checked.shape;

  await db.insert(recurringTemplates).values({
    title: d.title,
    // Keep the form's type ("expense"); the card-vs-bank split is derived at log time.
    type: d.type,
    amount: d.amount,
    categoryId: s.categoryId,
    methodId: s.methodId,
    fromAccountId: s.fromAccountId,
    toAccountId: s.toAccountId,
    incomeSource: s.incomeSource,
    recurrence: d.recurrence,
    dayOfMonth: d.dayOfMonth ?? null,
    dayOfWeek: d.dayOfWeek ?? null,
    monthOfYear: d.monthOfYear ?? null,
    // Count from today: an occurrence that passed before the template existed isn't overdue.
    lastLoggedDate: shiftDate(todayIST(), -1),
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
  const checked = await checkTemplate(d);
  if (!checked.ok) return checked.result;
  const s = checked.shape;

  await db
    .update(recurringTemplates)
    .set({
      title: d.title,
      type: d.type,
      amount: d.amount,
      categoryId: s.categoryId,
      methodId: s.methodId,
      fromAccountId: s.fromAccountId,
      toAccountId: s.toAccountId,
      incomeSource: s.incomeSource,
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
  const [t] = await db
    .select({ lastLoggedDate: recurringTemplates.lastLoggedDate })
    .from(recurringTemplates)
    .where(eq(recurringTemplates.id, id))
    .limit(1);
  if (!t) return errResult({ _: "Not found" }, "Recurring item not found");

  // Resuming starts fresh from today, so the paused months don't all come back as overdue.
  const resumeFrom = shiftDate(todayIST(), -1);
  const lastLoggedDate =
    !archived && (t.lastLoggedDate == null || t.lastLoggedDate < resumeFrom) ? resumeFrom : t.lastLoggedDate;

  await db
    .update(recurringTemplates)
    .set({ isArchived: archived, lastLoggedDate, updatedAt: new Date() })
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
 * bill) be corrected at log time without editing the template. The transaction is
 * rebuilt with the same rules as the Add form (SPEC §4): a template pointing at a
 * credit-card method logs `cc_spend`, and a withdrawal lands in the cash account.
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

  const ruled = normalizeTxn(
    {
      type: t.type,
      categoryId: t.categoryId,
      methodId: t.methodId,
      fromAccountId: t.fromAccountId,
      toAccountId: t.toAccountId,
      incomeSource: t.incomeSource,
    },
    await loadRuleLookups(),
  );
  if (!ruled.ok) {
    return errResult(
      { [ruled.field]: ruled.message },
      `Can't log ${t.title}: ${ruled.message.toLowerCase()}. Edit it in Settings.`,
    );
  }

  await db.insert(transactions).values({ ...ruled.txn, amount, date: safeDate, title: t.title });

  // Mark the OCCURRENCE handled, not the clamped log date: logging a few days early
  // would otherwise leave lastLoggedDate before the due date and offer it again.
  const handled = t.lastLoggedDate && t.lastLoggedDate > date ? t.lastLoggedDate : date;
  await db
    .update(recurringTemplates)
    .set({ lastLoggedDate: handled, updatedAt: new Date() })
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
