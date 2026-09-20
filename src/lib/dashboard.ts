import type { Account, Category, PaymentMethod, Snapshot, Transaction, TxnEffect } from "./types";
import {
  heroForRange,
  heroDeltaForRange,
  dailyHeroRange,
  categoryBreakdownRange,
  topCategoryRange,
  byMethodRange,
  monthlyTotals,
  ccSpendByCategory,
} from "./aggregations";
import { accountExpected } from "./compute";
import { cardStatement, type CardStatement } from "./statement";
import { ccOutstanding, methodAccountLookup } from "./balances";
import { activeCashAccountId } from "./txn-rules";
import {
  monthKey,
  monthRange,
  parseDate,
  previousEqualRange,
  shiftMonth,
  toDateStr,
  todayIST,
  type DateRange,
  isFullMonthRange,
  formatPeriodLabel,
} from "./dates";
import { addDays } from "date-fns";
import type { CategoryColor } from "./constants";

export interface DashboardData {
  from: string;
  to: string;
  periodLabel: string;
  isFullMonth: boolean;
  hero: number;
  delta: number;
  cashInHand: number | null;
  top: { name: string; total: number; color: CategoryColor | null } | null;
  accountsTracked: number;
  cards: {
    account: Account;
    statement: CardStatement;
    cycleBreakdown: { name: string; total: number; color: CategoryColor }[];
  }[];
  dailyBars: { date: string; total: number }[];
  donut: { label: string; value: number; color: CategoryColor | "ccbill" | "uncategorized" }[];
  /** Trailing 12 months of hero totals, oldest→newest, ending at the viewed month. */
  monthlyBars: { month: string; total: number }[];
  methodBars: { name: string; total: number }[];
  recent: Transaction[];
}

/**
 * The window the hero delta compares against. A full calendar month is compared
 * with the whole previous month — "than last month" has to mean last month — and
 * any other range with the equal-length window just before it.
 */
export function comparisonRange(range: DateRange): DateRange {
  if (!isFullMonthRange(range)) return previousEqualRange(range);
  const { start, end } = monthRange(shiftMonth(monthKey(range.from), -1));
  return { from: start, to: end };
}

/** Compute everything the dashboard shows for a date range. */
export function buildDashboard(input: {
  from: string;
  to: string;
  accounts: Account[];
  methods: PaymentMethod[];
  categories: Category[];
  effects: TxnEffect[];
  snapshots: Snapshot[];
  recent: Transaction[];
}): DashboardData {
  const { from, to, accounts, methods, categories, effects, snapshots, recent } = input;
  const range: DateRange = { from, to };
  const today = todayIST();
  const prev = comparisonRange(range);
  const catName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorized";
  const catColor = (id: number | null) => categories.find((c) => c.id === id)?.color ?? null;

  const hero = heroForRange(effects, from, to);
  const delta = heroDeltaForRange(effects, from, to, prev.from, prev.to);

  // The same cash account withdrawals land in.
  const cashId = activeCashAccountId(accounts);
  const cashAccount = accounts.find((a) => a.id === cashId);
  const cashInHand = cashAccount
    ? accountExpected(cashAccount, today, effects, snapshots, methods)
    : null;

  const topRaw = topCategoryRange(effects, from, to);
  const top = topRaw
    ? { name: catName(topRaw.categoryId), total: topRaw.total, color: catColor(topRaw.categoryId) }
    : null;

  const accountsTracked = accounts.filter((a) => a.type !== "credit_card" && !a.isArchived).length;

  const lookup = methodAccountLookup(methods);
  const cards = accounts
    .filter((a) => a.type === "credit_card")
    .map((card) => {
      const cardTxns = effects
        .filter(
          (t) =>
            (t.type === "cc_spend" && t.methodId != null && lookup(t.methodId) === card.id) ||
            (t.type === "bill_pay" && t.toAccountId === card.id),
        )
        .map((t) => ({ ...t, toAccountId: t.toAccountId })) as (TxnEffect & { toAccountId: number | null })[];
      const statement = cardStatement(card.id, card.billingDay ?? 1, today, cardTxns);
      const bd = ccSpendByCategory(
        effects.filter((t) => t.methodId != null && lookup(t.methodId!) === card.id),
        statement.currentCycle.start,
        statement.currentCycle.end,
      );
      const cycleBreakdown = [...bd.entries()]
        .map(([cid, total]) => ({ name: catName(cid), total, color: (catColor(cid) ?? "blue") as CategoryColor }))
        .sort((a, b) => b.total - a.total);
      const outstanding = ccOutstanding(card, today, cardTxns, lookup);
      return { account: card, statement, cycleBreakdown, outstanding };
    })
    // Archived cards drop off only when their complete all-time ledger is settled.
    .filter((c) => !c.account.isArchived || c.outstanding !== 0);

  const daily = dailyHeroRange(effects, from, to);
  const dailyBars = fillDays(from, to, daily);

  const { byCategory, ccBill } = categoryBreakdownRange(effects, from, to);
  const donut: DashboardData["donut"] = [];
  for (const [cid, value] of byCategory) {
    if (value <= 0) continue;
    donut.push({
      label: catName(cid),
      value,
      color: cid == null ? "uncategorized" : (catColor(cid) ?? "blue"),
    });
  }
  if (ccBill > 0) donut.push({ label: "CC Bill", value: ccBill, color: "ccbill" });
  donut.sort((a, b) => b.value - a.value);

  const anchorMk = monthKey(to);
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) months.push(shiftMonth(anchorMk, -i));
  const monthlyBars = monthlyTotals(effects, months);

  const mBars = byMethodRange(effects, from, to);
  const methodBars = [...mBars.entries()]
    .map(([mid, total]) => ({ name: methods.find((m) => m.id === mid)?.name ?? "—", total }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);

  const recentInRange = recent.filter((t) => t.date >= from && t.date <= to);

  return {
    from,
    to,
    periodLabel: formatPeriodLabel(range),
    isFullMonth: isFullMonthRange(range),
    hero,
    delta,
    cashInHand,
    top,
    accountsTracked,
    cards,
    dailyBars,
    donut,
    monthlyBars,
    methodBars,
    recent: recentInRange,
  };
}

function fillDays(start: string, end: string, byDay: Map<string, number>): { date: string; total: number }[] {
  const out: { date: string; total: number }[] = [];
  let d = parseDate(start);
  const last = parseDate(end);
  while (d <= last) {
    const key = toDateStr(d);
    out.push({ date: key, total: byDay.get(key) ?? 0 });
    d = addDays(d, 1);
  }
  return out;
}
