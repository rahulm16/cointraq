import {
  getAccounts,
  getMethods,
  getCategories,
  getTxnEffects,
  getSnapshots,
  getRecentTransactions,
  getTitlesByKind,
  getBudgets,
  getRecurringTemplates,
  getQuickAddSuggestions,
  getSetupCompleted,
} from "@/db/queries";
import { buildDashboard } from "@/lib/dashboard";
import { monthKey, monthRange, resolvePeriod, shiftMonth, todayIST } from "@/lib/dates";
import { dailyTotalsInRange } from "@/lib/aggregations";
import { formatINR } from "@/lib/money";
import { monthBudgets } from "@/lib/budgets";
import { dueNow } from "@/lib/recurring";
import { buildInsights } from "@/lib/insights";
import { PeriodBar, PeriodTransition } from "@/components/period-bar";
import { Entrance, EntranceItem } from "@/components/entrance";
import { INRFlow } from "@/components/inr-flow";
import { Card, Eyebrow } from "@/components/ui";
import { categoryClasses } from "@/lib/ui";
import { CcWidget } from "./cc-widget";
import { RecentList } from "./recent-list";
import { BudgetCard } from "./budget-card";
import { DueStrip } from "./due-strip";
import { QuickAdd } from "./quick-add";
import { InsightCards } from "./insight-cards";
import { YearHeatmap } from "./year-heatmap";
import { FirstRun } from "./onboarding";
import { CategoryDonut, MethodBars } from "./charts";
import { SpendChart } from "./spend-chart";
import { APP_NAME } from "@/lib/constants";
import { TrendingDown, TrendingUp, Wallet, Tag, Landmark } from "lucide-react";

