import type { Category, PaymentMethod, TxnEffect } from "./types";
import { heroForMonth, heroForRange, categoryBreakdownRange, byMethodRange, isHeroCountable } from "./aggregations";
import {
  daysInRange,
  inDateRange,
  isFullMonthRange,
  monthKey,
  monthRange,
  parseDate,
  shiftMonth,
  toDateStr,
  formatDayShort,
} from "./dates";
import { subMonths } from "date-fns";

/**
 * Insight cards — observations derived from data the dashboard already loads.
 * No new tables, no new queries. Each generator returns null when it has nothing
 * honest to say; the caller takes the top N by weight.
 *
 * Rule: an insight must tell the user something the raw numbers don't. "You spent
 * ₹42,000" is not an insight; "Food is up 34% against your 3-month average" is.
 */

export type InsightTone = "neutral" | "good" | "warn";

export interface Insight {
  id: string;
  /** Short headline — the observation itself. */
  text: string;
  /** Optional supporting clause. */
  detail?: string;
  tone: InsightTone;
  /** Higher wins when picking which cards to show. */
  weight: number;
}

const MIN_HISTORY_MONTHS = 2;
/** Ignore swings on trivial amounts — noise, not signal. */
const MIN_MEANINGFUL_AMOUNT = 500;

export interface InsightInput {
  effects: TxnEffect[];
  categories: Category[];
  methods: PaymentMethod[];
  from: string;
  to: string;
  today: string;
}

/**
 * The same slice of an earlier period, `i` months back, so a comparison is always
 * like-for-like: a finished month against whole earlier months, a month in
 * progress against the same first N days of earlier months, and any other range
 * against the same dates shifted back.
 */
function earlierWindow(from: string, end: string, to: string, i: number): { from: string; to: string } {
  if (isFullMonthRange({ from, to })) {
    const { start, end: monthEnd } = monthRange(shiftMonth(monthKey(from), -i));
    if (end === to) return { from: start, to: monthEnd };
    const cut = `${start.slice(0, 8)}${end.slice(8, 10)}`;
    return { from: start, to: cut < monthEnd ? cut : monthEnd };
  }
  return {
    from: toDateStr(subMonths(parseDate(from), i)),
    to: toDateStr(subMonths(parseDate(end), i)),
  };
}

/** Category spending in this period vs the same slice of the preceding 3 months. */
function categoryTrend(input: InsightInput): Insight | null {
  const { effects, categories, from, to, today } = input;
  // Only days that have happened count — a month in progress isn't a whole month.
  const end = to < today ? to : today;
  if (end < from) return null;

  const { byCategory } = categoryBreakdownRange(effects, from, end);
  const history = [1, 2, 3].map((i) => {
    const w = earlierWindow(from, end, to, i);
    return categoryBreakdownRange(effects, w.from, w.to).byCategory;
  });

  let best: Insight | null = null;
  for (const [cid, current] of byCategory) {
    if (cid === null || current < MIN_MEANINGFUL_AMOUNT) continue;

    const months = history.map((b) => b.get(cid) ?? 0).filter((p) => p > 0);
    if (months.length < MIN_HISTORY_MONTHS) continue;

    const avg = months.reduce((a, b) => a + b, 0) / months.length;
    if (avg < MIN_MEANINGFUL_AMOUNT) continue;

    const pct = Math.round(((current - avg) / avg) * 100);
    if (Math.abs(pct) < 20) continue;

    const name = categories.find((c) => c.id === cid)?.name ?? "Uncategorized";
    const up = pct > 0;
    const candidate: Insight = {
      id: `cat-trend-${cid}`,
      text: `${name} is ${up ? "up" : "down"} ${Math.abs(pct)}%`,
      detail: `against your ${months.length}-month average`,
      tone: up ? "warn" : "good",
      weight: Math.abs(pct),
    };
    if (!best || candidate.weight > best.weight) best = candidate;
  }
  return best;
}

