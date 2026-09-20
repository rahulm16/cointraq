import {
  getFilteredTransactions,
  getAccounts,
  getMethods,
  getCategories,
  getTitlesByKind,
  getEarliestTransactionDate,
} from "@/db/queries";
import { PeriodBar, PeriodTransition } from "@/components/period-bar";
import { TransactionsView } from "./transactions-view";
import { APP_NAME } from "@/lib/constants";
import { todayIST, monthKey, resolvePeriod } from "@/lib/dates";
import { heroTotal, isHeroCountable } from "@/lib/aggregations";
import { parseSearch, matchesNames, describeQuery } from "@/lib/search";
import type { Transaction, TransactionType } from "@/lib/types";

export const metadata = { title: `${APP_NAME} · Transactions` };

const TYPES: TransactionType[] = ["expense", "cc_spend", "bill_pay", "transfer", "withdrawal", "income"];

/** A positive integer id from a query param, or undefined for anything else. */
function idParam(v: string | string[] | undefined): number | undefined {
  if (typeof v !== "string") return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const today = todayIST();
  const nowMonth = monthKey(today);

  // `all=1` (from the command palette) searches every date until a period is picked.
  const hasExplicitRange = typeof sp.from === "string" && typeof sp.to === "string";
  const allDates = sp.all === "1" && !hasExplicitRange;
  const earliest = allDates ? await getEarliestTransactionDate() : null;
  const { from, to } = allDates
    ? { from: earliest && earliest < today ? earliest : today, to: today }
    : resolvePeriod(sp, today);

  const type = typeof sp.type === "string" && (TYPES as string[]).includes(sp.type) ? sp.type : undefined;
  const methodId = idParam(sp.method);
  const categoryId = idParam(sp.category);
  const accountId = idParam(sp.account);
  const search = typeof sp.q === "string" ? sp.q : undefined;

  const [accounts, methods, categories, titlesByKind] = await Promise.all([
    getAccounts(true),
    getMethods(true),
    getCategories(true),
    getTitlesByKind(),
  ]);

  // Text search also matches method and category names, not just titles.
  const parsed = parseSearch(search);
  const nameMethodIds = methods.filter((m) => matchesNames(parsed, { method: m.name })).map((m) => m.id);
  const nameCategoryIds = categories.filter((c) => matchesNames(parsed, { category: c.name })).map((c) => c.id);

  let txns = await getFilteredTransactions({
    from,
    to,
    type,
    methodId,
    categoryId,
    search,
    nameMethodIds,
    nameCategoryIds,
  });

  if (accountId) {
    const methodAccount = new Map(methods.map((m) => [m.id, m.accountId]));
    txns = txns.filter(
      (t: Transaction) =>
        t.fromAccountId === accountId ||
        t.toAccountId === accountId ||
        (t.methodId != null && methodAccount.get(t.methodId) === accountId),
    );
  }

  const heroCountable = txns.filter((t) => isHeroCountable(t.type));
  const summary = { count: txns.length, total: heroTotal(txns), heroCount: heroCountable.length };

  return (
    <main className="max-w-[900px] mx-auto p-4 lg:p-8">
      <PeriodBar from={from} to={to} maxMonth={nowMonth} />
      <PeriodTransition periodKey={`${from}_${to}`}>
        <TransactionsView
          transactions={txns}
          accounts={accounts}
          methods={methods}
          categories={categories}
          summary={summary}
          today={today}
          titlesByKind={titlesByKind}
          filters={{ type, methodId, categoryId, accountId, search }}
          queryLabel={describeQuery(parsed)}
        />
      </PeriodTransition>
    </main>
  );
}
