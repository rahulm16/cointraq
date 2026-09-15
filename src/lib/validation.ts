import { z } from "zod";
import { AMOUNT_MAX, AMOUNT_MIN, TITLE_MAX, ICON_MAX_BYTES, CATEGORY_COLORS } from "./constants";
import { isValidDateStr } from "./dates";

/* Shared Zod pieces. Every server action validates with these — never trust the client. */

export const amountSchema = z
  .number({ error: "Enter an amount" })
  .int("Whole rupees only")
  .min(AMOUNT_MIN, `Minimum ₹${AMOUNT_MIN}`)
  .max(AMOUNT_MAX, "Amount too large");

export const dateSchema = z
  .string()
  .refine(isValidDateStr, "Invalid date");

/** Empty is allowed — server fills a type-aware default. */
export const titleSchema = z.string().trim().max(TITLE_MAX, `Max ${TITLE_MAX} characters`).optional();

export const iconSchema = z
  .string()
  .refine((s) => s.startsWith("data:image/"), "Must be an image")
  .refine((s) => s.length <= ICON_MAX_BYTES, "Icon too large (max 80 KB)")
  .optional()
  .nullable();

export const categoryColorSchema = z.enum(CATEGORY_COLORS);

export const accountTypeSchema = z.enum(["bank", "credit_card", "cash"]);
export const incomeSourceSchema = z.enum(["salary", "refund", "cashback", "other"]);

export const billingDaySchema = z.number().int().min(1).max(31);

/* ---- Settings entity schemas ---- */

export const accountInputSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(60),
  type: accountTypeSchema,
  openingBalance: z.number().int().min(0).max(AMOUNT_MAX).default(0),
  billingDay: billingDaySchema.nullable().optional(),
  icon: iconSchema,
});

export const methodInputSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(60),
  accountId: z.number().int().positive(),
  icon: iconSchema,
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(40),
  color: categoryColorSchema,
});

/* ---- Budgets ---- */

export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Invalid month");

export const budgetInputSchema = z.object({
  /** null = the overall month cap. */
  categoryId: z.number().int().positive().nullable(),
  month: monthKeySchema,
  /** 0 clears the budget; anything above must be a sane rupee amount. */
  amount: z.number().int().min(0).max(AMOUNT_MAX),
});

/* ---- Recurring templates ---- */

export const recurrenceSchema = z.enum(["monthly", "weekly", "yearly"]);

export const recurringInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title required").max(TITLE_MAX),
    type: z.enum(["expense", "bill_pay", "transfer", "withdrawal", "income"]),
    amount: amountSchema,
    categoryId: z.number().int().positive().nullable().optional(),
    methodId: z.number().int().positive().nullable().optional(),
    fromAccountId: z.number().int().positive().nullable().optional(),
    toAccountId: z.number().int().positive().nullable().optional(),
    incomeSource: incomeSourceSchema.nullable().optional(),
    recurrence: recurrenceSchema,
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    monthOfYear: z.number().int().min(1).max(12).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    // Each recurrence kind needs its own scheduling field.
    if (v.recurrence === "weekly" && v.dayOfWeek == null) {
      ctx.addIssue({ code: "custom", path: ["dayOfWeek"], message: "Pick a weekday" });
    }
    if (v.recurrence !== "weekly" && v.dayOfMonth == null) {
      ctx.addIssue({ code: "custom", path: ["dayOfMonth"], message: "Pick a day" });
    }
    if (v.recurrence === "yearly" && v.monthOfYear == null) {
      ctx.addIssue({ code: "custom", path: ["monthOfYear"], message: "Pick a month" });
    }
  });

/** Flatten a ZodError into { field: message } for inline form rendering. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
