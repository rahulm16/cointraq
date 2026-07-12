import type { Account, Category, PaymentMethod, Snapshot, Transaction, TxnEffect } from "./types";
import {
  heroForMonth,
  heroDelta,
  dailyHero,
  categoryBreakdown,
  topCategory,
  byMethod,
  sixMonthTrend,
  ccSpendByCategory,
} from "./aggregations";
import { accountExpected } from "./compute";
import { cardStatement, type CardStatement } from "./statement";
import { methodAccountLookup } from "./balances";
import { monthRange, shiftMonth, todayIST } from "./dates";
import type { CategoryColor } from "./constants";

export interface DashboardData {
  month: string;
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
  trend: { month: string; total: number }[];
  methodBars: { name: string; total: number }[];
  recent: Transaction[];
}

/** Compute everything the dashboard shows for a month.  SPEC §7. */
export function buildDashboard(input: {
  month: string;
  accounts: Account[];
  methods: PaymentMethod[];
  categories: Category[];
  effects: TxnEffect[];
  snapshots: Snapshot[];
  recent: Transaction[];
}): DashboardData {
  const { month, accounts, methods, categories, effects, snapshots, recent } = input;
  const today = todayIST();
  const prevMonth = shiftMonth(month, -1);
  const catName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorized";
  const catColor = (id: number | null) => categories.find((c) => c.id === id)?.color ?? null;

  // Hero + delta
  const hero = heroForMonth(effects, month);
  const delta = heroDelta(effects, month, prevMonth);

  // Cash in hand — expected balance of the cash account as of today (not month-scoped)
  const cashAccount = accounts.find((a) => a.type === "cash");
  const cashInHand = cashAccount
    ? accountExpected(cashAccount, today, effects, snapshots, methods)
    : null;

  // Top category (expense only)
  const topRaw = topCategory(effects, month);
  const top = topRaw
    ? { name: catName(topRaw.categoryId), total: topRaw.total, color: catColor(topRaw.categoryId) }
    : null;

  const accountsTracked = accounts.filter((a) => a.type !== "credit_card" && !a.isArchived).length;

  // Credit-card widgets + per-cycle mini breakdown
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
      const bd = ccSpendByCategory(effects.filter((t) => t.methodId != null && lookup(t.methodId!) === card.id), statement.currentCycle.start, statement.currentCycle.end);
      const cycleBreakdown = [...bd.entries()]
        .map(([cid, total]) => ({ name: catName(cid), total, color: (catColor(cid) ?? "blue") as CategoryColor }))
        .sort((a, b) => b.total - a.total);
      return { account: card, statement, cycleBreakdown };
    });

  // Daily bars
  const daily = dailyHero(effects, month);
  const { start, end } = monthRange(month);
  const dailyBars = fillDays(start, end, daily);

  // Category donut
  const { byCategory, ccBill } = categoryBreakdown(effects, month);
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

  // 6-month trend
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) months.push(shiftMonth(month, -i));
  const trend = sixMonthTrend(effects, months);

  // By-method bars
  const mBars = byMethod(effects, month);
  const methodBars = [...mBars.entries()]
    .map(([mid, total]) => ({ name: methods.find((m) => m.id === mid)?.name ?? "—", total }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);

  return {
    month,
    hero,
    delta,
    cashInHand,
    top,
    accountsTracked,
    cards,
    dailyBars,
    donut,
    trend,
    methodBars,
    recent,
  };
}

function fillDays(start: string, end: string, byDay: Map<string, number>): { date: string; total: number }[] {
  const out: { date: string; total: number }[] = [];
  const d = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (d <= last) {
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, total: byDay.get(key) ?? 0 });
    d.setDate(d.getDate() + 1);
  }
  return out;
}
