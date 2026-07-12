"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** App-wide motion policy: every animation degrades to instant for prefers-reduced-motion. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
