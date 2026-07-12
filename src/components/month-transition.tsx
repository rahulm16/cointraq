"use client";

import { useEffect, useRef } from "react";
import { motion, useAnimationControls } from "motion/react";
import { fadeTransition } from "@/lib/motion";
import type { ReactNode } from "react";

/**
 * Month-switch transition (§5): content cross-fades with a 12px directional
 * slide matching the chevron pressed. Children update in place (no remount), so
 * NumberFlow amounts inside keep rolling digit-by-digit.
 */
export function MonthTransition({ month, children }: { month: string; children: ReactNode }) {
  const prev = useRef(month);
  const controls = useAnimationControls();

  useEffect(() => {
    if (prev.current !== month) {
      const dir = month > prev.current ? 1 : -1;
      prev.current = month;
      controls.set({ opacity: 0, x: dir * 12 });
      controls.start({ opacity: 1, x: 0, transition: fadeTransition() });
    }
  }, [month, controls]);

  return <motion.div animate={controls}>{children}</motion.div>;
}
