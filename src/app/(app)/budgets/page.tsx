import { getBudgets, getCategories, getTxnEffects } from "@/db/queries";
import { monthBudgets } from "@/lib/budgets";
import { monthKey, monthRange, shiftMonth, todayIST } from "@/lib/dates";
import { APP_NAME } from "@/lib/constants";
import { BudgetsClient } from "./budgets-client";

export const metadata = { title: `Budgets · ${APP_NAME}` };

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const today = todayIST();

  // `m=yyyy-MM` selects the month; anything invalid falls back to the current one.
  const raw = typeof sp.m === "string" ? sp.m : undefined;
  const month = raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : monthKey(today);
  const prevMonth = shiftMonth(month, -1);

  const [allBudgets, categories, effects] = await Promise.all([
    getBudgets(),
    getCategories(),
    getTxnEffects(),
  ]);

  const current = monthBudgets(allBudgets, effects, month, today);

  // Per-category spend for this month, so each row can show what a cap is up against.
  const { start, end } = monthRange(month);
  const spendByCategory: Record<number, number> = {};
  for (const t of effects) {
    if (t.type !== "expense" || t.categoryId == null) continue;
    if (t.date < start || t.date > end) continue;
    spendByCategory[t.categoryId] = (spendByCategory[t.categoryId] ?? 0) + t.amount;
  }

  const rows = allBudgets.filter((b) => b.month === month);
  const hasPrevious = allBudgets.some((b) => b.month === prevMonth);

  return (
    // Keyed by month: the inline cap inputs hold drafts in local state, and a query
    // change alone doesn't remount the page — without the key they'd keep last month's numbers.
    <BudgetsClient
      key={month}
      month={month}
      prevMonth={prevMonth}
      nowMonth={monthKey(today)}
      categories={categories}
      budgets={rows}
      progress={current}
      spendByCategory={spendByCategory}
      canCopyPrevious={hasPrevious && rows.length === 0}
    />
  );
}
