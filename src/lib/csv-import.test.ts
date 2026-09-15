import { describe, it, expect } from "vitest";
import { splitCsvLine, parseTransactionsCsv } from "./csv-import";
import { buildCsvs } from "./csv";
import type { Account, Category, PaymentMethod, Transaction } from "./types";

const accounts: Account[] = [
  { id: 1, name: "HDFC Bank", type: "bank", openingBalance: 0, billingDay: null, icon: null, isArchived: false, sortOrder: 0, createdAt: new Date() },
  { id: 2, name: "Cash in hand", type: "cash", openingBalance: 0, billingDay: null, icon: null, isArchived: false, sortOrder: 1, createdAt: new Date() },
  { id: 3, name: "HDFC Credit Card", type: "credit_card", openingBalance: 0, billingDay: 17, icon: null, isArchived: false, sortOrder: 2, createdAt: new Date() },
];

const methods: PaymentMethod[] = [
  { id: 10, name: "GPay", accountId: 1, icon: null, isDefault: true, isArchived: false, sortOrder: 0, createdAt: new Date() },
  { id: 11, name: "Cash", accountId: 2, icon: null, isDefault: false, isArchived: false, sortOrder: 1, createdAt: new Date() },
];

const categories: Category[] = [
  { id: 20, name: "Food", color: "blue", isArchived: false, createdAt: new Date() },
];

const ref = { accounts, methods, categories };
const TODAY = "2026-07-20";

describe("splitCsvLine", () => {
  it("splits plain cells", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("honours quoted cells containing commas", () => {
    expect(splitCsvLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  });

  it("unescapes doubled quotes", () => {
    expect(splitCsvLine('a,"say ""hi""",b')).toEqual(["a", 'say "hi"', "b"]);
  });

  it("preserves empty trailing cells", () => {
    expect(splitCsvLine("a,,")).toEqual(["a", "", ""]);
  });
});

describe("parseTransactionsCsv", () => {
  const header = "date,type,amount,title,category,method,from_account,to_account,income_source";

  it("parses a valid spend row", () => {
    const csv = `${header}\n2026-07-05,expense,240,chai,Food,GPay,,,`;
    const r = parseTransactionsCsv(csv, ref, TODAY);
    expect(r.errors).toHaveLength(0);
    expect(r.rows[0]).toMatchObject({
      type: "expense",
      amount: 240,
      date: "2026-07-05",
      title: "chai",
      categoryId: 20,
      methodId: 10,
    });
  });

  it("normalises rupee signs, commas and .00 tails", () => {
    const csv = `${header}\n2026-07-05,expense,"₹1,200.00",lunch,Food,GPay,,,`;
    const r = parseTransactionsCsv(csv, ref, TODAY);
    expect(r.rows[0].amount).toBe(1200);
  });

  it("rejects real paise", () => {
    const csv = `${header}\n2026-07-05,expense,240.50,chai,Food,GPay,,,`;
    const r = parseTransactionsCsv(csv, ref, TODAY);
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0].message).toMatch(/Invalid amount/);
  });

  it("rejects future dates", () => {
    const csv = `${header}\n2026-08-01,expense,240,chai,Food,GPay,,,`;
    const r = parseTransactionsCsv(csv, ref, TODAY);
    expect(r.errors[0].message).toMatch(/future/);
  });

  it("reports the failing line number and keeps good rows", () => {
    const csv = [header, "2026-07-05,expense,240,ok,Food,GPay,,,", "not-a-date,expense,100,bad,Food,GPay,,,"].join("\n");
    const r = parseTransactionsCsv(csv, ref, TODAY);
    expect(r.rows).toHaveLength(1);
    expect(r.errors[0].line).toBe(3);
  });

  it("collects names it could not resolve", () => {
    const csv = `${header}\n2026-07-05,expense,240,chai,Coffee,PhonePe,,,`;
    const r = parseTransactionsCsv(csv, ref, TODAY);
    expect(r.unknownCategories).toContain("Coffee");
    expect(r.unknownMethods).toContain("PhonePe");
    // Unresolved method means the spend row can't be imported.
    expect(r.rows).toHaveLength(0);
  });

  it("enforces per-type required fields", () => {
    const csv = [
      header,
      "2026-07-05,transfer,5000,move,,,HDFC Bank,,", // missing to_account
      "2026-07-06,income,90000,salary,,,,HDFC Bank,salary",
    ].join("\n");
    const r = parseTransactionsCsv(csv, ref, TODAY);
    expect(r.errors[0].message).toMatch(/Transfers need both accounts/);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].type).toBe("income");
  });

  it("strips a category from non-spend rows", () => {
    const csv = `${header}\n2026-07-05,bill_pay,9000,bill,Food,GPay,,HDFC Credit Card,`;
    const r = parseTransactionsCsv(csv, ref, TODAY);
    expect(r.rows[0].categoryId).toBeNull();
  });

  it("is case-insensitive about names and headers", () => {
    const csv = `DATE,TYPE,AMOUNT,TITLE,CATEGORY,METHOD,FROM_ACCOUNT,TO_ACCOUNT,INCOME_SOURCE\n2026-07-05,expense,240,chai,food,gpay,,,`;
    const r = parseTransactionsCsv(csv, ref, TODAY);
    expect(r.rows[0].categoryId).toBe(20);
    expect(r.rows[0].methodId).toBe(10);
  });

  it("accepts a legacy `note` column as the title", () => {
    const csv = `date,type,amount,note,category,method\n2026-07-05,expense,240,old note,Food,GPay`;
    const r = parseTransactionsCsv(csv, ref, TODAY);
    expect(r.rows[0].title).toBe("old note");
  });

  it("errors clearly on a file missing required columns", () => {
    const r = parseTransactionsCsv("foo,bar\n1,2", ref, TODAY);
    expect(r.errors[0].message).toMatch(/Missing required columns/);
  });

  it("errors on an empty file", () => {
    expect(parseTransactionsCsv("", ref, TODAY).errors[0].message).toMatch(/empty/);
  });

  it("round-trips the app's own export", () => {
    const txns: Transaction[] = [
      {
        id: 1, type: "expense", amount: 240, date: "2026-07-05", title: 'chai, "the good one"',
        categoryId: 20, methodId: 10, fromAccountId: null, toAccountId: null, incomeSource: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 2, type: "income", amount: 90000, date: "2026-07-01", title: "Salary",
        categoryId: null, methodId: null, fromAccountId: null, toAccountId: 1, incomeSource: "salary",
        createdAt: new Date(), updatedAt: new Date(),
      },
    ];

    const { transactions: csv } = buildCsvs({ transactions: txns, accounts, methods, categories, snapshots: [] });
    const r = parseTransactionsCsv(csv, ref, TODAY);

    expect(r.errors).toHaveLength(0);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].title).toBe('chai, "the good one"'); // quoting survived
    expect(r.rows[1]).toMatchObject({ type: "income", toAccountId: 1, incomeSource: "salary" });
  });
});
