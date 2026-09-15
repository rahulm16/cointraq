import type { Budget, TxnEffect } from "./types";
import { heroForRange, categoryBreakdownRange } from "./aggregations";
import { daysInRange, inDateRange, monthRange } from "./dates";

/**
 * Budget math — pure, framework-free (SPEC §13 code layout).
 *
 * Budgets are a *calendar-month* concept: a cap for "2026-08" is compared against
 * that month's spending. The dashboard can show arbitrary ranges, so every helper
 * takes an explicit month key and derives its own range.
 *
 * "Pace" answers the question the raw total can't: am I on track? It compares
 * spend-so-far against the straight-line share of the budget that *should* be
 * gone by today. Elapsed days are inclusive of today, because today's spending
 * has already happened.
 */

export type BudgetStatus = "none" | "under" | "near" | "over";

/** Fraction of the budget at which we start warning (before it's actually blown). */
export const NEAR_THRESHOLD = 0.85;

export interface BudgetProgress {
  /** The cap, in whole rupees. */
  budget: number;
  /** Spent against it so far. */
  spent: number;
  /** budget − spent. Negative when overspent. */
  remaining: number;
  /** spent / budget, unclamped (can exceed 1). 0 when budget is 0. */
  ratio: number;
  status: BudgetStatus;
  /** Days counted so far in the month (inclusive of `asOf`). */
  daysElapsed: number;
  daysTotal: number;
  /** What *should* be spent by now at an even burn rate. */
  paceTarget: number;
  /**
   * spent − paceTarget. Negative = ahead (spending slower than the cap allows),
   * positive = behind (burning too fast).
   */
  paceDelta: number;
  /** Straight-line projection of the full month at the current burn rate. */
  projected: number;
  /** Rupees per remaining day to finish exactly at budget. 0 once overspent. */
  safeDailyRemaining: number;
}

/**
 * Progress for one cap.
 *
 * `asOf` clamps into the month: a past month is fully elapsed, a future month has
 * not started. This keeps pace honest when the user browses back through history.
 */
export function budgetProgress(budget: number, spent: number, month: string, asOf: string): BudgetProgress {
  const { start, end } = monthRange(month);
  const daysTotal = daysInRange(start, end);

  // Clamp the "today" marker into this month's bounds.
  const marker = asOf < start ? null : asOf > end ? end : asOf;
  const daysElapsed = marker === null ? 0 : daysInRange(start, marker);

  const ratio = budget > 0 ? spent / budget : 0;
  const paceTarget = budget > 0 && daysTotal > 0 ? Math.round((budget * daysElapsed) / daysTotal) : 0;
  const projected = daysElapsed > 0 ? Math.round((spent * daysTotal) / daysElapsed) : 0;

  const daysLeft = daysTotal - daysElapsed;
  const remaining = budget - spent;
  const safeDailyRemaining = daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft) : 0;

  let status: BudgetStatus = "none";
  if (budget > 0) {
    if (spent > budget) status = "over";
    else if (ratio >= NEAR_THRESHOLD) status = "near";
    else status = "under";
  }

  return {
    budget,
    spent,
    remaining,
    ratio,
    status,
    daysElapsed,
    daysTotal,
    paceTarget,
    paceDelta: spent - paceTarget,
    projected,
    safeDailyRemaining,
  };
}

export interface CategoryBudgetRow {
  categoryId: number;
  progress: BudgetProgress;
}

export interface MonthBudgets {
  /** The overall month cap, if one is set. */
  overall: BudgetProgress | null;
  /** Per-category caps that exist for this month, spent-desc. */
  categories: CategoryBudgetRow[];
  /** Spending in categories with no cap set — the blind spot. */
  uncappedSpend: number;
}

/**
 * Roll up every budget for a month against actual spending.
 *
 * The overall cap is compared against the hero formula (expense + bill_pay) so it
 * matches the number on the dashboard. Category caps use `expense` only, mirroring
 * the donut — bill_pay has no category by SPEC §4 rule 3.
 */
export function monthBudgets(
  budgets: Budget[],
  effects: TxnEffect[],
  month: string,
  asOf: string,
): MonthBudgets {
  const { start, end } = monthRange(month);
  const forMonth = budgets.filter((b) => b.month === month);

  const overallRow = forMonth.find((b) => b.categoryId === null) ?? null;
  const overall = overallRow
    ? budgetProgress(overallRow.amount, heroForRange(effects, start, end), month, asOf)
    : null;

  const { byCategory } = categoryBreakdownRange(effects, start, end);

  const categories: CategoryBudgetRow[] = forMonth
    .filter((b): b is Budget & { categoryId: number } => b.categoryId !== null)
    .map((b) => ({
      categoryId: b.categoryId,
      progress: budgetProgress(b.amount, byCategory.get(b.categoryId) ?? 0, month, asOf),
    }))
    .sort((a, b) => b.progress.spent - a.progress.spent);

  const capped = new Set(categories.map((c) => c.categoryId));
  let uncappedSpend = 0;
  for (const [cid, total] of byCategory) {
    if (cid === null || !capped.has(cid)) uncappedSpend += total;
  }

  return { overall, categories, uncappedSpend };
}

/**
 * Carry last month's caps forward as defaults when a month has none of its own.
 * Returns budget-shaped rows (id -1, not persisted) so the editor can show
 * suggestions the user confirms rather than an empty form every month.
 */
export function suggestedFromPreviousMonth(budgets: Budget[], month: string, prevMonth: string): Budget[] {
  if (budgets.some((b) => b.month === month)) return [];
  return budgets
    .filter((b) => b.month === prevMonth)
    .map((b) => ({ ...b, id: -1, month }));
}

/** Spending inside a month for one category — used by the budget editor's context line. */
export function categorySpendInMonth(effects: TxnEffect[], categoryId: number, month: string): number {
  const { start, end } = monthRange(month);
  let sum = 0;
  for (const t of effects) {
    if (t.type === "expense" && t.categoryId === categoryId && inDateRange(t.date, start, end)) {
      sum += t.amount;
    }
  }
  return sum;
}
