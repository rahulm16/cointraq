import { describe, expect, it } from "vitest";
import { normalizeTxn, ruleLookups } from "./txn-rules";
import type { Account, Category, PaymentMethod } from "./types";

const now = new Date("2026-09-20T00:00:00Z");
const accounts: Account[] = [
  { id: 1, name: "Bank", type: "bank", openingBalance: 0, billingDay: null, icon: null, isArchived: false, sortOrder: 0, createdAt: now },
  { id: 2, name: "Cash", type: "cash", openingBalance: 0, billingDay: null, icon: null, isArchived: false, sortOrder: 1, createdAt: now },
  { id: 3, name: "Old bank", type: "bank", openingBalance: 0, billingDay: null, icon: null, isArchived: true, sortOrder: 2, createdAt: now },
];
const methods: PaymentMethod[] = [
  { id: 10, name: "Active", accountId: 1, icon: null, isDefault: true, isArchived: false, sortOrder: 0, createdAt: now },
  { id: 11, name: "Archived", accountId: 1, icon: null, isDefault: false, isArchived: true, sortOrder: 1, createdAt: now },
  { id: 12, name: "Linked to archived", accountId: 3, icon: null, isDefault: false, isArchived: false, sortOrder: 2, createdAt: now },
];
const categories: Category[] = [
  { id: 20, name: "Food", color: "blue", isArchived: false, createdAt: now },
  { id: 21, name: "Old", color: "rose", isArchived: true, createdAt: now },
];

const spend = (methodId: number, categoryId: number | null = 20) => ({
  type: "expense" as const,
  categoryId,
  methodId,
  fromAccountId: null,
  toAccountId: null,
  incomeSource: null,
});

describe("normalizeTxn active-resource rules", () => {
  const lookups = ruleLookups(accounts, methods, categories);

  it("rejects an archived method", () => {
    expect(normalizeTxn(spend(11), lookups)).toMatchObject({ ok: false, field: "methodId" });
  });

  it("rejects a method linked to an archived account", () => {
    expect(normalizeTxn(spend(12), lookups)).toMatchObject({ ok: false, field: "methodId" });
  });

  it("rejects an archived category", () => {
    expect(normalizeTxn(spend(10, 21), lookups)).toMatchObject({ ok: false, field: "categoryId" });
  });

  it("accepts active resources", () => {
    expect(normalizeTxn(spend(10), lookups)).toMatchObject({ ok: true });
  });
});
