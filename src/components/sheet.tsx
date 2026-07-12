"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Bottom sheet on mobile, centered modal on desktop. Used by add/edit flows and
 * settings editors. Closes on backdrop click and Escape.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full lg:max-w-[520px] max-h-[92dvh] overflow-y-auto bg-surface border-t lg:border border-border rounded-t-[20px] lg:rounded-card shadow-[var(--shadow-card)]"
      >
        <div className="sticky top-0 bg-surface flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[17px] font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-control flex items-center justify-center text-text-faint hover:text-text-primary"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden />
      <div role="alertdialog" aria-modal="true" className="relative w-full max-w-[360px] bg-surface border border-border rounded-card p-5 shadow-[var(--shadow-card)]">
        <h3 className="text-[16px] font-semibold text-text-primary">{title}</h3>
        {body && <p className="mt-1.5 text-[13px] text-text-secondary">{body}</p>}
        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={onCancel} className="h-10 px-4 rounded-control bg-surface-raised border border-border text-[14px] font-medium text-text-primary">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`h-10 px-4 rounded-control text-[14px] font-semibold text-white ${destructive ? "bg-alert" : "bg-primary"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
