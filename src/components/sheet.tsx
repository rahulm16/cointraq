"use client";

import { AnimatePresence, motion } from "motion/react";
import { fadeTransition } from "@/lib/motion";

/**
 * Small centered confirmation (delete/logout) — the one thing that stays a
 * dialog (§4). Scales in 0.96 → 1 with a fade over the base duration.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Delete",
  destructive = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition()}
            className="absolute inset-0 bg-black/50"
            onClick={onCancel}
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={fadeTransition()}
            role="alertdialog"
            aria-modal="true"
            className="relative w-full max-w-[360px] bg-surface-overlay rounded-card p-5 shadow-[var(--shadow-overlay)]"
          >
            <h3 className="text-[16px] font-semibold text-text-primary">{title}</h3>
            {body && <p className="mt-1.5 text-[13px] text-text-secondary">{body}</p>}
            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={onCancel}
                className="h-10 px-4 rounded-control bg-surface-raised text-[14px] font-medium text-text-primary pressable"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className={`h-10 px-4 rounded-control text-[14px] font-semibold text-white pressable ${destructive ? "bg-alert" : "bg-primary"}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