export const metadata = { title: APP_NAME };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const today = todayIST();
  const nowMonth = monthKey(today);
  const { from, to } = resolvePeriod(sp, today);

  const [
    accounts,
    methods,
    categories,
    effects,
    snapshots,
    recent,
    titlesByKind,
    allBudgets,
    templates,
    quickAdds,
    setupCompleted,
  ] = await Promise.all([
    getAccounts(true),
    getMethods(true),
    getCategories(true),
    getTxnEffects(),
    getSnapshots(),
    getRecentTransactions(8, { from, to }),
    getTitlesByKind(),
    getBudgets(),
    getRecurringTemplates(),
    getQuickAddSuggestions(),
    getSetupCompleted(),
  ]);

  // Budgets are a calendar-month concept; anchor them to the month the period ends in
  // ("Last 30 days" on 10 Sep is about September, not August).
  const viewMonth = monthKey(to);
  const budgets = monthBudgets(allBudgets, effects, viewMonth, today);
  const due = dueNow(templates, today);
  const insights = buildInsights({ effects, categories, methods, from, to, today });

  // Trailing 12 months of daily totals for the heatmap, independent of the
  // selected period — it's a "zoom out" view, not a period-scoped one.
  const yearFrom = monthRange(shiftMonth(monthKey(today), -11)).start;
  const heatmapDays = dailyTotalsInRange(effects, yearFrom, today);

  // First run: no transactions yet. Collect opening balances and a cap rather
  // than showing an empty dashboard — those two numbers are what make the first
  // reconcile and the pace ring meaningful.
  // Once the user has reconciled or set a budget, an empty ledger (say, after deleting
  // every transaction) is just an empty dashboard, not a fresh install.
  if (effects.length === 0 && !setupCompleted) {
    return (
      <main className="max-w-[1120px] mx-auto p-4 lg:p-8">
        <FirstRun accounts={accounts.filter((a) => !a.isArchived)} month={monthKey(today)} />
      </main>
    );
  }

  const d = buildDashboard({ from, to, accounts, methods, categories, effects, snapshots, recent });
  const lower = d.delta < 0;
  const topColor = d.top?.color ? categoryClasses(d.top.color).text : "text-text-secondary";
  const deltaLabel = d.isFullMonth ? "than last month" : "than prior period";

  return (
    <main className="max-w-[1120px] mx-auto p-4 lg:p-8">
      <PeriodBar from={from} to={to} maxMonth={nowMonth} />

      <PeriodTransition periodKey={`${from}_${to}`}>
      <Entrance>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <EntranceItem
            className="rounded-[24px] p-[24px_22px] bg-primary/12"
          >
            <Eyebrow className="!text-primary/75">Spent · {d.periodLabel}</Eyebrow>
            <div className="text-[46px] leading-[1.15] mt-2 text-text-primary">
              <INRFlow value={d.hero} />
            </div>
            {d.delta !== 0 && (
              <div className={`flex items-center gap-1.5 mt-2.5 text-[13px] font-medium ${lower ? "text-income" : "text-primary"}`}>
                {lower ? <TrendingDown size={14} strokeWidth={1.75} /> : <TrendingUp size={14} strokeWidth={1.75} />}
                <span>
                  <span className="tnum">{formatINR(Math.abs(d.delta))}</span> {lower ? "less" : "more"} {deltaLabel}
                </span>
              </div>
            )}
          </EntranceItem>

          {quickAdds.length > 0 && (
            <EntranceItem>
              <QuickAdd suggestions={quickAdds} categories={categories} today={today} />
            </EntranceItem>
          )}

          {insights.length > 0 && (
            <EntranceItem>
              <InsightCards insights={insights} />
            </EntranceItem>
          )}

          <EntranceItem className="grid grid-cols-3 gap-2.5">
            <Card lift className="!p-[12px_12px_14px]">
              <Eyebrow className="!text-[10px] flex items-center gap-1.5">
                <Wallet size={12} strokeWidth={1.75} aria-hidden /> Cash
              </Eyebrow>
              <div className="text-[16px] text-text-primary mt-1.5">
                {d.cashInHand != null ? <INRFlow value={d.cashInHand} /> : "—"}
              </div>
            </Card>
            <Card lift className="!p-[12px_12px_14px]">
              <Eyebrow className="!text-[10px] flex items-center gap-1.5">
                <Tag size={12} strokeWidth={1.75} aria-hidden /> Top
              </Eyebrow>
              <div className="text-[13px] mt-1.5 truncate">
                {d.top ? (
                  <>
                    <span className={`font-medium ${topColor}`}>{d.top.name}</span>{" "}
                    <span className="text-text-secondary">
                      <INRFlow value={d.top.total} />
                    </span>
                  </>
                ) : (
                  <span className="text-text-faint">—</span>
                )}
              </div>
            </Card>
            <Card lift className="!p-[12px_12px_14px]">
              <Eyebrow className="!text-[10px] flex items-center gap-1.5">
                <Landmark size={12} strokeWidth={1.75} aria-hidden /> Accounts
              </Eyebrow>
              <div className="text-[13px] text-text-primary mt-1.5 tnum">{d.accountsTracked} tracked</div>
            </Card>
          </EntranceItem>

          <EntranceItem>
            <SpendChart
              daily={d.dailyBars}
              monthly={d.monthlyBars}
              periodLabel={d.periodLabel}
              today={today}
            />
          </EntranceItem>

          <EntranceItem className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <Eyebrow>By category</Eyebrow>
              <div className="mt-3">
                <CategoryDonut data={d.donut} />
              </div>
            </Card>
            <Card>
              <Eyebrow>By method</Eyebrow>
              <div className="mt-3">
                <MethodBars data={d.methodBars} />
              </div>
            </Card>
          </EntranceItem>

          <EntranceItem className="min-w-0">
            <Card className="min-w-0">
              <YearHeatmap days={heatmapDays} today={today} />
            </Card>
          </EntranceItem>
        </div>

        <div className="flex flex-col gap-4">
          {due.length > 0 && (
            <EntranceItem>
              <DueStrip items={due} categories={categories} methods={methods} />
            </EntranceItem>
          )}

          <EntranceItem>
            <BudgetCard budgets={budgets} categories={categories} month={viewMonth} />
          </EntranceItem>

          {d.cards.map((c) => (
            <EntranceItem key={c.account.id}>
              <CcWidget card={c} />
            </EntranceItem>
          ))}
          <EntranceItem>
            <RecentList
              recent={d.recent}
              accounts={accounts}
              methods={methods}
              categories={categories}
              today={today}
              titlesByKind={titlesByKind}
            />
          </EntranceItem>
        </div>
      </div>
      </Entrance>
      </PeriodTransition>
    </main>
  );
}
