"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { transactions } from "@/db/schema";
import { getAccounts, getMethods, getCategories } from "@/db/queries";
import { parseTransactionsCsv, type ImportError } from "@/lib/csv-import";
import { todayIST } from "@/lib/dates";
import { requireAuth, okResult, errResult, type ActionResult } from "./shared";

/** Guard against someone pasting a giant file into a single request. */
const MAX_ROWS = 5000;
const MAX_BYTES = 2_000_000;

export interface ImportPreview {
  ok: boolean;
  validCount: number;
  errors: ImportError[];
  unknownCategories: string[];
  unknownMethods: string[];
  unknownAccounts: string[];
  message?: string;
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
      errors: [{ line: 0, message: "File is too large (max 2 MB)" }],
      unknownCategories: [],
      unknownMethods: [],
      unknownAccounts: [],
    };
  }

  const [accounts, methods, categories] = await Promise.all([
    getAccounts(true),
    getMethods(true),
    getCategories(true),
  ]);

  const r = parseTransactionsCsv(csv, { accounts, methods, categories }, todayIST());

  return {
    ok: r.rows.length > 0,
    validCount: r.rows.length,
    errors: r.errors.slice(0, 50), // enough to diagnose without flooding the UI
    unknownCategories: r.unknownCategories,
    unknownMethods: r.unknownMethods,
    unknownAccounts: r.unknownAccounts,
    message:
      r.rows.length === 0
        ? "Nothing importable in this file"
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

  const [accounts, methods, categories] = await Promise.all([
    getAccounts(true),
    getMethods(true),
    getCategories(true),
  ]);

  const r = parseTransactionsCsv(csv, { accounts, methods, categories }, todayIST());
  if (r.rows.length === 0) return errResult({ _: "Nothing to import" }, "Nothing importable in this file");
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

  const skipped = r.errors.length;
  return okResult(
    skipped > 0
      ? `Imported ${r.rows.length}, skipped ${skipped}`
      : `Imported ${r.rows.length} transaction${r.rows.length === 1 ? "" : "s"}`,
  );
}
