import {
  getAccounts,
  getMethods,
  getCategories,
  getTxnEffects,
  getSnapshots,
  getRecentTransactions,
} from "@/db/queries";
import { buildDashboard } from "@/lib/dashboard";
import { monthKey, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { MonthSwitcher } from "@/components/month-switcher";
import { Card, Eyebrow, EmptyState } from "@/components/ui";
import { categoryClasses } from "@/lib/ui";
import { CcWidget } from "./cc-widget";
import { RecentList } from "./recent-list";
import { DailyBars, CategoryDonut, TrendLine, MethodBars } from "./charts";
import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";

export const metadata = { title: APP_NAME };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const today = todayIST();
  const nowMonth = monthKey(today);
  const month = typeof sp.m === "string" ? sp.m : nowMonth;

  const [accounts, methods, categories, effects, snapshots, recent] = await Promise.all([
    getAccounts(true),
    getMethods(true),
    getCategories(true),
    getTxnEffects(),
    getSnapshots(),
    getRecentTransactions(8),
  ]);

  // First-run empty dashboard.
  if (effects.length === 0) {
    return (
      <main className="max-w-[1120px] mx-auto p-4 lg:p-8">
        <EmptyState
          title="Nothing logged yet"
          body="Log your first spend to see your month come to life."
          action={
            <Link href="/add" className="h-10 px-4 rounded-control bg-primary text-primary-contrast font-semibold text-[14px] inline-flex items-center">
              Log your first spend
            </Link>
          }
        />
      </main>
    );
  }

  const d = buildDashboard({ month, accounts, methods, categories, effects, snapshots, recent });
  const lower = d.delta < 0;
  const topColor = d.top?.color ? categoryClasses(d.top.color).text : "text-text-secondary";

  return (
    <main className="max-w-[1120px] mx-auto p-4 lg:p-8">
      <div className="mb-4">
        <MonthSwitcher month={month} maxMonth={nowMonth} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Left/main column */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Hero */}
          <div
            className="rounded-[18px] p-[24px_22px] bg-primary shadow-[var(--shadow-hero)]"
          >
            <Eyebrow className="!text-primary-contrast/70">Spent in {monthLabel(month)}</Eyebrow>
            <div className="tnum text-[46px] leading-[1.15] mt-2" style={{ color: "var(--hero-amount)" }}>
              {formatINR(d.hero)}
            </div>
            {d.delta !== 0 && (
              <div className={`flex items-center gap-1.5 mt-2.5 text-[13px] font-medium ${lower ? "text-income" : "text-primary-contrast/90"}`}>
                {lower ? <TrendingDown size={14} strokeWidth={1.75} /> : <TrendingUp size={14} strokeWidth={1.75} />}
                <span>
                  <span className="tnum">{formatINR(Math.abs(d.delta))}</span> {lower ? "less" : "more"} than last month
                </span>
              </div>
            )}
          </div>

          {/* Stat row */}
          <div className="grid grid-cols-3 gap-2.5">
            <Card className="!p-[12px_12px_14px]">
              <Eyebrow className="!text-[10px]">Cash in hand</Eyebrow>
              <div className="tnum text-[16px] text-text-primary mt-1.5">
                {d.cashInHand != null ? formatINR(d.cashInHand) : "—"}
              </div>
            </Card>
            <Card className="!p-[12px_12px_14px]">
              <Eyebrow className="!text-[10px]">Top category</Eyebrow>
              <div className="text-[13px] mt-1.5 truncate">
                {d.top ? (
                  <>
                    <span className={`font-medium ${topColor}`}>{d.top.name}</span>{" "}
                    <span className="tnum text-text-secondary">{formatINR(d.top.total)}</span>
                  </>
                ) : (
                  <span className="text-text-faint">—</span>
                )}
              </div>
            </Card>
            <Card className="!p-[12px_12px_14px]">
              <Eyebrow className="!text-[10px]">Accounts</Eyebrow>
              <div className="text-[13px] text-text-primary mt-1.5 tnum">{d.accountsTracked} tracked</div>
            </Card>
          </div>

          {/* Daily bars */}
          <Card>
            <Eyebrow>Daily spend</Eyebrow>
            <div className="mt-2">
              <DailyBars data={d.dailyBars} />
            </div>
          </Card>

          {/* Category donut + method bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          {/* Trend */}
          <Card>
            <Eyebrow>6-month trend</Eyebrow>
            <div className="mt-2">
              <TrendLine data={d.trend} />
            </div>
          </Card>
        </div>

        {/* Right column: CC widgets + recent */}
        <div className="flex flex-col gap-4">
          {d.cards.map((c) => (
            <CcWidget key={c.account.id} card={c} />
          ))}
          <RecentList
            recent={d.recent}
            accounts={accounts}
            methods={methods}
            categories={categories}
            today={today}
          />
        </div>
      </div>
    </main>
  );
}

function monthLabel(m: string): string {
  // "July" from "2026-07"
  return new Date(m + "-01T00:00:00").toLocaleString("en-US", { month: "long" });
}
