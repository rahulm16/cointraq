import "server-only";
import { db } from "./client";
import {
  accounts,
  paymentMethods,
  categories,
  transactions,
  snapshots,
  budgets,
  recurringTemplates,
  appState,
  txnTypeEnum,
} from "./schema";
import { eq, asc, desc, and, or, gte, lte, ilike, inArray, type SQL } from "drizzle-orm";
import { parseSearch, isEmptyQuery } from "@/lib/search";
import type {
  Account,
  Budget,
  Category,
  PaymentMethod,
  RecurringTemplate,
  Snapshot,
  Transaction,
  TransactionType,
  TxnEffect,
} from "@/lib/types";
import { formKindForType, type FormKind, type TitlesByKind } from "@/lib/txn-display";

/*
  Thin read layer. Server Components call these directly. Rows come back typed to
  the domain interfaces in lib/types. Volumes are tiny (single user) so we load
  full sets and compute in lib/ per SPEC §5.
*/

export type { TitlesByKind };

const EMPTY_TITLES: TitlesByKind = {
  spend: [],
  bill_pay: [],
  transfer: [],
  withdrawal: [],
  income: [],
};

/** Distinct recent titles per form-kind (for autocomplete). Newest first. */
export async function getTitlesByKind(limitPerKind = 40): Promise<TitlesByKind> {
  const rows = await db
    .select({ type: transactions.type, title: transactions.title })
    .from(transactions)
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(800);

  const out: TitlesByKind = { ...EMPTY_TITLES, spend: [], bill_pay: [], transfer: [], withdrawal: [], income: [] };
  const seen: Record<FormKind, Set<string>> = {
    spend: new Set(),
    bill_pay: new Set(),
    transfer: new Set(),
    withdrawal: new Set(),
    income: new Set(),
  };

  for (const r of rows) {
    const kind = formKindForType(r.type as TransactionType);
    const title = r.title.trim();
    if (!title) continue;
    const key = title.toLowerCase();
    if (seen[kind].has(key)) continue;
    if (out[kind].length >= limitPerKind) continue;
    seen[kind].add(key);
    out[kind].push(title);
  }
  return out;
}

export async function getAccounts(includeArchived = true): Promise<Account[]> {
  const rows = await db.select().from(accounts).orderBy(asc(accounts.sortOrder), asc(accounts.id));
  const mapped = rows.map(mapAccount);
  return includeArchived ? mapped : mapped.filter((a) => !a.isArchived);
}

export async function getSetupCompleted(): Promise<boolean> {
  const [row] = await db
    .select({ setupCompleted: appState.setupCompleted })
    .from(appState)
    .where(eq(appState.id, 1))
    .limit(1);
  return row?.setupCompleted ?? false;
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
      // Decides whether a transaction on a snapshot's own date came after it (lib/balances).
      createdAt: transactions.createdAt,
    })
    .from(transactions);
  return rows as TxnEffect[];
}

/** Date of the oldest transaction, or null when the ledger is empty. */
export async function getEarliestTransactionDate(): Promise<string | null> {
  const rows = await db
    .select({ date: transactions.date })
    .from(transactions)
    .orderBy(asc(transactions.date))
    .limit(1);
  return rows[0]?.date ?? null;
}

/** Escape LIKE wildcards so searching "50%" or "a_b" matches those characters literally. */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export interface TxnFilter {
  from?: string;
  to?: string;
  /** @deprecated use from */
  monthStart?: string;
  /** @deprecated use to */
  monthEnd?: string;
  type?: string;
  methodId?: number;
  accountId?: number;
  categoryId?: number;
  search?: string;
  /** Methods whose name matches the search text — their transactions match too. */
  nameMethodIds?: number[];
  /** Categories whose name matches the search text — their transactions match too. */
  nameCategoryIds?: number[];
}

/** Filtered transactions for the list. Combinable filters (SPEC §11). */
export async function getFilteredTransactions(f: TxnFilter): Promise<Transaction[]> {
  const conds: SQL[] = [];
  const start = f.from ?? f.monthStart;
  const end = f.to ?? f.monthEnd;
  if (start) conds.push(gte(transactions.date, start));
  if (end) conds.push(lte(transactions.date, end));
  // An unknown type would make Postgres reject the enum comparison; ignore it instead.
  if (f.type && (txnTypeEnum.enumValues as readonly string[]).includes(f.type)) {
    conds.push(eq(transactions.type, f.type as Transaction["type"]));
  }
  if (f.methodId) conds.push(eq(transactions.methodId, f.methodId));
  if (f.categoryId) conds.push(eq(transactions.categoryId, f.categoryId));

  // Search understands amounts and ranges as well as title text (lib/search).
  const q = parseSearch(f.search);
  if (!isEmptyQuery(q)) {
    if (q.min !== null) conds.push(gte(transactions.amount, q.min));
    if (q.max !== null) conds.push(lte(transactions.amount, q.max));
    if (q.text) {
      // The title, OR a method/category with that name, OR — for a bare number like
      // "2024" — that exact amount.
      const alts: SQL[] = [ilike(transactions.title, `%${escapeLike(q.text)}%`)];
      if (q.amount !== null) alts.push(eq(transactions.amount, q.amount));
      if (f.nameMethodIds?.length) alts.push(inArray(transactions.methodId, f.nameMethodIds));
      if (f.nameCategoryIds?.length) alts.push(inArray(transactions.categoryId, f.nameCategoryIds));
      conds.push(or(...alts) as SQL);
    }
  }

  const rows = await db
    .select()
    .from(transactions)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
  return rows.map(mapTxn);
}

