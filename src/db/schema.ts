import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  date,
  timestamp,
  pgEnum,
  uniqueIndex,
  type PgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Helper for the partial index predicate (is_default = true).
function sqlTrue(col: PgColumn) {
  return sql`${col} = true`;
}

export const accountTypeEnum = pgEnum("account_type", ["bank", "credit_card", "cash"]);
export const txnTypeEnum = pgEnum("txn_type", [
  "expense",
  "cc_spend",
  "bill_pay",
  "transfer",
  "withdrawal",
  "income",
]);
export const incomeSourceEnum = pgEnum("income_source", ["salary", "refund", "cashback", "other"]);
export const categoryColorEnum = pgEnum("category_color", [
  "blue",
  "teal",
  "violet",
  "amber",
  "rose",
  "green",
]);

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: accountTypeEnum("type").notNull(),
  openingBalance: integer("opening_balance").notNull().default(0),
  billingDay: integer("billing_day"), // 1–31, only for credit_card
  icon: text("icon"), // base64 data URL, nullable
  isArchived: boolean("is_archived").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id),
    icon: text("icon"),
    isDefault: boolean("is_default").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Exactly one default method — partial unique index on is_default = true.
    uniqueIndex("payment_methods_one_default")
      .on(t.isDefault)
      .where(sqlTrue(t.isDefault)),
  ],
);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: categoryColorEnum("color").notNull(),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  type: txnTypeEnum("type").notNull(),
  amount: integer("amount").notNull(), // positive whole rupees
  date: date("date").notNull(), // plain calendar date
  title: text("title").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  methodId: integer("method_id").references(() => paymentMethods.id),
  fromAccountId: integer("from_account_id").references(() => accounts.id),
  toAccountId: integer("to_account_id").references(() => accounts.id),
  incomeSource: incomeSourceEnum("income_source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const snapshots = pgTable("snapshots", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id),
  date: date("date").notNull(),
  actualBalance: integer("actual_balance").notNull(),
  expectedBalance: integer("expected_balance").notNull(), // frozen at save time
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Single-user lifecycle state that cannot be inferred from mutable ledger rows. */
export const appState = pgTable("app_state", {
  id: integer("id").primaryKey(),
  setupCompleted: boolean("setup_completed").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Monthly spending caps. `categoryId = null` is the overall month cap; one row
 * per (category, month). `month` is a "yyyy-MM" key — budgets are a calendar-month
 * concept even though the dashboard can show arbitrary ranges.
 */
export const budgets = pgTable(
  "budgets",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id").references(() => categories.id),
    month: text("month").notNull(), // "yyyy-MM"
    amount: integer("amount").notNull(), // positive whole rupees
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One budget per category per month; the overall cap (null category) is
    // handled by a second partial index since NULLs don't collide in Postgres.
    uniqueIndex("budgets_category_month").on(t.categoryId, t.month),
    uniqueIndex("budgets_overall_month")
      .on(t.month)
      .where(sql`${t.categoryId} is null`),
  ],
);

export const recurrenceEnum = pgEnum("recurrence", ["monthly", "weekly", "yearly"]);

/**
 * Saved templates for repeating spends (rent, EMIs, subscriptions). These never
 * auto-log — the app surfaces what is due and the user logs it in one tap.
 */
export const recurringTemplates = pgTable("recurring_templates", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: txnTypeEnum("type").notNull(),
  amount: integer("amount").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  methodId: integer("method_id").references(() => paymentMethods.id),
  fromAccountId: integer("from_account_id").references(() => accounts.id),
  toAccountId: integer("to_account_id").references(() => accounts.id),
  incomeSource: incomeSourceEnum("income_source"),
  recurrence: recurrenceEnum("recurrence").notNull().default("monthly"),
  /** Day of month (1–31, clamped to month length) for monthly/yearly. */
  dayOfMonth: integer("day_of_month"),
  /** 0=Sunday … 6=Saturday, for weekly. */
  dayOfWeek: integer("day_of_week"),
  /** Month 1–12, for yearly. */
  monthOfYear: integer("month_of_year"),
  /** Last date this template was logged from — drives "already done" state. */
  lastLoggedDate: date("last_logged_date"),
  isArchived: boolean("is_archived").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
