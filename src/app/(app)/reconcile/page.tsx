import { getAccounts, getMethods, getTxnEffects, getSnapshots } from "@/db/queries";
import { expectedForAll } from "@/lib/compute";
import { ReconcileClient } from "./reconcile-client";
import { APP_NAME } from "@/lib/constants";
import { todayIST } from "@/lib/dates";

export const metadata = { title: `${APP_NAME} · Reconcile` };

export default async function ReconcilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const today = todayIST();
  const asOf = typeof sp.d === "string" && sp.d <= today ? sp.d : today;

  const [accounts, methods, effects, snapshots] = await Promise.all([
    getAccounts(true),
    getMethods(true),
    getTxnEffects(),
    getSnapshots(),
  ]);

  // Bank + cash only (SPEC §8). Non-archived for entry.
  const reconcilable = accounts.filter((a) => a.type !== "credit_card" && !a.isArchived);
  const expected = expectedForAll(reconcilable, asOf, effects, snapshots, methods);

  const rows = reconcilable.map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    type: a.type,
    expected: expected.get(a.id) ?? 0,
  }));

  // Snapshot history grouped by date.
  const byDate = new Map<string, { count: number; unaccounted: number }>();
  for (const s of snapshots) {
    const g = byDate.get(s.date) ?? { count: 0, unaccounted: 0 };
    g.count += 1;
    g.unaccounted += s.actualBalance - s.expectedBalance;
    byDate.set(s.date, g);
  }
  const history = [...byDate.entries()]
    .map(([date, g]) => ({ date, ...g }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <main className="max-w-[1120px] mx-auto p-4 lg:p-8">
      <ReconcileClient asOf={asOf} today={today} rows={rows} history={history} />
    </main>
  );
}
