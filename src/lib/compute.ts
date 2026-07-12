import type { Account, PaymentMethod, Snapshot, TxnEffect } from "./types";
import { expectedBalance, methodAccountLookup, type Baseline } from "./balances";
import { dateLte } from "./dates";

/**
 * The most recent snapshot on/before asOf for an account becomes its baseline;
 * otherwise opening_balance with a −∞ (null) date.  SPEC §5.
 */
export function baselineFor(account: Account, asOf: string, snapshots: Snapshot[]): Baseline {
  let best: Snapshot | null = null;
  for (const s of snapshots) {
    if (s.accountId !== account.id) continue;
    if (!dateLte(s.date, asOf)) continue;
    if (!best || s.date > best.date || (s.date === best.date && s.createdAt > best.createdAt)) {
      best = s;
    }
  }
  return best ? { value: best.expectedBalance, date: best.date } : { value: account.openingBalance, date: null };
}

/** Expected balance for one account as of a date, using snapshots as baselines. */
export function accountExpected(
  account: Account,
  asOf: string,
  txns: TxnEffect[],
  snapshots: Snapshot[],
  methods: Pick<PaymentMethod, "id" | "accountId">[],
): number {
  const lookup = methodAccountLookup(methods);
  const baseline = account.type === "credit_card"
    ? { value: account.openingBalance, date: null } // CC excluded from snapshots
    : baselineFor(account, asOf, snapshots);
  return expectedBalance(account, asOf, txns, baseline, lookup);
}

/** Expected balances for many accounts at once. */
export function expectedForAll(
  accountList: Account[],
  asOf: string,
  txns: TxnEffect[],
  snapshots: Snapshot[],
  methods: Pick<PaymentMethod, "id" | "accountId">[],
): Map<number, number> {
  const out = new Map<number, number>();
  for (const a of accountList) {
    out.set(a.id, accountExpected(a, asOf, txns, snapshots, methods));
  }
  return out;
}
