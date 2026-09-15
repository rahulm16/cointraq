"use client";

import { motion } from "motion/react";
import { useId } from "react";
import type { BudgetProgress } from "@/lib/budgets";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/ui";

/**
 * Budget pace ring — a progress arc with a pace marker.
 *
 * The arc is spend-against-cap; the small tick is where an even burn rate would
 * put you today. The gap between them is the whole point: an arc short of the
 * tick means you're ahead, past it means you're burning too fast. Solid fills
 * only (no gradients, per the design system).
 */

const TONE = {
  under: "var(--income)",
  near: "var(--warning)",
  over: "var(--alert)",
  none: "var(--text-faint)",
} as const;

export function BudgetRing({
  progress,
  size = 92,
  stroke = 8,
  className,
  children,
}: {
  progress: BudgetProgress;
  size?: number;
  stroke?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const id = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  // Cap the drawn arc at a full circle even when overspent — the color carries
  // the "over" signal, a wrapping arc would just be confusing.
  const pct = Math.min(progress.ratio, 1);
  const paceFrac = progress.daysTotal > 0 ? progress.daysElapsed / progress.daysTotal : 0;
  const color = TONE[progress.status];

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-raised)"
          strokeWidth={stroke}
        />
        <motion.circle
          key={id}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={SPRING}
        />
        {/* Pace marker — where an even burn would be today. */}
        {progress.budget > 0 && paceFrac > 0 && paceFrac < 1 && (
          <circle
            cx={size / 2 + r * Math.cos(2 * Math.PI * paceFrac)}
            cy={size / 2 + r * Math.sin(2 * Math.PI * paceFrac)}
            r={stroke / 2 + 1.5}
            fill="var(--surface)"
            stroke="var(--text-secondary)"
            strokeWidth={2}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Slim horizontal variant for category rows. */
export function BudgetBar({ progress, className }: { progress: BudgetProgress; className?: string }) {
  const pct = Math.min(progress.ratio, 1) * 100;
  const pacePct = progress.daysTotal > 0 ? (progress.daysElapsed / progress.daysTotal) * 100 : 0;
  const color = TONE[progress.status];

  return (
    <div className={cn("relative h-1.5 rounded-full bg-surface-raised overflow-hidden", className)}>
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={SPRING}
      />
      {progress.budget > 0 && pacePct > 0 && pacePct < 100 && (
        <div
          className="absolute inset-y-0 w-px bg-text-secondary/60"
          style={{ left: `${pacePct}%` }}
          aria-hidden
        />
      )}
    </div>
  );
}
