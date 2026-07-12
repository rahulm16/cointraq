"use client";

import { Drawer as Vaul } from "vaul";
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/ui";

/**
 * The app's one sheet primitive (§4): vaul bottom sheet on mobile (drag handle,
 * swipe-down dismiss, background scales back iOS-style), right-side drawer on
 * desktop (~440px, full height). All add/edit/detail forms live here.
 */
export function AppDrawer({
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
  const desktop = useMediaQuery("(min-width: 1024px)");

  // Let the dock know a drawer owns the viewport (pauses hide-on-scroll).
  useEffect(() => {
    if (open) document.body.setAttribute("data-drawer-open", "");
    else document.body.removeAttribute("data-drawer-open");
    return () => document.body.removeAttribute("data-drawer-open");
  }, [open]);

  return (
    <Vaul.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      direction={desktop ? "right" : "bottom"}
      // Scale the page behind the sheet (mobile only); keep our themed body bg.
      shouldScaleBackground={!desktop}
      setBackgroundColorOnScale={false}
      repositionInputs
    >
      <Vaul.Portal>
        <Vaul.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Vaul.Content
          aria-describedby={undefined}
          className={cn(
            "z-50 flex flex-col bg-surface-overlay shadow-[var(--shadow-overlay)] outline-none",
            desktop
              ? "fixed right-2 top-2 bottom-2 w-[440px] max-w-[94vw] rounded-[20px]"
              : "fixed inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[24px]",
          )}
        >
          {!desktop && (
            <div aria-hidden className="mx-auto mt-3 h-1.5 w-10 flex-none rounded-full bg-text-faint/30" />
          )}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-none">
            <Vaul.Title className="text-[17px] font-semibold text-text-primary">{title}</Vaul.Title>
            <button
              onClick={onClose}
              aria-label="Close"
              className="icon-btn w-8 h-8 rounded-full flex items-center justify-center text-text-faint hover:text-text-primary"
            >
              <X size={18} strokeWidth={1.75} />
            </button>
          </div>
          <div className="overflow-y-auto px-5 pb-[calc(20px+env(safe-area-inset-bottom))] grow">{children}</div>
        </Vaul.Content>
      </Vaul.Portal>
    </Vaul.Root>
  );
}
