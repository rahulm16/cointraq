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
