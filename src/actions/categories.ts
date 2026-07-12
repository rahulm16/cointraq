"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categories } from "@/db/schema";
import { categoryInputSchema, fieldErrors } from "@/lib/validation";
import { requireAuth, okResult, errResult, type ActionResult } from "./shared";
import type { CategoryColor } from "@/lib/constants";

function parseCategoryForm(formData: FormData) {
  return categoryInputSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    color: String(formData.get("color") ?? ""),
  });
}

export async function createCategory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const parsed = parseCategoryForm(formData);
  if (!parsed.success) return errResult(fieldErrors(parsed.error));
  await db.insert(categories).values({ name: parsed.data.name, color: parsed.data.color });
  revalidatePath("/settings");
  return okResult("Category added");
}

/** Inline "+ New" on the Spend form: create and return the new row. SPEC §11. */
export async function quickCreateCategory(
  name: string,
  color: CategoryColor,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  await requireAuth();
  const parsed = categoryInputSchema.safeParse({ name, color });
  if (!parsed.success) return { ok: false, error: fieldErrors(parsed.error).name ?? "Invalid" };
  const [row] = await db
    .insert(categories)
    .values({ name: parsed.data.name, color: parsed.data.color })
    .returning({ id: categories.id });
  revalidatePath("/settings");
  revalidatePath("/add");
  return { ok: true, id: row.id };
}

export async function updateCategory(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return errResult({ _: "Bad id" });
  const parsed = parseCategoryForm(formData);
  if (!parsed.success) return errResult(fieldErrors(parsed.error));
  await db
    .update(categories)
    .set({ name: parsed.data.name, color: parsed.data.color })
    .where(eq(categories.id, id));
  revalidatePath("/settings");
  return okResult("Category saved");
}

export async function setCategoryArchived(id: number, archived: boolean): Promise<ActionResult> {
  await requireAuth();
  await db.update(categories).set({ isArchived: archived }).where(eq(categories.id, id));
  revalidatePath("/settings");
  return okResult(archived ? "Archived" : "Restored");
}
