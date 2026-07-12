import { getAccounts, getMethods, getCategories, getTxnEffects } from "@/db/queries";
import { AddTransaction } from "./add-transaction";
import { APP_NAME } from "@/lib/constants";
import { todayIST } from "@/lib/dates";
import { cardStatement } from "@/lib/statement";
import type { TxnEffect } from "@/lib/types";

export const metadata = { title: `${APP_NAME} · Add` };

export default async function AddPage() {
  const [accounts, methods, categories, effects] = await Promise.all([
    getAccounts(false),
    getMethods(false),
    getCategories(false),
    getTxnEffects(),
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
    <main className="max-w-[560px] mx-auto p-4 lg:p-8">
      <h1 className="text-xl font-semibold text-text-primary mb-4">Add transaction</h1>
      <AddTransaction
        accounts={accounts}
        methods={methods}
        categories={categories}
        today={today}
        lastStatements={lastStatements}
      />
    </main>
  );
}
