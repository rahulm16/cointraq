"use client";

import { useActionState, useEffect, useState } from "react";
import type { Category } from "@/lib/types";
import { createCategory, updateCategory, setCategoryArchived } from "@/actions/categories";
import type { ActionResult } from "@/actions/shared";
import { Field, TextInput, SubmitButton } from "@/components/form";
import { useToast } from "@/components/toast";
import { CATEGORY_COLORS, CATEGORY_COLOR_HEX, type CategoryColor } from "@/lib/constants";
import { cn } from "@/lib/ui";

const initial: ActionResult = { ok: false };

export function CategoryForm({ category, onDone }: { category: Category | null; onDone: () => void }) {
  const editing = !!category;
  const action = editing ? updateCategory : createCategory;
  const [state, formAction, pending] = useActionState(action, initial);
  const [color, setColor] = useState<CategoryColor>(category?.color ?? "blue");
  const { show } = useToast();

  useEffect(() => {
    if (state.ok) {
      show(state.message ?? "Saved", { tone: "success" });
      onDone();
    }
  }, [state, show, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {editing && <input type="hidden" name="id" value={category.id} />}
      <input type="hidden" name="color" value={color} />

      <Field label="Name" error={state.errors?.name}>
        <TextInput name="name" defaultValue={category?.name ?? ""} placeholder="Food" autoFocus />
      </Field>

      <Field label="Color" error={state.errors?.color}>
        <div className="flex flex-wrap gap-2.5">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              className={cn(
                "w-8 h-8 rounded-full border-2",
                color === c ? "border-text-primary" : "border-transparent",
              )}
              style={{ background: CATEGORY_COLOR_HEX[c].solid }}
            />
          ))}
        </div>
      </Field>

      <div className="flex items-center justify-between pt-2">
        {editing ? (
          <button
            type="button"
            className="text-[13px] font-medium text-text-secondary"
            onClick={async () => {
              const res = await setCategoryArchived(category.id, !category.isArchived);
              show(res.message ?? "Done", { tone: res.ok ? "success" : "error" });
              onDone();
            }}
          >
            {category.isArchived ? "Restore" : "Archive"}
          </button>
        ) : (
          <span />
        )}
        <SubmitButton pending={pending}>{editing ? "Save category" : "Add category"}</SubmitButton>
      </div>
    </form>
  );
}
