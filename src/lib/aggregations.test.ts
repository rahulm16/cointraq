import { describe, it, expect } from "vitest";
import {
  heroForMonth,
  heroDelta,
  isHeroCountable,
  categoryBreakdown,
  topCategory,
  byMethod,
  ccSpendByCategory,
} from "./aggregations";
import type { TxnEffect } from "./types";

function tx(p: Partial<TxnEffect> & Pick<TxnEffect, "type" | "amount" | "date">): TxnEffect {
  return { methodId: null, fromAccountId: null, toAccountId: null, categoryId: null, ...p };
}

const txns: TxnEffect[] = [
  tx({ type: "expense", amount: 500, date: "2026-07-01", categoryId: 1, methodId: 10 }),
  tx({ type: "expense", amount: 300, date: "2026-07-01", categoryId: 2, methodId: 10 }),
  tx({ type: "expense", amount: 700, date: "2026-07-02", categoryId: 1, methodId: 11 }),
  tx({ type: "bill_pay", amount: 14200, date: "2026-07-03", methodId: 10, toAccountId: 3 }),
  tx({ type: "cc_spend", amount: 9640, date: "2026-07-04", categoryId: 1, methodId: 30 }),
  tx({ type: "transfer", amount: 2000, date: "2026-07-05", fromAccountId: 1, toAccountId: 4 }),
  tx({ type: "withdrawal", amount: 3000, date: "2026-07-06", fromAccountId: 1, toAccountId: 4 }),
  tx({ type: "income", amount: 90000, date: "2026-07-01", toAccountId: 1 }),
  tx({ type: "expense", amount: 1000, date: "2026-06-15", categoryId: 1, methodId: 10 }),
];

describe("hero formula", () => {
  it("counts only expense + bill_pay", () => {
    expect(isHeroCountable("expense")).toBe(true);
    expect(isHeroCountable("bill_pay")).toBe(true);
    expect(isHeroCountable("cc_spend")).toBe(false);
    expect(isHeroCountable("transfer")).toBe(false);
    expect(isHeroCountable("withdrawal")).toBe(false);
    expect(isHeroCountable("income")).toBe(false);
  });

  it("heroForMonth = Σ expense + Σ bill_pay in month", () => {
    // Jul: 500+300+700+14200 = 15700
    expect(heroForMonth(txns, "2026-07")).toBe(15700);
    expect(heroForMonth(txns, "2026-06")).toBe(1000);
  });

  it("heroDelta this − prev", () => {
    expect(heroDelta(txns, "2026-07", "2026-06")).toBe(15700 - 1000);
  });
});

describe("categoryBreakdown", () => {
  it("groups expense by category and separates a CC Bill slice", () => {
    const { byCategory, ccBill } = categoryBreakdown(txns, "2026-07");
    expect(byCategory.get(1)).toBe(1200); // 500 + 700
    expect(byCategory.get(2)).toBe(300);
    expect(ccBill).toBe(14200);
  });
});

describe("topCategory — expense only", () => {
  it("returns category with max expense sum", () => {
    expect(topCategory(txns, "2026-07")).toEqual({ categoryId: 1, total: 1200 });
  });
});

describe("byMethod — expense + bill_pay", () => {
  it("groups hero-countable by method", () => {
    const m = byMethod(txns, "2026-07");
    expect(m.get(10)).toBe(500 + 300 + 14200);
    expect(m.get(11)).toBe(700);
  });
});

describe("ccSpendByCategory", () => {
  it("groups cc_spend by category in a range", () => {
    const m = ccSpendByCategory(txns, "2026-06-18", "2026-07-17");
    expect(m.get(1)).toBe(9640);
  });
});
