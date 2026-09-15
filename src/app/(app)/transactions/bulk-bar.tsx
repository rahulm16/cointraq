"use client";

import { useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Tag, Trash2 } from "lucide-react";
import type { Category } from "@/lib/types";
import { bulkSetCategory, bulkDelete } from "@/actions/transactions";
import { useToast } from "@/components/toast";
import { SelectMenu } from "@/components/select-menu";
import { SPRING } from "@/lib/motion";

/**
 * Bulk action bar. Appears only while rows are selected and floats above the
 * dock on mobile, so it never competes with navigation when idle.
 */
export function BulkBar({
  selected,
  categories,
  onClear,
}: {
  selected: number[];
  categories: Category[];
  onClear: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const { show } = useToast();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    startTransition(async () => {
      const res = await fn();
      show(res.message ?? (res.ok ? "Done" : "Failed"), { tone: res.ok ? "success" : "error" });
      if (res.ok) onClear();
    });
  };

  return (
    <AnimatePresence>
      {selected.length > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={SPRING}
          className="fixed inset-x-0 z-40 flex justify-center px-4 pointer-events-none
                     bottom-[calc(96px+env(safe-area-inset-bottom))] lg:bottom-6"
        >
          <div
            className="pointer-events-auto flex items-center gap-2 h-14 px-3 rounded-full backdrop-blur-xl shadow-[var(--shadow-overlay)]"
            style={{ background: "var(--surface-glass)" }}
          >
            <button
              onClick={onClear}
              aria-label="Clear selection"
              className="icon-btn size-9 rounded-full flex items-center justify-center text-text-faint"
            >
              <X size={16} strokeWidth={2} />
            </button>

            <span className="text-[13px] font-semibold text-text-primary tnum px-1">
              {selected.length}
            </span>

            <SelectMenu
              options={[
                { value: "none", label: "Uncategorized" },
                ...categories.map((c) => ({ value: String(c.id), label: c.name })),
              ]}
              placeholder="Category"
              onChange={(v) =>
                run(() => bulkSetCategory(selected, v === "none" ? null : Number(v)))
              }
              renderTrigger={({ toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  disabled={pending}
                  className="h-9 px-3 rounded-full bg-surface-raised text-[12.5px] font-medium text-text-primary flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Tag size={13} strokeWidth={1.75} />
                  Category
                </button>
              )}
            />

            <button
              onClick={() => run(() => bulkDelete(selected))}
              disabled={pending}
              aria-label={`Delete ${selected.length} transactions`}
              className="h-9 px-3 rounded-full bg-alert/12 text-alert text-[12.5px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 size={13} strokeWidth={2} />
              Delete
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
