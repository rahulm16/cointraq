import type { CategoryColor } from "./constants";

export type AccountType = "bank" | "credit_card" | "cash";

export type TransactionType =
  | "expense"
  | "cc_spend"
  | "bill_pay"
  | "transfer"
  | "withdrawal"
  | "income";

export type IncomeSource = "salary" | "refund" | "cashback" | "other";

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  openingBalance: number;
  billingDay: number | null;
  icon: string | null;
  isArchived: boolean;
  sortOrder: number;
  createdAt: Date;
}

export interface PaymentMethod {
  id: number;
  name: string;
  accountId: number;
  icon: string | null;
  isDefault: boolean;
  isArchived: boolean;
  sortOrder: number;
  createdAt: Date;
}

export interface Category {
  id: number;
  name: string;
  color: CategoryColor;
  isArchived: boolean;
  createdAt: Date;
}

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  date: string; // yyyy-MM-dd, plain calendar date
  title: string;
  categoryId: number | null;
  methodId: number | null;
  fromAccountId: number | null;
  toAccountId: number | null;
  incomeSource: IncomeSource | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Snapshot {
  id: number;
  accountId: number;
  date: string; // yyyy-MM-dd
  actualBalance: number;
  expectedBalance: number;
  createdAt: Date;
}

// A minimal transaction shape the pure balance/aggregation math operates on.
// Framework-free — no DB rows required, just these fields.
export interface TxnEffect {
  type: TransactionType;
  amount: number;
  date: string;
  methodId: number | null;
  fromAccountId: number | null;
  toAccountId: number | null;
  categoryId: number | null;
}
