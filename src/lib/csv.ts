import type { Account, Category, PaymentMethod, Snapshot, Transaction } from "./types";

/** Quote a CSV cell (UTF-8; wrap when it contains comma/quote/newline). */
function cell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(cell).join(",")];
  for (const r of rows) lines.push(r.map(cell).join(","));
  return lines.join("\n") + "\n";
}

/** Build the three CSVs (names, not ids, for readability). SPEC §12. */
export function buildCsvs(input: {
  transactions: Transaction[];
  accounts: Account[];
  methods: PaymentMethod[];
  categories: Category[];
  snapshots: Snapshot[];
}): { transactions: string; accounts: string; snapshots: string } {
  const { transactions, accounts, methods, categories, snapshots } = input;
  const accName = (id: number | null) => accounts.find((a) => a.id === id)?.name ?? "";
  const methodName = (id: number | null) => methods.find((m) => m.id === id)?.name ?? "";
  const catName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? "";

  const txnCsv = toCsv(
    ["id", "date", "type", "amount", "title", "category", "method", "from_account", "to_account", "income_source", "created_at"],
    transactions.map((t) => [
      t.id,
      t.date,
      t.type,
      t.amount,
      t.title,
      catName(t.categoryId),
      methodName(t.methodId),
      accName(t.fromAccountId),
      accName(t.toAccountId),
      t.incomeSource ?? "",
      t.createdAt.toISOString(),
    ]),
  );

  const accCsv = toCsv(
    ["name", "type", "opening_balance", "billing_day", "is_archived"],
    accounts.map((a) => [a.name, a.type, a.openingBalance, a.billingDay ?? "", a.isArchived ? "true" : "false"]),
  );

  const snapCsv = toCsv(
    ["date", "account", "expected_balance", "actual_balance", "delta"],
    snapshots.map((s) => [
      s.date,
      accName(s.accountId),
      s.expectedBalance,
      s.actualBalance,
      s.actualBalance - s.expectedBalance,
    ]),
  );

  return { transactions: txnCsv, accounts: accCsv, snapshots: snapCsv };
}
