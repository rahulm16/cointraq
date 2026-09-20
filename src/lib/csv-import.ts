import type { Account, Category, IncomeSource, PaymentMethod, TransactionType } from "./types";
import { isValidDateStr } from "./dates";
import { AMOUNT_MAX, AMOUNT_MIN } from "./constants";
import { normalizeTxn, ruleLookups } from "./txn-rules";

/**
 * CSV import — the inverse of `buildCsvs`. This is a *manual* import: the user
 * brings a file they exported (or built themselves). Nothing is fetched and
 * nothing syncs.
 *
 * The parser is deliberately forgiving about column order and header casing, but
 * strict about values: every row goes through the same transaction rules the Add
 * form enforces (lib/txn-rules), and a row that fails is reported rather than
 * silently dropped.
 */

export interface ImportRow {
  /** Identity from a Cointraq export; null for arbitrary CSV files. */
  sourceId: number | null;
  sourceCreatedAt: string | null;
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
  incomeSource: IncomeSource | null;
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

/** Split one CSV record, honouring quoted cells and doubled quotes. */
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

/**
 * Split a file into records, tolerating a BOM, CRLF and a trailing newline. A
 * newline inside a quoted cell belongs to that cell (the export quotes them), so
 * this walks the text instead of splitting on "\n". Each record keeps the line it
 * starts on for error messages.
 */
export function splitRecords(text: string): { text: string; line: number }[] {
  const src = text.replace(/^﻿/, "");
  const out: { text: string; line: number }[] = [];
  let cur = "";
  let inQuotes = false;
  let line = 1;
  let startLine = 1;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"') {
      // A doubled quote inside a quoted cell is an escaped quote, not a toggle.
      if (inQuotes && src[i + 1] === '"') {
        cur += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      cur += ch;
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      if (cur.trim() !== "") out.push({ text: cur, line: startLine });
      cur = "";
      line++;
      startLine = line;
      continue;
    }
    if (ch === "\n") line++;
    cur += ch;
  }
  if (cur.trim() !== "") out.push({ text: cur, line: startLine });
  return out;
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
  const records = splitRecords(text);
  const errors: ImportError[] = [];
  const rows: ImportRow[] = [];
  const unknownCategories = new Set<string>();
  const unknownMethods = new Set<string>();
  const unknownAccounts = new Set<string>();

  if (records.length === 0) {
    return { rows, errors: [{ line: 0, message: "File is empty" }], unknownCategories: [], unknownMethods: [], unknownAccounts: [] };
  }

  const headers = splitCsvLine(records[0].text).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const col = (name: string) => headers.indexOf(name);

  const iId = col("id");
  const iDate = col("date");
  const iType = col("type");
  const iAmount = col("amount");
  const iTitle = col("title") !== -1 ? col("title") : col("note"); // pre-rename exports
  const iCategory = col("category");
  const iMethod = col("method");
  const iFrom = col("from_account");
  const iTo = col("to_account");
  const iSource = col("income_source");
  const iCreatedAt = col("created_at");

  if (iDate === -1 || iAmount === -1) {
    return {
      rows,
      errors: [{ line: records[0].line, message: "Missing required columns: date and amount" }],
      unknownCategories: [],
      unknownMethods: [],
      unknownAccounts: [],
    };
  }

  const byName = <T extends { name: string; id: number }>(list: T[], name: string): T | undefined =>
    list.find((x) => x.name.toLowerCase() === name.toLowerCase());

  const lookups = ruleLookups(ref.accounts, ref.methods, ref.categories);

  for (let i = 1; i < records.length; i++) {
    const { line } = records[i];
    const cells = splitCsvLine(records[i].text);
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

    const rawSourceId = Number(at(iId));
    const sourceId = Number.isInteger(rawSourceId) && rawSourceId > 0 ? rawSourceId : null;
    const rawCreatedAt = at(iCreatedAt);
    const parsedCreatedAt = rawCreatedAt ? new Date(rawCreatedAt) : null;
    const sourceCreatedAt = parsedCreatedAt && !Number.isNaN(parsedCreatedAt.getTime())
      ? parsedCreatedAt.toISOString()
      : null;

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
      ? (rawSource as IncomeSource)
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

    // The same rules as the Add form: spend type follows the method, account
    // types must fit, withdrawals land in cash, categories only on spends.
    const ruled = normalizeTxn({ type, categoryId, methodId, fromAccountId, toAccountId, incomeSource }, lookups);
    if (!ruled.ok) {
      errors.push({ line, message: ruled.message });
      continue;
    }
    const t = ruled.txn;

    rows.push({
      sourceId,
      sourceCreatedAt,
      line,
      type: t.type,
      amount,
      date,
      title: at(iTitle) || defaultTitleFor(t.type),
      categoryId: t.categoryId,
      methodId: t.methodId,
      fromAccountId: t.fromAccountId,
      toAccountId: t.toAccountId,
      incomeSource: t.incomeSource,
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

type SourceIdentity = Pick<ImportRow, "sourceId" | "sourceCreatedAt">;
type ExistingIdentity = { id: number; createdAt: Date };

function exportIdentity(id: number, createdAt: Date | string): string {
  const instant = createdAt instanceof Date ? createdAt.toISOString() : createdAt;
  return `${id}|${instant}`;
}

/**
 * Drop only rows carrying the exact id + created_at identity from this ledger's
 * export. Arbitrary CSV rows have no stable identity, so even identical-looking
 * transactions are retained rather than risking silent data loss.
 */
export function dropExisting<T extends SourceIdentity>(rows: T[], existing: ExistingIdentity[]): { rows: T[]; duplicates: number } {
  const identities = new Set(existing.map((e) => exportIdentity(e.id, e.createdAt)));
  const kept: T[] = [];
  let duplicates = 0;
  for (const r of rows) {
    const duplicate =
      r.sourceId != null &&
      r.sourceCreatedAt != null &&
      identities.has(exportIdentity(r.sourceId, r.sourceCreatedAt));
    if (duplicate) {
      duplicates++;
    } else {
      kept.push(r);
    }
  }
  return { rows: kept, duplicates };
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
