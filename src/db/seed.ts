import "dotenv/config";
import { db, schema } from "./client";
import { todayIST, monthKey, monthRange, shiftMonth } from "../lib/dates";

/**
 * Seed the initial state (SPEC §3) plus ~2 months of sample transactions across
 * every type, so the app has data to test against. Idempotent-ish: bails if
 * accounts already exist. Nothing here is hardcoded in the app — just starting
 * data, all editable in Settings. Transactions are dated relative to IST "today"
 * so they always populate the current and previous month.
 */
async function seed() {
  const existing = await db.select({ id: schema.accounts.id }).from(schema.accounts).limit(1);
  if (existing.length > 0) {
    console.log("Seed skipped — accounts already exist.");
    return;
  }

  const [hdfc, karnataka, hdfcCC, cash] = await db
    .insert(schema.accounts)
    .values([
      // Opening balances give the dashboard/reconcile something realistic.
      { name: "HDFC Bank", type: "bank", openingBalance: 40000, sortOrder: 0 },
      { name: "Karnataka Bank", type: "bank", openingBalance: 120000, sortOrder: 1 },
      { name: "HDFC Credit Card", type: "credit_card", billingDay: 17, openingBalance: 0, sortOrder: 2 },
      { name: "Cash in hand", type: "cash", openingBalance: 2000, sortOrder: 3 },
    ])
    .returning();

  const [gpay, cred, phonepe, debit, ccMethod, cashMethod] = await db
    .insert(schema.paymentMethods)
    .values([
      { name: "GPay", accountId: karnataka.id, isDefault: true, sortOrder: 0 },
      { name: "CRED", accountId: hdfc.id, sortOrder: 1 },
      { name: "PhonePe", accountId: karnataka.id, sortOrder: 2 },
      { name: "Debit card", accountId: hdfc.id, sortOrder: 3 },
      { name: "Credit card", accountId: hdfcCC.id, sortOrder: 4 },
      { name: "Cash", accountId: cash.id, sortOrder: 5 },
    ])
    .returning();

  const [food, groceries, travel, bills, fun, shopping] = await db
    .insert(schema.categories)
    .values([
      { name: "Food", color: "blue" },
      { name: "Groceries", color: "teal" },
      { name: "Travel", color: "violet" },
      { name: "Bills", color: "amber" },
      { name: "Fun", color: "rose" },
      { name: "Shopping", color: "green" },
    ])
    .returning();

  // --- Build dated transactions across this month + last month ---
  const thisMonth = monthKey(todayIST());
  const lastMonth = shiftMonth(thisMonth, -1);

  type Row = typeof schema.transactions.$inferInsert;
  const rows: Row[] = [];

  // Helper: nth day of a "yyyy-MM" month, clamped to the month, not exceeding today.
  const today = todayIST();
  const dayOf = (mk: string, day: number): string => {
    const { start, end } = monthRange(mk);
    const d = start.slice(0, 8) + String(day).padStart(2, "0");
    const clamped = d > end ? end : d;
    return clamped > today ? today : clamped;
  };

  // A month's worth of everyday spends + income + a bill cycle, parameterized so
  // both months look similar but not identical.
  function monthOfActivity(mk: string, opts: { salary: number; billPay: number | null }) {
    // Income: salary lands in HDFC on the 1st.
    rows.push({
      type: "income",
      amount: opts.salary,
      date: dayOf(mk, 1),
      toAccountId: hdfc.id,
      incomeSource: "salary",
      title: "Monthly salary",
    });

    // Regular expenses (non-CC), varied methods & categories.
    const expenses: [number, number, number, number, string][] = [
      // [day, amount, methodId, categoryId, title]
      [2, 240, gpay.id, food.id, "chai & snacks"],
      [3, 1850, phonepe.id, groceries.id, "big basket"],
      [4, 120, cashMethod.id, food.id, "auto"],
      [5, 640, gpay.id, food.id, "dinner with Adi"],
      [7, 3200, debit.id, shopping.id, "shoes"],
      [9, 450, gpay.id, travel.id, "metro card"],
      [11, 900, phonepe.id, food.id, "swiggy"],
      [13, 2100, gpay.id, groceries.id, "monthly groceries"],
      [15, 300, cashMethod.id, food.id, "vegetables"],
      [18, 1500, debit.id, fun.id, "movie night"],
      [21, 780, gpay.id, food.id, "lunch"],
      [24, 5400, cred.id, bills.id, "electricity + wifi"],
      [26, 260, gpay.id, travel.id, "uber"],
      [28, 1200, phonepe.id, shopping.id, "books"],
    ];
    for (const [day, amount, methodId, categoryId, title] of expenses) {
      rows.push({ type: "expense", amount, date: dayOf(mk, day), methodId, categoryId, title });
    }

    // Credit-card spends (informational ledger).
    const ccSpends: [number, number, number, string][] = [
      [3, 3400, food.id, "restaurant"],
      [8, 6800, shopping.id, "amazon order"],
      [14, 2200, travel.id, "flight seat"],
      [20, 1900, fun.id, "concert tickets"],
      [25, 4100, groceries.id, "costco run"],
    ];
    for (const [day, amount, categoryId, title] of ccSpends) {
      rows.push({ type: "cc_spend", amount, date: dayOf(mk, day), methodId: ccMethod.id, categoryId, title });
    }

    // Bill payment for the previous cycle (counts as a spend).
    if (opts.billPay != null) {
      rows.push({
        type: "bill_pay",
        amount: opts.billPay,
        date: dayOf(mk, 19),
        methodId: debit.id,
        toAccountId: hdfcCC.id,
        title: "credit card bill",
      });
    }

    // A transfer and a withdrawal (neither is a spend).
    rows.push({ type: "transfer", amount: 10000, date: dayOf(mk, 6), fromAccountId: karnataka.id, toAccountId: hdfc.id, title: "top-up HDFC" });
    rows.push({ type: "withdrawal", amount: 5000, date: dayOf(mk, 10), fromAccountId: hdfc.id, toAccountId: cash.id, title: "ATM" });

    // A refund income into Karnataka.
    rows.push({ type: "income", amount: 899, date: dayOf(mk, 12), toAccountId: karnataka.id, incomeSource: "refund", title: "return refund" });
  }

  monthOfActivity(lastMonth, { salary: 95000, billPay: 12800 });
  monthOfActivity(thisMonth, { salary: 98000, billPay: 14200 });

  await db.insert(schema.transactions).values(rows);

  console.log(
    `Seed complete: 4 accounts, 6 methods, 6 categories, ${rows.length} transactions across ${lastMonth} and ${thisMonth}.`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
