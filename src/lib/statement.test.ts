import { describe, it, expect } from "vitest";
import { cardStatement } from "./statement";
import type { TxnEffect } from "./types";

type CardTxn = TxnEffect & { toAccountId: number | null };
function ct(p: Partial<CardTxn> & Pick<CardTxn, "type" | "amount" | "date">): CardTxn {
  return { methodId: null, fromAccountId: null, toAccountId: null, categoryId: null, ...p };
}

// Card id 3, billing day 17, asOf 10 Jul 2026.
// current cycle 18 Jun–17 Jul; last cycle 18 May–17 Jun.
const asOf = "2026-07-10";

describe("cardStatement", () => {
  it("computes unbilled and last statement across cycles", () => {
    const txns: CardTxn[] = [
      ct({ type: "cc_spend", amount: 9640, date: "2026-07-02" }), // current
      ct({ type: "cc_spend", amount: 2000, date: "2026-06-20" }), // current
      ct({ type: "cc_spend", amount: 14200, date: "2026-06-01" }), // last cycle
    ];
    const s = cardStatement(3, 17, asOf, txns);
    expect(s.currentCycle).toEqual({ start: "2026-06-18", end: "2026-07-17" });
    expect(s.lastCycle).toEqual({ start: "2026-05-18", end: "2026-06-17" });
    expect(s.unbilled).toBe(9640 + 2000);
    expect(s.lastStatement).toBe(14200);
  });

  it("Unpaid when no bill_pay after last cycle", () => {
    const s = cardStatement(3, 17, asOf, [ct({ type: "cc_spend", amount: 14200, date: "2026-06-01" })]);
    expect(s.paidStatus).toBe("unpaid");
    expect(s.remaining).toBe(14200);
  });

  it("Partial when payment < statement", () => {
    const s = cardStatement(3, 17, asOf, [
      ct({ type: "cc_spend", amount: 14200, date: "2026-06-01" }),
      ct({ type: "bill_pay", amount: 5000, date: "2026-06-20", toAccountId: 3 }),
    ]);
    expect(s.paidStatus).toBe("partial");
    expect(s.remaining).toBe(9200);
  });

  it("Paid when payment >= statement", () => {
    const s = cardStatement(3, 17, asOf, [
      ct({ type: "cc_spend", amount: 14200, date: "2026-06-01" }),
      ct({ type: "bill_pay", amount: 14200, date: "2026-06-20", toAccountId: 3 }),
    ]);
    expect(s.paidStatus).toBe("paid");
    expect(s.remaining).toBe(0);
  });

  it("bill_pay dated within the last cycle does not count as payment of it", () => {
    // payment must be dated AFTER lastCycle.end (17 Jun)
    const s = cardStatement(3, 17, asOf, [
      ct({ type: "cc_spend", amount: 14200, date: "2026-06-01" }),
      ct({ type: "bill_pay", amount: 14200, date: "2026-06-10", toAccountId: 3 }),
    ]);
    expect(s.paidStatus).toBe("unpaid");
  });

  it("empty statement is treated as paid", () => {
    const s = cardStatement(3, 17, asOf, []);
    expect(s.lastStatement).toBe(0);
    expect(s.paidStatus).toBe("paid");
  });
});
