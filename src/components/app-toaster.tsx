"use client";

import { Toaster } from "sonner";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Sonner toaster styled to app surfaces (§8): rounded 16px, borderless,
 * elevated. Above the dock on mobile (bottom-center), bottom-right on desktop.
 */
export function AppToaster() {
  const desktop = useMediaQuery("(min-width: 1024px)");
  return (
    <Toaster
      position={desktop ? "bottom-right" : "bottom-center"}
      offset={desktop ? 24 : 96}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-3 w-full px-4 py-3 rounded-2xl bg-surface-overlay text-text-primary shadow-[var(--shadow-overlay)]",
          title: "text-[13px] font-medium",
          description: "text-[12px] text-text-secondary",
          actionButton: "ml-auto text-[13px] font-semibold text-primary",
          icon: "text-primary",
        },
      }}
    />
  );
}