/** Last N transactions by (date desc, created_at desc). Optionally scoped to a range. */
export async function getRecentTransactions(
  limit = 8,
  range?: { from?: string; to?: string },
): Promise<Transaction[]> {
  const conds: SQL[] = [];
  if (range?.from) conds.push(gte(transactions.date, range.from));
  if (range?.to) conds.push(lte(transactions.date, range.to));
  const rows = await db
    .select()
    .from(transactions)
    .where(conds.length ? and(...conds) : undefined)
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
    title: r.title,
    categoryId: r.categoryId,
    methodId: r.methodId,
    fromAccountId: r.fromAccountId,
    toAccountId: r.toAccountId,
    incomeSource: r.incomeSource,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/* ---- Budgets ---- */

/** Every budget row. Volumes are tiny; lib/budgets filters by month. */
export async function getBudgets(): Promise<Budget[]> {
  const rows = await db.select().from(budgets).orderBy(asc(budgets.month));
  return rows.map(mapBudget);
}

/* ---- Recurring templates ---- */

export async function getRecurringTemplates(includeArchived = false): Promise<RecurringTemplate[]> {
  const rows = await db
    .select()
    .from(recurringTemplates)
    .orderBy(asc(recurringTemplates.sortOrder), asc(recurringTemplates.id));
  const mapped = rows.map(mapTemplate);
  return includeArchived ? mapped : mapped.filter((t) => !t.isArchived);
}

/* ---- Title → category/method inference (P3) ---- */

export interface TitleMemory {
  /** Lowercased title → the most recent categoryId/methodId used with it. */
  byTitle: Record<string, { categoryId: number | null; methodId: number | null }>;
}

/**
 * What the user last did for each spend title, so re-typing "chai" can pre-fill
 * its category and method. Built from recent spends only — a title's meaning
 * drifts, and the newest use is the best guess.
 */
export async function getTitleMemory(limit = 600): Promise<TitleMemory> {
  const rows = await db
    .select({
      title: transactions.title,
      categoryId: transactions.categoryId,
      methodId: transactions.methodId,
      type: transactions.type,
    })
    .from(transactions)
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit);

  const byTitle: TitleMemory["byTitle"] = {};
  for (const r of rows) {
    if (r.type !== "expense" && r.type !== "cc_spend") continue;
    const key = r.title.trim().toLowerCase();
    if (!key || key in byTitle) continue; // first hit is the newest
    byTitle[key] = { categoryId: r.categoryId, methodId: r.methodId };
  }
  return { byTitle };
}

/**
 * The user's most-repeated recent spends, for one-tap quick-add chips (P3).
 * Ranked by frequency then recency, so the chips reflect actual habits.
 */
export interface QuickAddSuggestion {
  title: string;
  amount: number;
  categoryId: number | null;
  methodId: number | null;
  count: number;
}

export async function getQuickAddSuggestions(limit = 5, scan = 400): Promise<QuickAddSuggestion[]> {
  const rows = await db
    .select({
      title: transactions.title,
      amount: transactions.amount,
      categoryId: transactions.categoryId,
      methodId: transactions.methodId,
      type: transactions.type,
    })
    .from(transactions)
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(scan);

  const groups = new Map<string, QuickAddSuggestion & { amounts: number[] }>();
  for (const r of rows) {
    if (r.type !== "expense" && r.type !== "cc_spend") continue;
    const title = r.title.trim();
    const key = title.toLowerCase();
    if (!key) continue;
    const g = groups.get(key);
    if (g) {
      g.count++;
      g.amounts.push(r.amount);
    } else {
      groups.set(key, {
        title,
        amount: r.amount, // newest amount is the default
        categoryId: r.categoryId,
        methodId: r.methodId,
        count: 1,
        amounts: [r.amount],
      });
    }
  }

  return [...groups.values()]
    .filter((g) => g.count >= 2) // a one-off isn't a habit
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((g) => ({
      title: g.title,
      amount: g.amount,
      categoryId: g.categoryId,
      methodId: g.methodId,
      count: g.count,
    }));
}

function mapBudget(r: typeof budgets.$inferSelect): Budget {
  return {
    id: r.id,
    categoryId: r.categoryId,
    month: r.month,
    amount: r.amount,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapTemplate(r: typeof recurringTemplates.$inferSelect): RecurringTemplate {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    amount: r.amount,
    categoryId: r.categoryId,
    methodId: r.methodId,
    fromAccountId: r.fromAccountId,
    toAccountId: r.toAccountId,
    incomeSource: r.incomeSource,
    recurrence: r.recurrence,
    dayOfMonth: r.dayOfMonth,
    dayOfWeek: r.dayOfWeek,
    monthOfYear: r.monthOfYear,
    lastLoggedDate: r.lastLoggedDate,
    isArchived: r.isArchived,
    sortOrder: r.sortOrder,
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
