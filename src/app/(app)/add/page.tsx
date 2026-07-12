import { getAccounts, getMethods, getCategories, getTxnEffects, getTitlesByKind } from "@/db/queries";
import { AddTransaction } from "./add-transaction";
import { AddDrawerShell } from "./add-drawer-shell";
import { APP_NAME } from "@/lib/constants";
import { todayIST } from "@/lib/dates";
import { cardStatement } from "@/lib/statement";
import type { TxnEffect } from "@/lib/types";

export const metadata = { title: `${APP_NAME} · Add` };

export default async function AddPage() {
  const [accounts, methods, categories, effects, titlesByKind] = await Promise.all([
    getAccounts(false),
    getMethods(false),
    getCategories(false),
    getTxnEffects(),
    getTitlesByKind(),
  ]);

  const today = todayIST();

  // Prefill data for the Bill pay tab: last statement per credit-card account.
  const cards = accounts.filter((a) => a.type === "credit_card");
  const lastStatements = cards.map((card) => {
    const cardTxns = effects.filter(
      (t: TxnEffect) =>
        (t.type === "cc_spend" && methods.find((m) => m.id === t.methodId)?.accountId === card.id) ||
        (t.type === "bill_pay" && t.toAccountId === card.id),
    ) as (TxnEffect & { toAccountId: number | null })[];
    const s = cardStatement(card.id, card.billingDay ?? 1, today, cardTxns);
    return { cardId: card.id, remaining: s.remaining, lastStatement: s.lastStatement };
  });

  return (
    <main className="min-h-dvh">
      <AddDrawerShell>
        <AddTransaction
          accounts={accounts}
          methods={methods}
          categories={categories}
          today={today}
          lastStatements={lastStatements}
          titlesByKind={titlesByKind}
        />
      </AddDrawerShell>
    </main>
  );
}
