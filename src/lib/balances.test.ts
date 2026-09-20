import { describe, it, expect } from "vitest";
import { expectedBalance, ccOutstanding, effectOnAccount } from "./balances";
import type { Account, TxnEffect } from "./types";

const bank: Account = {
  id: 1,
  name: "HDFC Bank",
  type: "bank",
  openingBalance: 50000,
  billingDay: null,
  icon: null,
  isArchived: false,
  sortOrder: 0,
  createdAt: new Date(),
};
const card: Account = { ...bank, id: 3, name: "HDFC CC", type: "credit_card", openingBalance: 0, billingDay: 17 };
const cash: Account = { ...bank, id: 4, name: "Cash", type: "cash", openingBalance: 1000 };

// method 10 -> bank(1); method 30 -> card(3)
const methodAccount = (id: number) => ({ 10: 1, 30: 3 }[id]);

function tx(p: Partial<TxnEffect> & Pick<TxnEffect, "type" | "amount" | "date">): TxnEffect {
  return {
    methodId: null,
    fromAccountId: null,
    toAccountId: null,
    categoryId: null,
    ...p,
  };
}

describe("effectOnAccount", () => {
  it("expense debits the method's account", () => {
    const t = tx({ type: "expense", amount: 500, date: "2026-07-01", methodId: 10 });
    expect(effectOnAccount(t, 1, "bank", methodAccount)).toBe(-500);
    expect(effectOnAccount(t, 3, "credit_card", methodAccount)).toBe(0);
  });

  it("cc_spend raises outstanding on the card", () => {
    const t = tx({ type: "cc_spend", amount: 800, date: "2026-07-01", methodId: 30 });
    expect(effectOnAccount(t, 3, "credit_card", methodAccount)).toBe(800);
  });

  it("bill_pay debits method account and reduces CC owed", () => {
    const t = tx({ type: "bill_pay", amount: 1000, date: "2026-07-01", methodId: 10, toAccountId: 3 });
    expect(effectOnAccount(t, 1, "bank", methodAccount)).toBe(-1000);
    expect(effectOnAccount(t, 3, "credit_card", methodAccount)).toBe(-1000);
  });

  it("transfer moves between accounts", () => {
    const t = tx({ type: "transfer", amount: 2000, date: "2026-07-01", fromAccountId: 1, toAccountId: 4 });
    expect(effectOnAccount(t, 1, "bank", methodAccount)).toBe(-2000);
    expect(effectOnAccount(t, 4, "cash", methodAccount)).toBe(2000);
  });

  it("withdrawal moves bank->cash", () => {
    const t = tx({ type: "withdrawal", amount: 3000, date: "2026-07-01", fromAccountId: 1, toAccountId: 4 });
    expect(effectOnAccount(t, 1, "bank", methodAccount)).toBe(-3000);
    expect(effectOnAccount(t, 4, "cash", methodAccount)).toBe(3000);
  });

  it("income credits the to_account", () => {
    const t = tx({ type: "income", amount: 90000, date: "2026-07-01", toAccountId: 1, incomeSource: "salary" } as never);
    expect(effectOnAccount(t, 1, "bank", methodAccount)).toBe(90000);
  });
});

describe("expectedBalance — opening baseline", () => {
  const txns = [
    tx({ type: "income", amount: 90000, date: "2026-07-01", toAccountId: 1 }),
    tx({ type: "expense", amount: 500, date: "2026-07-05", methodId: 10 }),
    tx({ type: "expense", amount: 200, date: "2026-07-20", methodId: 10 }), // after asOf
  ];
  it("sums effects up to and including asOf, from opening", () => {
    const bal = expectedBalance(bank, "2026-07-10", txns, { value: bank.openingBalance, date: null }, methodAccount);
    // 50000 + 90000 - 500 = 139500
    expect(bal).toBe(139500);
  });
});

describe("expectedBalance — snapshot baseline excludes on/before baseline date", () => {
  const txns = [
    tx({ type: "expense", amount: 500, date: "2026-07-05", methodId: 10 }), // on baseline day -> excluded
    tx({ type: "expense", amount: 300, date: "2026-07-06", methodId: 10 }), // after baseline -> included
  ];
  it("only counts strictly-after-baseline txns", () => {
    const bal = expectedBalance(bank, "2026-07-10", txns, { value: 64320, date: "2026-07-05" }, methodAccount);
    expect(bal).toBe(64320 - 300);
  });
});

describe("ccOutstanding", () => {
  const txns = [
    tx({ type: "cc_spend", amount: 9640, date: "2026-07-02", methodId: 30 }),
    tx({ type: "bill_pay", amount: 14200, date: "2026-07-03", methodId: 10, toAccountId: 3 }),
  ];
  it("opening + cc_spend − bill_pay(to card)", () => {
    expect(ccOutstanding(card, "2026-07-31", txns, methodAccount)).toBe(9640 - 14200);
  });
});

describe("expectedBalance — same-day transactions logged after the snapshot", () => {
  const savedAt = new Date("2026-07-05T04:30:00Z");
  const txns = [
    // Logged before saving: already inside the actual balance the user counted.
    tx({ type: "expense", amount: 500, date: "2026-07-05", methodId: 10, createdAt: new Date("2026-07-05T03:00:00Z") }),
    // Logged after saving, same date: must still reduce the balance.
    tx({ type: "expense", amount: 240, date: "2026-07-05", methodId: 10, createdAt: new Date("2026-07-05T08:00:00Z") }),
  ];
  it("counts only the ones logged after the snapshot was saved", () => {
    const baseline = { value: 38000, date: "2026-07-05", createdAt: savedAt };
    expect(expectedBalance(bank, "2026-07-10", txns, baseline, methodAccount)).toBe(38000 - 240);
  });
});
