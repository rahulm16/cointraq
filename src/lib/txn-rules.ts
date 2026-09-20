import type { Account, AccountType, Category, IncomeSource, PaymentMethod, TransactionType } from "./types";

/**
 * On the Spend form the user never picks a type: choosing a credit-card method
 * yields `cc_spend`, any other method yields `expense`. Re-derived on edit if the
 * method crosses the CC boundary.  SPEC §4 rule 1.
 */
export function deriveSpendType(methodAccountType: AccountType): "expense" | "cc_spend" {
  return methodAccountType === "credit_card" ? "cc_spend" : "expense";
}

/** category_id is allowed only on expense and cc_spend.  SPEC §4 rule 3. */
export function categoryAllowed(type: TransactionType): boolean {
  return type === "expense" || type === "cc_spend";
}

/** A method is a credit-card method when its linked account is a credit_card. */
export function isCreditCardMethod(methodAccountType: AccountType): boolean {
  return methodAccountType === "credit_card";
}

/** The fields that decide where a transaction's money moves. */
export interface TxnShape {
  type: TransactionType;
  categoryId: number | null;
  methodId: number | null;
  fromAccountId: number | null;
  toAccountId: number | null;
  incomeSource: IncomeSource | null;
}

export interface RuleLookups {
  accountType: (accountId: number) => AccountType | undefined;
  methodAccountType: (methodId: number) => AccountType | undefined;
  /** The active cash account every withdrawal lands in. */
  cashAccountId: number | null;
  categoryIsActive: (categoryId: number) => boolean;
}

export type RuleResult =
  | { ok: true; txn: TxnShape }
  | { ok: false; field: keyof TxnShape | "_"; message: string };

/** The one active cash account (lowest sort order wins if data predates the rule). */
export function activeCashAccountId(
  accounts: Pick<Account, "id" | "type" | "isArchived" | "sortOrder">[],
): number | null {
  const cash = accounts
    .filter((a) => a.type === "cash" && !a.isArchived)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  return cash[0]?.id ?? null;
}

export function ruleLookups(
  accounts: Pick<Account, "id" | "type" | "isArchived" | "sortOrder">[],
  methods: Pick<PaymentMethod, "id" | "accountId" | "isArchived">[],
  categories: Pick<Category, "id" | "isArchived">[],
): RuleLookups {
  // These rules create new ledger rows. Archived resources remain readable in
  // history, but are deliberately absent from the lookup used for new rows.
  const accountType = new Map(accounts.filter((a) => !a.isArchived).map((a) => [a.id, a.type]));
  const methodAccount = new Map(
    methods
      .filter((m) => !m.isArchived && accountType.has(m.accountId))
      .map((m) => [m.id, m.accountId]),
  );
  const activeCategories = new Set(categories.filter((c) => !c.isArchived).map((c) => c.id));
  return {
    accountType: (id) => accountType.get(id),
    methodAccountType: (id) => {
      const accountId = methodAccount.get(id);
      return accountId == null ? undefined : accountType.get(accountId);
    },
    cashAccountId: activeCashAccountId(accounts),
    categoryIsActive: (id) => activeCategories.has(id),
  };
}

/**
 * Enforce SPEC §4 on a transaction wherever it comes from — CSV import, recurring
 * templates — so none of them can write a row the Add form would refuse. Derives
 * expense vs cc_spend from the method and clears fields a type can't carry.
 */
export function normalizeTxn(input: TxnShape, lk: RuleLookups): RuleResult {
  const empty = { categoryId: null, methodId: null, fromAccountId: null, toAccountId: null, incomeSource: null };

  switch (input.type) {
    case "expense":
    case "cc_spend": {
      const methodType = input.methodId != null ? lk.methodAccountType(input.methodId) : undefined;
      if (input.methodId == null || !methodType) return { ok: false, field: "methodId", message: "Pick an active method" };
      if (input.categoryId != null && !lk.categoryIsActive(input.categoryId)) {
        return { ok: false, field: "categoryId", message: "Pick an active category" };
      }
      return {
        ok: true,
        txn: { ...empty, type: deriveSpendType(methodType), methodId: input.methodId, categoryId: input.categoryId },
      };
    }

    case "bill_pay": {
      const methodType = input.methodId != null ? lk.methodAccountType(input.methodId) : undefined;
      if (input.methodId == null || !methodType) return { ok: false, field: "methodId", message: "Pick a method" };
      if (methodType === "credit_card") {
        return { ok: false, field: "methodId", message: "Can't pay a card with a card" };
      }
      if (input.toAccountId == null || lk.accountType(input.toAccountId) !== "credit_card") {
        return { ok: false, field: "toAccountId", message: "Choose the credit card being paid" };
      }
      return { ok: true, txn: { ...empty, type: "bill_pay", methodId: input.methodId, toAccountId: input.toAccountId } };
    }

    case "transfer": {
      const from = input.fromAccountId;
      const to = input.toAccountId;
      if (from == null || !lk.accountType(from)) return { ok: false, field: "fromAccountId", message: "Pick a source" };
      if (to == null || !lk.accountType(to)) return { ok: false, field: "toAccountId", message: "Pick a destination" };
      if (from === to) return { ok: false, field: "toAccountId", message: "Must differ from source" };
      if (lk.accountType(from) === "credit_card" || lk.accountType(to) === "credit_card") {
        return { ok: false, field: "toAccountId", message: "Transfers use non-credit accounts" };
      }
      return { ok: true, txn: { ...empty, type: "transfer", fromAccountId: from, toAccountId: to } };
    }

    case "withdrawal": {
      const from = input.fromAccountId;
      if (from == null || lk.accountType(from) !== "bank") {
        return { ok: false, field: "fromAccountId", message: "Pick a bank account" };
      }
      // Keep an explicit cash destination (an old import); otherwise the active cash account.
      const to =
        input.toAccountId != null && lk.accountType(input.toAccountId) === "cash"
          ? input.toAccountId
          : lk.cashAccountId;
      if (to == null) return { ok: false, field: "_", message: "No cash account exists" };
      return { ok: true, txn: { ...empty, type: "withdrawal", fromAccountId: from, toAccountId: to } };
    }

    case "income": {
      const to = input.toAccountId;
      const toType = to != null ? lk.accountType(to) : undefined;
      if (to == null || !toType || toType === "credit_card") {
        return { ok: false, field: "toAccountId", message: "Pick where it landed" };
      }
      return { ok: true, txn: { ...empty, type: "income", toAccountId: to, incomeSource: input.incomeSource ?? "other" } };
    }
  }
}
