"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppDrawer } from "@/components/drawer";
import { consumeAddReturnPath } from "@/lib/add-navigation";
import type { ReactNode } from "react";

/**
 * /add renders inside the app drawer (§4): bottom sheet on mobile, right drawer
 * on desktop. Dismissing returns to the page the user came from after the close
 * anim; only when /add was opened directly does it fall back to the dashboard.
 */
export function AddDrawerShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const navigated = useRef(false);
  const returnTo = useRef("/");

  useEffect(() => {
    returnTo.current = consumeAddReturnPath();
  }, []);

  function close() {
    if (navigated.current) return;
    navigated.current = true;
    setOpen(false);
    setTimeout(() => router.push(returnTo.current), 250);
  }

  return (
    <AppDrawer open={open} onClose={close} title="Add transaction">
      {children}
    </AppDrawer>
  );
}
