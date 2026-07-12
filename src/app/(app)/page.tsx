import {
  getAccounts,
  getMethods,
  getCategories,
  getTxnEffects,
  getSnapshots,
  getRecentTransactions,
  getTitlesByKind,
} from "@/db/queries";
import { buildDashboard } from "@/lib/dashboard";
import { monthKey, resolvePeriod, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { PeriodBar, PeriodTransition } from "@/components/period-bar";
import { Entrance, EntranceItem } from "@/components/entrance";
import { INRFlow } from "@/components/inr-flow";
import { Card, Eyebrow, EmptyState } from "@/components/ui";
import { categoryClasses } from "@/lib/ui";
import { CcWidget } from "./cc-widget";
import { RecentList } from "./recent-list";
import { DailyBars, CategoryDonut, TrendLine, MethodBars } from "./charts";
import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
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

  const [accounts, methods, categories, effects, snapshots, recent, titlesByKind] = await Promise.all([
    getAccounts(true),
    getMethods(true),
    getCategories(true),
    getTxnEffects(),
    getSnapshots(),
    getRecentTransactions(8, { from, to }),
    getTitlesByKind(),
  ]);

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
            <Card>
              <Eyebrow>Daily spend</Eyebrow>
              <div className="mt-2">
                <DailyBars data={d.dailyBars} />
              </div>
            </Card>
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

          <EntranceItem>
            <Card>
              <Eyebrow>6-month trend</Eyebrow>
              <div className="mt-2">
                <TrendLine data={d.trend} />
              </div>
            </Card>
          </EntranceItem>
        </div>

        <div className="flex flex-col gap-4">
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
