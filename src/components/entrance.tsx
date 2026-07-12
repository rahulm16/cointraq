"use client";

import { motion } from "motion/react";
import { useRef } from "react";
import { DUR, EASE } from "@/lib/motion";
import type { ReactNode } from "react";

// Runs the dashboard entrance once per session, not on every client navigation.
let played = false;

/**
 * Orchestrated entrance (§8): hero fades up first, then stat/chart cards stagger
 * ~40ms apart. Wrap the dashboard; mark children with <EntranceItem>. After the
 * first play it renders statically (no motion) for the rest of the session.
 */
export function Entrance({ children }: { children: ReactNode }) {
  const first = useRef(!played);
  if (first.current) played = true;

  if (!first.current) return <>{children}</>;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function EntranceItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
