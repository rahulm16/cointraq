"use client";

import { motion } from "motion/react";
import { EASE } from "@/lib/motion";

/** Thin progress bar that animates to its value on mount (§8). scaleX = compositor-friendly. */
export function CycleProgress({ fraction }: { fraction: number }) {
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <div className="h-1 rounded-full bg-surface-raised overflow-hidden" aria-hidden>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: clamped }}
        transition={{ duration: 0.6, ease: EASE }}
        style={{ transformOrigin: "left" }}
        className="h-full w-full rounded-full bg-primary"
      />
    </div>
  );
}
