"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { budgets } from "@/db/schema";
import { budgetInputSchema, fieldErrors } from "@/lib/validation";
import { requireAuth, okResult, errResult, type ActionResult } from "./shared";

/*
  Budget mutations. A budget is keyed by (categoryId, month) with a null category
  meaning the overall month cap — so every write is an upsert on that pair, and
  an amount of 0 deletes the row rather than storing a meaningless zero cap.
*/

function parseBudgetForm(formData: FormData) {
  const raw = String(formData.get("categoryId") ?? "");
  return budgetInputSchema.safeParse({
    categoryId: raw === "" || raw === "overall" ? null : Number(raw),
    month: String(formData.get("month") ?? ""),
    amount: Number(formData.get("amount") ?? 0),
  });
}

/** Match on (categoryId, month), handling the NULL category explicitly. */
function whereBudget(categoryId: number | null, month: string) {
  return categoryId === null
    ? and(isNull(budgets.categoryId), eq(budgets.month, month))
    : and(eq(budgets.categoryId, categoryId), eq(budgets.month, month));
}

async function upsertBudget(categoryId: number | null, month: string, amount: number): Promise<void> {
  const existing = await db.select({ id: budgets.id }).from(budgets).where(whereBudget(categoryId, month)).limit(1);

  // Zero means "no cap" — remove the row so the UI shows an unset state.
  if (amount === 0) {
    if (existing.length) await db.delete(budgets).where(eq(budgets.id, existing[0].id));
    return;
  }

  if (existing.length) {
    await db.update(budgets).set({ amount, updatedAt: new Date() }).where(eq(budgets.id, existing[0].id));
  } else {
    await db.insert(budgets).values({ categoryId, month, amount });
  }
}

function revalidateBudgets() {
  revalidatePath("/");
  revalidatePath("/budgets");
  revalidatePath("/settings");
}

export async function saveBudget(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const parsed = parseBudgetForm(formData);
  if (!parsed.success) return errResult(fieldErrors(parsed.error));

  const { categoryId, month, amount } = parsed.data;
  await upsertBudget(categoryId, month, amount);
  revalidateBudgets();
  return okResult(amount === 0 ? "Budget cleared" : "Budget saved");
}

/** Inline editor: set one cap without a full form round-trip. */
export async function setBudget(
  categoryId: number | null,
  month: string,
  amount: number,
): Promise<ActionResult> {
  await requireAuth();
  const parsed = budgetInputSchema.safeParse({ categoryId, month, amount });
  if (!parsed.success) return errResult(fieldErrors(parsed.error));

  await upsertBudget(parsed.data.categoryId, parsed.data.month, parsed.data.amount);
  revalidateBudgets();
  return okResult(parsed.data.amount === 0 ? "Budget cleared" : "Budget saved");
}

/**
 * Copy every cap from `fromMonth` into `toMonth`, skipping any the target month
 * already defines. Powers the "carry forward last month's budgets" action, so a
 * new month doesn't start as an empty form.
 */
export async function copyBudgetsFromMonth(fromMonth: string, toMonth: string): Promise<ActionResult> {
  await requireAuth();
  const source = await db.select().from(budgets).where(eq(budgets.month, fromMonth));
  if (source.length === 0) return errResult({ _: "Nothing to copy" }, "No budgets in that month");

  const target = await db.select().from(budgets).where(eq(budgets.month, toMonth));
  const taken = new Set(target.map((b) => String(b.categoryId ?? "overall")));

  const rows = source
    .filter((b) => !taken.has(String(b.categoryId ?? "overall")))
    .map((b) => ({ categoryId: b.categoryId, month: toMonth, amount: b.amount }));

  if (rows.length === 0) return okResult("Already up to date");

  await db.insert(budgets).values(rows);
  revalidateBudgets();
  return okResult(`Copied ${rows.length} ${rows.length === 1 ? "budget" : "budgets"}`);
}

export async function deleteBudget(id: number): Promise<ActionResult> {
  await requireAuth();
  if (!Number.isInteger(id)) return errResult({ _: "Bad id" });
  await db.delete(budgets).where(eq(budgets.id, id));
  revalidateBudgets();
  return okResult("Budget removed");
}
