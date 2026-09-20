"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { transactions } from "@/db/schema";
import { getAccounts, getMethods, getCategories, getAllTransactions } from "@/db/queries";
import { parseTransactionsCsv, dropExisting, type ImportError } from "@/lib/csv-import";
import { todayIST } from "@/lib/dates";
import { requireAuth, okResult, errResult, type ActionResult } from "./shared";

/** Guard against someone pasting a giant file into a single request. */
const MAX_ROWS = 5000;
const MAX_BYTES = 2_000_000;

export interface ImportPreview {
  ok: boolean;
  validCount: number;
  /** Rows that already exist in the ledger and will be skipped. */
  duplicateCount: number;
  errors: ImportError[];
  unknownCategories: string[];
  unknownMethods: string[];
  unknownAccounts: string[];
  message?: string;
}

/** Parse the file and drop rows the ledger already has, so re-importing an export adds nothing. */
async function parseAgainstLedger(csv: string) {
  const [accounts, methods, categories, existing] = await Promise.all([
    getAccounts(true),
    getMethods(true),
    getCategories(true),
    getAllTransactions(),
  ]);
  const r = parseTransactionsCsv(csv, { accounts, methods, categories }, todayIST());
  const fresh = dropExisting(r.rows, existing);
  return { ...r, rows: fresh.rows, duplicates: fresh.duplicates };
}

/**
 * Dry run: parse and report without writing. The UI always previews before
 * committing — an import is the one operation here that can add hundreds of rows
 * at once, so the user sees exactly what will land first.
 */
export async function previewImport(csv: string): Promise<ImportPreview> {
  await requireAuth();

  if (csv.length > MAX_BYTES) {
    return {
      ok: false,
      validCount: 0,
      duplicateCount: 0,
      errors: [{ line: 0, message: "File is too large (max 2 MB)" }],
      unknownCategories: [],
      unknownMethods: [],
      unknownAccounts: [],
    };
  }

  const r = await parseAgainstLedger(csv);

  return {
    ok: r.rows.length > 0,
    validCount: r.rows.length,
    duplicateCount: r.duplicates,
    errors: r.errors.slice(0, 50), // enough to diagnose without flooding the UI
    unknownCategories: r.unknownCategories,
    unknownMethods: r.unknownMethods,
    unknownAccounts: r.unknownAccounts,
    message:
      r.rows.length === 0
        ? "Nothing new to import in this file"
        : `${r.rows.length} row${r.rows.length === 1 ? "" : "s"} ready`,
  };
}

/**
 * Commit the import. Re-parses server-side rather than trusting a client-supplied
 * row list, so what gets written is always what the file actually says.
 */
export async function commitImport(csv: string): Promise<ActionResult> {
  await requireAuth();

  if (csv.length > MAX_BYTES) return errResult({ _: "File too large" }, "File is too large (max 2 MB)");

  const r = await parseAgainstLedger(csv);
  if (r.rows.length === 0) return errResult({ _: "Nothing to import" }, "Nothing new to import in this file");
  if (r.rows.length > MAX_ROWS) {
    return errResult({ _: "Too many rows" }, `Too many rows (max ${MAX_ROWS})`);
  }

  await db.insert(transactions).values(
    r.rows.map((row) => ({
      type: row.type,
      amount: row.amount,
      date: row.date,
      title: row.title,
      categoryId: row.categoryId,
      methodId: row.methodId,
      fromAccountId: row.fromAccountId,
      toAccountId: row.toAccountId,
      incomeSource: row.incomeSource,
    })),
  );

  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/settings");

  const parts = [`Imported ${r.rows.length} transaction${r.rows.length === 1 ? "" : "s"}`];
  if (r.duplicates > 0) parts.push(`${r.duplicates} already existed`);
  if (r.errors.length > 0) parts.push(`skipped ${r.errors.length}`);
  return okResult(parts.join(" · "));
}
