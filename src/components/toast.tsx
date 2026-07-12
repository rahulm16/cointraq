"use client";

import { toast } from "sonner";

/**
 * Toasts ride on sonner (§8), styled to app surfaces via <AppToaster />.
 * The old provider API is preserved so call sites read the same.
 */
interface ShowOpts {
  tone?: "default" | "success" | "error";
  action?: { label: string; onClick: () => void };
}

function show(message: string, opts?: ShowOpts) {
  const base = opts?.tone === "success" ? toast.success : opts?.tone === "error" ? toast.error : toast;
  base(message, {
    action: opts?.action ? { label: opts.action.label, onClick: opts.action.onClick } : undefined,
  });
}

export function useToast() {
  return { show };
}
