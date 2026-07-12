import type { TxnEffect } from "./types";
import { inDateRange, monthRange } from "./dates";

/**
 * The "hero" formula — Spends this month = Σ expense + Σ bill_pay.
 * NEVER includes cc_spend, transfer, withdrawal, income.  SPEC §7.
 * This is the single source of truth for what "counts as a spend".
 */
export function isHeroCountable(type: TxnEffect["type"]): boolean {
  return type === "expense" || type === "bill_pay";
}

/** Σ of hero-countable amounts across a set of transactions. */
export function heroTotal(txns: TxnEffect[]): number {
  let sum = 0;
  for (const t of txns) if (isHeroCountable(t.type)) sum += t.amount;
  return sum;
}

/** Hero total for an inclusive date range. */
export function heroForRange(txns: TxnEffect[], from: string, to: string): number {
  let sum = 0;
  for (const t of txns) {
    if (isHeroCountable(t.type) && inDateRange(t.date, from, to)) sum += t.amount;
  }
  return sum;
}

/** Hero total scoped to a "yyyy-MM" month. */
export function heroForMonth(txns: TxnEffect[], mk: string): number {
  const { start, end } = monthRange(mk);
  return heroForRange(txns, start, end);
}

/** Delta = this − previous (negative = spent less). */
export function heroDelta(txns: TxnEffect[], mk: string, prevMk: string): number {
  return heroForMonth(txns, mk) - heroForMonth(txns, prevMk);
}

export function heroDeltaForRange(
  txns: TxnEffect[],
  from: string,
  to: string,
  prevFrom: string,
  prevTo: string,
): number {
  return heroForRange(txns, from, to) - heroForRange(txns, prevFrom, prevTo);
}

/** Daily spend bars: hero formula grouped by date within a range. */
export function dailyHeroRange(txns: TxnEffect[], from: string, to: string): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const t of txns) {
    if (isHeroCountable(t.type) && inDateRange(t.date, from, to)) {
      byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amount);
    }
  }
  return byDay;
}

/** @deprecated Prefer dailyHeroRange — kept for callers that still pass a month key. */
export function dailyHero(txns: TxnEffect[], mk: string): Map<string, number> {
  const { start, end } = monthRange(mk);
  return dailyHeroRange(txns, start, end);
}

/**
 * Category donut: `expense` grouped by category id (null => "Uncategorized"
 * bucket, keyed as null), PLUS a synthetic "CC Bill" slice = Σ bill_pay.
 */
export function categoryBreakdownRange(
  txns: TxnEffect[],
  from: string,
  to: string,
): { byCategory: Map<number | null, number>; ccBill: number } {
  const byCategory = new Map<number | null, number>();
  let ccBill = 0;
  for (const t of txns) {
    if (!inDateRange(t.date, from, to)) continue;
    if (t.type === "expense") {
      byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + t.amount);
    } else if (t.type === "bill_pay") {
      ccBill += t.amount;
    }
  }
  return { byCategory, ccBill };
}

export function categoryBreakdown(
  txns: TxnEffect[],
  mk: string,
): { byCategory: Map<number | null, number>; ccBill: number } {
  const { start, end } = monthRange(mk);
  return categoryBreakdownRange(txns, start, end);
}

/** Top category = category with max Σ(expense only) in range. */
export function topCategoryRange(
  txns: TxnEffect[],
  from: string,
  to: string,
): { categoryId: number | null; total: number } | null {
  const sums = new Map<number | null, number>();
  for (const t of txns) {
    if (t.type === "expense" && inDateRange(t.date, from, to)) {
      sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) + t.amount);
    }
  }
  let best: { categoryId: number | null; total: number } | null = null;
  for (const [categoryId, total] of sums) {
    if (!best || total > best.total) best = { categoryId, total };
  }
  return best;
}

export function topCategory(
  txns: TxnEffect[],
  mk: string,
): { categoryId: number | null; total: number } | null {
  const { start, end } = monthRange(mk);
  return topCategoryRange(txns, start, end);
}

/** By-method bars: `expense` + `bill_pay` grouped by method id. */
export function byMethodRange(
  txns: TxnEffect[],
  from: string,
  to: string,
): Map<number | null, number> {
  const m = new Map<number | null, number>();
  for (const t of txns) {
    if (isHeroCountable(t.type) && inDateRange(t.date, from, to)) {
      m.set(t.methodId, (m.get(t.methodId) ?? 0) + t.amount);
    }
  }
  return m;
}

export function byMethod(txns: TxnEffect[], mk: string): Map<number | null, number> {
  const { start, end } = monthRange(mk);
  return byMethodRange(txns, start, end);
}

/** 6-month trend: hero total per month, oldest→newest, ending at `mk`. */
export function sixMonthTrend(
  txns: TxnEffect[],
  months: string[],
): { month: string; total: number }[] {
  return months.map((m) => ({ month: m, total: heroForMonth(txns, m) }));
}

/** CC section mini-breakdown: cc_spend grouped by category for a date range. */
export function ccSpendByCategory(
  txns: TxnEffect[],
  start: string,
  end: string,
): Map<number | null, number> {
  const m = new Map<number | null, number>();
  for (const t of txns) {
    if (t.type === "cc_spend" && t.date >= start && t.date <= end) {
      m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + t.amount);
    }
  }
  return m;
}
