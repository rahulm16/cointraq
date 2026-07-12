"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AppDrawer } from "@/components/drawer";
import type { ReactNode } from "react";

/**
 * /add renders inside the app drawer (§4): bottom sheet on mobile, right drawer
 * on desktop. Dismissing navigates back to the dashboard after the close anim.
 */
export function AddDrawerShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const navigated = useRef(false);

  function close() {
    if (navigated.current) return;
    navigated.current = true;
    setOpen(false);
    setTimeout(() => router.push("/"), 250);
  }

  return (
    <AppDrawer open={open} onClose={close} title="Add transaction">
      {children}
    </AppDrawer>
  );
}
