import { getFilteredTransactions, getAccounts, getMethods, getCategories } from "@/db/queries";
import { MonthSwitcher } from "@/components/month-switcher";
import { TransactionsView } from "./transactions-view";
import { APP_NAME } from "@/lib/constants";
import { todayIST, monthKey, monthRange } from "@/lib/dates";
import { heroTotal, isHeroCountable } from "@/lib/aggregations";
import type { Transaction } from "@/lib/types";

export const metadata = { title: `${APP_NAME} · Transactions` };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const nowMonth = monthKey(todayIST());
  const month = typeof sp.m === "string" ? sp.m : nowMonth;
  const { start, end } = monthRange(month);

  const type = typeof sp.type === "string" ? sp.type : undefined;
  const methodId = typeof sp.method === "string" ? Number(sp.method) : undefined;
  const categoryId = typeof sp.category === "string" ? Number(sp.category) : undefined;
  const accountId = typeof sp.account === "string" ? Number(sp.account) : undefined;
  const search = typeof sp.q === "string" ? sp.q : undefined;

  const [accounts, methods, categories] = await Promise.all([
    getAccounts(true),
    getMethods(true),
    getCategories(true),
  ]);

  let txns = await getFilteredTransactions({
    monthStart: start,
    monthEnd: end,
    type,
    methodId,
    categoryId,
    search,
  });

  // Account filter: match transactions touching the account (from/to or the
  // method's account). Post-filter since volumes are tiny.
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
      <div className="mb-4">
        <MonthSwitcher month={month} maxMonth={nowMonth} />
      </div>
      <TransactionsView
        transactions={txns}
        accounts={accounts}
        methods={methods}
        categories={categories}
        summary={summary}
        today={todayIST()}
        filters={{ type, methodId, categoryId, accountId, search }}
      />
    </main>
  );
}
