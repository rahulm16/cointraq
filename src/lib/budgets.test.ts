import { describe, it, expect } from "vitest";
import { budgetProgress, monthBudgets, suggestedFromPreviousMonth, NEAR_THRESHOLD } from "./budgets";
import type { Budget, TxnEffect } from "./types";

function tx(p: Partial<TxnEffect> & Pick<TxnEffect, "type" | "amount" | "date">): TxnEffect {
  return { methodId: null, fromAccountId: null, toAccountId: null, categoryId: null, ...p };
}

function budget(p: Partial<Budget> & Pick<Budget, "categoryId" | "month" | "amount">): Budget {
  return { id: 1, createdAt: new Date(), updatedAt: new Date(), ...p };
}

describe("budgetProgress", () => {
  // July 2026 has 31 days.
  it("computes pace against the straight-line target", () => {
    // Day 15 of 31, ₹30,000 cap → target is 30000*15/31 ≈ 14516.
    const p = budgetProgress(30000, 12000, "2026-07", "2026-07-15");
    expect(p.daysElapsed).toBe(15);
    expect(p.daysTotal).toBe(31);
    expect(p.paceTarget).toBe(Math.round((30000 * 15) / 31));
    expect(p.paceDelta).toBeLessThan(0); // spending slower than the cap allows
    expect(p.status).toBe("under");
  });

  it("flags being behind pace while still under budget", () => {
    const p = budgetProgress(30000, 20000, "2026-07", "2026-07-10");
    expect(p.paceDelta).toBeGreaterThan(0); // burning too fast
    expect(p.remaining).toBe(10000); // but not over yet
    expect(p.status).toBe("under");
  });

  it("projects the full month from the current burn rate", () => {
    // ₹10,000 over 10 days → ₹31,000 projected across 31 days.
    const p = budgetProgress(30000, 10000, "2026-07", "2026-07-10");
    expect(p.projected).toBe(31000);
  });

  it("marks `near` at the threshold and `over` past the cap", () => {
    const near = budgetProgress(10000, NEAR_THRESHOLD * 10000, "2026-07", "2026-07-20");
    expect(near.status).toBe("near");

    const over = budgetProgress(10000, 10001, "2026-07", "2026-07-20");
    expect(over.status).toBe("over");
    expect(over.remaining).toBeLessThan(0);
    expect(over.ratio).toBeGreaterThan(1);
  });

  it("treats a past month as fully elapsed", () => {
    const p = budgetProgress(30000, 28000, "2026-06", "2026-07-15");
    expect(p.daysElapsed).toBe(30); // all of June
    expect(p.daysTotal).toBe(30);
    expect(p.safeDailyRemaining).toBe(0); // no days left to spread over
  });

  it("treats a future month as not started", () => {
    const p = budgetProgress(30000, 0, "2026-09", "2026-07-15");
    expect(p.daysElapsed).toBe(0);
    expect(p.paceTarget).toBe(0);
    expect(p.projected).toBe(0);
  });

  it("computes the safe daily allowance for the rest of the month", () => {
    // ₹31,000 cap, nothing spent, day 1 of 31 → ₹1,000/day for the remaining 30.
    const p = budgetProgress(31000, 1000, "2026-07", "2026-07-01");
    expect(p.safeDailyRemaining).toBe(1000);
  });

  it("returns zeros for a zero budget rather than dividing by zero", () => {
    const p = budgetProgress(0, 5000, "2026-07", "2026-07-15");
    expect(p.ratio).toBe(0);
    expect(p.status).toBe("none");
    expect(Number.isFinite(p.paceTarget)).toBe(true);
  });
});

describe("monthBudgets", () => {
  const effects: TxnEffect[] = [
    tx({ type: "expense", amount: 4000, date: "2026-07-02", categoryId: 1 }),
    tx({ type: "expense", amount: 2000, date: "2026-07-05", categoryId: 2 }),
    tx({ type: "expense", amount: 1500, date: "2026-07-06", categoryId: 3 }), // uncapped
    tx({ type: "bill_pay", amount: 9000, date: "2026-07-08", toAccountId: 5 }),
    tx({ type: "cc_spend", amount: 7000, date: "2026-07-09", categoryId: 1 }), // never counted
    tx({ type: "expense", amount: 999, date: "2026-06-30", categoryId: 1 }), // other month
  ];

  const budgets: Budget[] = [
    budget({ id: 1, categoryId: null, month: "2026-07", amount: 40000 }),
    budget({ id: 2, categoryId: 1, month: "2026-07", amount: 5000 }),
    budget({ id: 3, categoryId: 2, month: "2026-07", amount: 1000 }),
    budget({ id: 4, categoryId: 1, month: "2026-06", amount: 3000 }), // other month
  ];

  it("compares the overall cap against the hero formula", () => {
    const r = monthBudgets(budgets, effects, "2026-07", "2026-07-15");
    // expense 4000+2000+1500 + bill_pay 9000 = 16500; cc_spend excluded.
    expect(r.overall?.spent).toBe(16500);
    expect(r.overall?.budget).toBe(40000);
  });

  it("uses expense-only spending for category caps, sorted by spend", () => {
    const r = monthBudgets(budgets, effects, "2026-07", "2026-07-15");
    expect(r.categories.map((c) => c.categoryId)).toEqual([1, 2]);
    expect(r.categories[0].progress.spent).toBe(4000); // cc_spend on cat 1 not counted
    expect(r.categories[1].progress.status).toBe("over"); // 2000 spent against a 1000 cap
  });

  it("sums spending in categories with no cap", () => {
    const r = monthBudgets(budgets, effects, "2026-07", "2026-07-15");
    expect(r.uncappedSpend).toBe(1500); // category 3 only
  });

  it("ignores budgets belonging to other months", () => {
    const r = monthBudgets(budgets, effects, "2026-07", "2026-07-15");
    expect(r.categories).toHaveLength(2);
  });

  it("returns a null overall when no month cap is set", () => {
    const r = monthBudgets([budgets[1]], effects, "2026-07", "2026-07-15");
    expect(r.overall).toBeNull();
  });
});

describe("suggestedFromPreviousMonth", () => {
  const prev: Budget[] = [
    budget({ id: 7, categoryId: 1, month: "2026-06", amount: 5000 }),
    budget({ id: 8, categoryId: null, month: "2026-06", amount: 40000 }),
  ];

  it("carries last month's caps forward when the month is empty", () => {
    const s = suggestedFromPreviousMonth(prev, "2026-07", "2026-06");
    expect(s).toHaveLength(2);
    expect(s.every((b) => b.month === "2026-07")).toBe(true);
    expect(s.every((b) => b.id === -1)).toBe(true); // not persisted
  });

  it("suggests nothing once the month has its own budgets", () => {
    const withCurrent = [...prev, budget({ id: 9, categoryId: 1, month: "2026-07", amount: 6000 })];
    expect(suggestedFromPreviousMonth(withCurrent, "2026-07", "2026-06")).toHaveLength(0);
  });
});
