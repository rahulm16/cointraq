import type { Account, Category, PaymentMethod, TransactionType } from "./types";
import { isValidDateStr } from "./dates";
import { AMOUNT_MAX, AMOUNT_MIN } from "./constants";

/**
 * CSV import — the inverse of `buildCsvs`. This is a *manual* import: the user
 * brings a file they exported (or built themselves). Nothing is fetched and
 * nothing syncs.
 *
 * The parser is deliberately forgiving about column order and header casing, but
 * strict about values: every row is validated against the same rules the add form
 * enforces, and a row that fails is reported rather than silently dropped.
 */

export interface ImportRow {
  /** 1-based line number in the source file, for error messages. */
  line: number;
  type: TransactionType;
  amount: number;
  date: string;
  title: string;
  categoryId: number | null;
  methodId: number | null;
  fromAccountId: number | null;
  toAccountId: number | null;
  incomeSource: "salary" | "refund" | "cashback" | "other" | null;
}

export interface ImportError {
  line: number;
  message: string;
}

export interface ParseResult {
  rows: ImportRow[];
  errors: ImportError[];
  /** Names referenced by the file that don't exist yet. */
  unknownCategories: string[];
  unknownMethods: string[];
  unknownAccounts: string[];
}

const TYPES: TransactionType[] = ["expense", "cc_spend", "bill_pay", "transfer", "withdrawal", "income"];
const SOURCES = ["salary", "refund", "cashback", "other"] as const;

/** Split one CSV line, honouring quoted cells and doubled quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Split a whole file into lines, tolerating CRLF and a trailing newline. */
function splitLines(text: string): string[] {
  return text
    .replace(/^﻿/, "") // strip a BOM from spreadsheet exports
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
}

/** Rupee amounts may arrive as "₹1,200" or "1200.00" — normalise to whole rupees. */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  // The app stores whole rupees; a .00 tail is fine, real paise is not.
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) > 0.001) return null;
  return rounded;
}

/**
 * Parse a transactions CSV against the user's existing accounts/methods/categories.
 * Names are resolved case-insensitively; unresolved names are surfaced so the UI
 * can tell the user exactly what's missing rather than failing opaquely.
 */
export function parseTransactionsCsv(
  text: string,
  ref: { accounts: Account[]; methods: PaymentMethod[]; categories: Category[] },
  today: string,
): ParseResult {
  const lines = splitLines(text);
  const errors: ImportError[] = [];
  const rows: ImportRow[] = [];
  const unknownCategories = new Set<string>();
  const unknownMethods = new Set<string>();
  const unknownAccounts = new Set<string>();

  if (lines.length === 0) {
    return { rows, errors: [{ line: 0, message: "File is empty" }], unknownCategories: [], unknownMethods: [], unknownAccounts: [] };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const col = (name: string) => headers.indexOf(name);

  const iDate = col("date");
  const iType = col("type");
  const iAmount = col("amount");
  const iTitle = col("title") !== -1 ? col("title") : col("note"); // pre-rename exports
  const iCategory = col("category");
  const iMethod = col("method");
  const iFrom = col("from_account");
  const iTo = col("to_account");
  const iSource = col("income_source");

  if (iDate === -1 || iAmount === -1) {
    return {
      rows,
      errors: [{ line: 1, message: "Missing required columns: date and amount" }],
      unknownCategories: [],
      unknownMethods: [],
      unknownAccounts: [],
    };
  }

  const byName = <T extends { name: string; id: number }>(list: T[], name: string): T | undefined =>
    list.find((x) => x.name.toLowerCase() === name.toLowerCase());

  for (let i = 1; i < lines.length; i++) {
    const line = i + 1;
    const cells = splitCsvLine(lines[i]);
    const at = (idx: number) => (idx === -1 ? "" : (cells[idx] ?? ""));

    const date = at(iDate);
    if (!isValidDateStr(date)) {
      errors.push({ line, message: `Invalid date "${date}"` });
      continue;
    }
    if (date > today) {
      errors.push({ line, message: `Date ${date} is in the future` });
      continue;
    }

    const amount = parseAmount(at(iAmount));
    if (amount === null || amount < AMOUNT_MIN || amount > AMOUNT_MAX) {
      errors.push({ line, message: `Invalid amount "${at(iAmount)}"` });
      continue;
    }

    const rawType = at(iType).toLowerCase() || "expense";
    if (!TYPES.includes(rawType as TransactionType)) {
      errors.push({ line, message: `Unknown type "${rawType}"` });
      continue;
    }
    const type = rawType as TransactionType;

    // Resolve names to ids, collecting anything unrecognised.
    const catName = at(iCategory);
    let categoryId: number | null = null;
    if (catName) {
      const hit = byName(ref.categories, catName);
      if (hit) categoryId = hit.id;
      else unknownCategories.add(catName);
    }

    const methodName = at(iMethod);
    let methodId: number | null = null;
    if (methodName) {
      const hit = byName(ref.methods, methodName);
      if (hit) methodId = hit.id;
      else unknownMethods.add(methodName);
    }

    const fromName = at(iFrom);
    let fromAccountId: number | null = null;
    if (fromName) {
      const hit = byName(ref.accounts, fromName);
      if (hit) fromAccountId = hit.id;
      else unknownAccounts.add(fromName);
    }

    const toName = at(iTo);
    let toAccountId: number | null = null;
    if (toName) {
      const hit = byName(ref.accounts, toName);
      if (hit) toAccountId = hit.id;
      else unknownAccounts.add(toName);
    }

    const rawSource = at(iSource).toLowerCase();
    const incomeSource = (SOURCES as readonly string[]).includes(rawSource)
      ? (rawSource as ImportRow["incomeSource"])
      : null;

    // Per-type required fields, mirroring SPEC §4.
    if ((type === "expense" || type === "cc_spend") && methodId === null) {
      errors.push({ line, message: "Spend rows need a known method" });
      continue;
    }
    if (type === "bill_pay" && (methodId === null || toAccountId === null)) {
      errors.push({ line, message: "Bill payments need a method and a credit card" });
      continue;
    }
    if (type === "transfer" && (fromAccountId === null || toAccountId === null)) {
      errors.push({ line, message: "Transfers need both accounts" });
      continue;
    }
    if (type === "withdrawal" && fromAccountId === null) {
      errors.push({ line, message: "Withdrawals need a source account" });
      continue;
    }
    if (type === "income" && toAccountId === null) {
      errors.push({ line, message: "Income needs a destination account" });
      continue;
    }

    rows.push({
      line,
      type,
      amount,
      date,
      title: at(iTitle) || defaultTitleFor(type),
      // Categories apply only to spends (SPEC §4 rule 3).
      categoryId: type === "expense" || type === "cc_spend" ? categoryId : null,
      methodId,
      fromAccountId,
      toAccountId,
      incomeSource: type === "income" ? (incomeSource ?? "other") : null,
    });
  }

  return {
    rows,
    errors,
    unknownCategories: [...unknownCategories],
    unknownMethods: [...unknownMethods],
    unknownAccounts: [...unknownAccounts],
  };
}

function defaultTitleFor(type: TransactionType): string {
  switch (type) {
    case "bill_pay":
      return "credit card bill";
    case "transfer":
      return "Transfer";
    case "withdrawal":
      return "Withdrawal";
    case "income":
      return "Income";
    default:
      return "Spend";
  }
}
