import type { Account, PaymentMethod, TxnEffect } from "./types";
import { dateGt, dateLte } from "./dates";

/**
 * Per-transaction balance effect on a single account, per the §4 table.
 * Returns the signed rupee delta this transaction applies to `accountId`.
 * For credit_card accounts, a positive number means outstanding-owed went up.
 *
 * `methodAccount` maps a method id -> its linked account id (needed because
 * expense/cc_spend/bill_pay debit the *method's* account).
 */
export function effectOnAccount(
  txn: TxnEffect,
  accountId: number,
  accountType: Account["type"],
  methodAccount: (methodId: number) => number | undefined,
): number {
  const methodAcct = txn.methodId != null ? methodAccount(txn.methodId) : undefined;

  switch (txn.type) {
    case "expense":
      return methodAcct === accountId ? -txn.amount : 0;

    case "cc_spend":
      // CC outstanding + amount, on the method's (credit_card) account.
      return methodAcct === accountId ? txn.amount : 0;

    case "bill_pay": {
      // method's account − amount; CC outstanding − amount (to_account).
      let d = 0;
      if (methodAcct === accountId) d -= txn.amount;
      if (txn.toAccountId === accountId) d -= txn.amount; // reduces CC owed
      return d;
    }

    case "transfer": {
      let d = 0;
      if (txn.fromAccountId === accountId) d -= txn.amount;
      if (txn.toAccountId === accountId) d += txn.amount;
      return d;
    }

    case "withdrawal": {
      // bank − amount; cash account + amount. from = bank, to = cash.
      let d = 0;
      if (txn.fromAccountId === accountId) d -= txn.amount;
      if (txn.toAccountId === accountId) d += txn.amount;
      return d;
    }

    case "income":
      return txn.toAccountId === accountId ? txn.amount : 0;

    default:
      return 0;
  }
}

export interface Baseline {
  value: number; // baseline balance value
  date: string | null; // baseline date; null means opening (−∞)
}

/**
 * expected_balance(account, asOf) = baseline + Σ effects of txns with
 * date ∈ (baseline_date, asOf].  SPEC §5.
 *
 * `baseline` is the most recent snapshot on/before asOf, else opening_balance
 * with a null (−∞) date. CC accounts have no snapshots, so their baseline is
 * always opening_balance.
 */
export function expectedBalance(
  account: Account,
  asOf: string,
  txns: TxnEffect[],
  baseline: Baseline,
  methodAccount: (methodId: number) => number | undefined,
): number {
  let total = baseline.value;
  for (const t of txns) {
    // date strictly after baseline_date, and on/before asOf
    const afterBaseline = baseline.date == null || dateGt(t.date, baseline.date);
    if (afterBaseline && dateLte(t.date, asOf)) {
      total += effectOnAccount(t, account.id, account.type, methodAccount);
    }
  }
  return total;
}

/**
 * CC outstanding = opening_balance + Σ cc_spend − Σ bill_pay(to this card).
 * Convenience wrapper; CC has no snapshot baseline.  SPEC §5.
 */
export function ccOutstanding(
  card: Account,
  asOf: string,
  txns: TxnEffect[],
  methodAccount: (methodId: number) => number | undefined,
): number {
  return expectedBalance(
    card,
    asOf,
    txns,
    { value: card.openingBalance, date: null },
    methodAccount,
  );
}

/** Build a fast method→account lookup from a list of methods. */
export function methodAccountLookup(methods: Pick<PaymentMethod, "id" | "accountId">[]) {
  const map = new Map<number, number>();
  for (const m of methods) map.set(m.id, m.accountId);
  return (methodId: number) => map.get(methodId);
}
