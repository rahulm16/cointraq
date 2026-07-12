import "server-only";
import { db } from "./client";
import { accounts, paymentMethods, categories, transactions, snapshots } from "./schema";
import { eq, asc, desc, and, gte, lte, ilike, type SQL } from "drizzle-orm";
import type {
  Account,
  Category,
  PaymentMethod,
  Snapshot,
  Transaction,
  TxnEffect,
} from "@/lib/types";

/*
  Thin read layer. Server Components call these directly. Rows come back typed to
  the domain interfaces in lib/types. Volumes are tiny (single user) so we load
  full sets and compute in lib/ per SPEC §5.
*/

export async function getAccounts(includeArchived = true): Promise<Account[]> {
  const rows = await db.select().from(accounts).orderBy(asc(accounts.sortOrder), asc(accounts.id));
  const mapped = rows.map(mapAccount);
  return includeArchived ? mapped : mapped.filter((a) => !a.isArchived);
}

export async function getMethods(includeArchived = true): Promise<PaymentMethod[]> {
  const rows = await db
    .select()
    .from(paymentMethods)
    .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.id));
  const mapped = rows.map(mapMethod);
  return includeArchived ? mapped : mapped.filter((m) => !m.isArchived);
}

export async function getCategories(includeArchived = true): Promise<Category[]> {
  const rows = await db.select().from(categories).orderBy(asc(categories.id));
  const mapped = rows.map(mapCategory);
  return includeArchived ? mapped : mapped.filter((c) => !c.isArchived);
}

export async function getAllTransactions(): Promise<Transaction[]> {
  const rows = await db
    .select()
    .from(transactions)
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
  return rows.map(mapTxn);
}

/** Lean shape for the pure balance/aggregation math. */
export async function getTxnEffects(): Promise<TxnEffect[]> {
  const rows = await db
    .select({
      type: transactions.type,
      amount: transactions.amount,
      date: transactions.date,
      methodId: transactions.methodId,
      fromAccountId: transactions.fromAccountId,
      toAccountId: transactions.toAccountId,
      categoryId: transactions.categoryId,
    })
    .from(transactions);
  return rows as TxnEffect[];
}

export interface TxnFilter {
  monthStart?: string;
  monthEnd?: string;
  type?: string;
  methodId?: number;
  accountId?: number; // matches from/to/method's account — handled in caller for now via method/account
  categoryId?: number;
  search?: string;
}

/** Filtered transactions for the list. Combinable filters (SPEC §11). */
export async function getFilteredTransactions(f: TxnFilter): Promise<Transaction[]> {
  const conds: SQL[] = [];
  if (f.monthStart) conds.push(gte(transactions.date, f.monthStart));
  if (f.monthEnd) conds.push(lte(transactions.date, f.monthEnd));
  if (f.type) conds.push(eq(transactions.type, f.type as Transaction["type"]));
  if (f.methodId) conds.push(eq(transactions.methodId, f.methodId));
  if (f.categoryId) conds.push(eq(transactions.categoryId, f.categoryId));
  if (f.search && f.search.trim()) conds.push(ilike(transactions.note, `%${f.search.trim()}%`));

  const rows = await db
    .select()
    .from(transactions)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
  return rows.map(mapTxn);
}

/** Last N transactions by (date desc, created_at desc), all types. SPEC §7. */
export async function getRecentTransactions(limit = 8): Promise<Transaction[]> {
  const rows = await db
    .select()
    .from(transactions)
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit);
  return rows.map(mapTxn);
}

export async function getTransaction(id: number): Promise<Transaction | null> {
  const rows = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return rows[0] ? mapTxn(rows[0]) : null;
}

export async function getSnapshots(): Promise<Snapshot[]> {
  const rows = await db.select().from(snapshots).orderBy(desc(snapshots.date), desc(snapshots.createdAt));
  return rows.map(mapSnapshot);
}

export async function getSnapshotsForAccount(accountId: number): Promise<Snapshot[]> {
  const rows = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.accountId, accountId))
    .orderBy(desc(snapshots.date));
  return rows.map(mapSnapshot);
}

/* ---------- row -> domain mappers ---------- */

function mapAccount(r: typeof accounts.$inferSelect): Account {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    openingBalance: r.openingBalance,
    billingDay: r.billingDay,
    icon: r.icon,
    isArchived: r.isArchived,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt,
  };
}

function mapMethod(r: typeof paymentMethods.$inferSelect): PaymentMethod {
  return {
    id: r.id,
    name: r.name,
    accountId: r.accountId,
    icon: r.icon,
    isDefault: r.isDefault,
    isArchived: r.isArchived,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt,
  };
}

function mapCategory(r: typeof categories.$inferSelect): Category {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    isArchived: r.isArchived,
    createdAt: r.createdAt,
  };
}

function mapTxn(r: typeof transactions.$inferSelect): Transaction {
  return {
    id: r.id,
    type: r.type,
    amount: r.amount,
    date: r.date,
    note: r.note,
    categoryId: r.categoryId,
    methodId: r.methodId,
    fromAccountId: r.fromAccountId,
    toAccountId: r.toAccountId,
    incomeSource: r.incomeSource,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapSnapshot(r: typeof snapshots.$inferSelect): Snapshot {
  return {
    id: r.id,
    accountId: r.accountId,
    date: r.date,
    actualBalance: r.actualBalance,
    expectedBalance: r.expectedBalance,
    createdAt: r.createdAt,
  };
}
