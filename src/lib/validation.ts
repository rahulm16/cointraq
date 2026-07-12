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

/** Flatten a ZodError into { field: message } for inline form rendering. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