/** How many days in the period had any spending — a logging-consistency signal. */
function spendingDays(input: InsightInput): Insight | null {
  const { effects, from, to, today } = input;
  const end = to < today ? to : today;
  if (end < from) return null;

  const days = new Set<string>();
  for (const t of effects) {
    if (isHeroCountable(t.type) && inDateRange(t.date, from, end)) days.add(t.date);
  }
  const total = daysInRange(from, end);
  if (total < 7 || days.size === 0) return null;

  const spent = days.size;
  const free = total - spent;
  // A high no-spend count is worth celebrating; a near-total is worth noticing.
  return {
    id: "spending-days",
    text: `You spent on ${spent} of ${total} days`,
    detail: free > 0 ? `${free} no-spend ${free === 1 ? "day" : "days"}` : "no no-spend days",
    tone: free >= total * 0.3 ? "good" : "neutral",
    weight: 30,
  };
}

/** Concentration: the share of spending flowing through one payment method. */
function methodConcentration(input: InsightInput): Insight | null {
  const { effects, methods, from, to } = input;
  const bars = byMethodRange(effects, from, to);
  let total = 0;
  for (const v of bars.values()) total += v;
  if (total < MIN_MEANINGFUL_AMOUNT) return null;

  let topId: number | null = null;
  let topVal = 0;
  for (const [mid, v] of bars) {
    if (v > topVal) {
      topVal = v;
      topId = mid;
    }
  }
  if (topId === null) return null;

  const pct = Math.round((topVal / total) * 100);
  if (pct < 50) return null;

  const name = methods.find((m) => m.id === topId)?.name ?? "one method";
  return {
    id: "method-concentration",
    text: `${name} is ${pct}% of your spending`,
    tone: "neutral",
    weight: pct - 20,
  };
}

/** The single largest spend in the period — often the thing worth remembering. */
function biggestSpend(input: InsightInput): Insight | null {
  const { effects, from, to } = input;
  let top: TxnEffect | null = null;
  for (const t of effects) {
    if (!isHeroCountable(t.type) || !inDateRange(t.date, from, to)) continue;
    if (!top || t.amount > top.amount) top = t;
  }
  if (!top || top.amount < MIN_MEANINGFUL_AMOUNT) return null;

  const total = heroForRange(effects, from, to);
  const share = total > 0 ? Math.round((top.amount / total) * 100) : 0;
  if (share < 15) return null;

  return {
    id: "biggest-spend",
    text: `One spend was ${share}% of the period`,
    detail: `on ${formatDayShort(top.date)}`,
    tone: share >= 40 ? "warn" : "neutral",
    weight: share,
  };
}

/** Month-over-month direction across finished months, stated as a streak when it holds. */
function monthStreak(input: InsightInput): Insight | null {
  const { effects, from, today } = input;
  // A month still in progress would always look like a fall — start from the last finished one.
  let mk = monthKey(from);
  if (monthRange(mk).end >= today) mk = shiftMonth(mk, -1);
  const totals = [0, 1, 2, 3].map((i) => heroForMonth(effects, shiftMonth(mk, -i)));
  if (totals.slice(1).every((t) => t === 0)) return null;

  let falling = 0;
  for (let i = 0; i < totals.length - 1; i++) {
    if (totals[i] > 0 && totals[i + 1] > 0 && totals[i] < totals[i + 1]) falling++;
    else break;
  }
  if (falling < 2) return null;

  return {
    id: "month-streak",
    text: `Spending has fallen ${falling} months running`,
    tone: "good",
    weight: 40 + falling * 5,
  };
}

/**
 * Build the ranked insight list. Callers typically render the top 3.
 * Deterministic — same inputs always give the same cards, so the dashboard
 * doesn't shuffle between renders.
 */
export function buildInsights(input: InsightInput, limit = 3): Insight[] {
  const generators = [categoryTrend, monthStreak, biggestSpend, methodConcentration, spendingDays];
  return generators
    .map((g) => g(input))
    .filter((i): i is Insight => i !== null)
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))
    .slice(0, limit);
}
