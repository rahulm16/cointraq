import type { TxnEffect } from "./types";
import { cycleContaining, previousCycle, inCycle, type Cycle } from "./cycle";

export type PaidStatus = "paid" | "partial" | "unpaid";

export interface CardStatement {
  currentCycle: Cycle;
  unbilled: number; // Σ cc_spend in current cycle
  lastCycle: Cycle;
  lastStatement: number; // Σ cc_spend in the most recently completed cycle
  paidTotal: number; // Σ bill_pay to this card after lastCycle.end, up to asOf
  paidStatus: PaidStatus;
  remaining: number; // lastStatement − paidTotal, floored at 0
}

/**
 * Derive the credit-card statement view on the fly for a card.  SPEC §6.
 * `cardTxns` = cc_spend on this card + bill_pay whose to_account is this card.
 * Carried-over unpaid balances are not compounded (documented v1 simplification).
 */
export function cardStatement(
  cardId: number,
  billingDay: number,
  asOf: string,
  cardTxns: (TxnEffect & { toAccountId: number | null })[],
): CardStatement {
  const currentCycle = cycleContaining(asOf, billingDay);
  const lastCycle = previousCycle(asOf, billingDay);

  let unbilled = 0;
  let lastStatement = 0;
  let paidTotal = 0;

  for (const t of cardTxns) {
    if (t.type === "cc_spend") {
      if (inCycle(t.date, currentCycle)) unbilled += t.amount;
      if (inCycle(t.date, lastCycle)) lastStatement += t.amount;
    } else if (t.type === "bill_pay" && t.toAccountId === cardId) {
      // Payments toward the last statement: dated after that cycle's end, up to today.
      if (t.date > lastCycle.end && t.date <= asOf) paidTotal += t.amount;
    }
  }

  let paidStatus: PaidStatus;
  if (lastStatement === 0 || paidTotal >= lastStatement) paidStatus = "paid";
  else if (paidTotal > 0) paidStatus = "partial";
  else paidStatus = "unpaid";

  return {
    currentCycle,
    unbilled,
    lastCycle,
    lastStatement,
    paidTotal,
    paidStatus,
    remaining: Math.max(0, lastStatement - paidTotal),
  };
}
