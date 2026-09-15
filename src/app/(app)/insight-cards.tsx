"use client";

import { motion } from "motion/react";
import { TrendingDown, TrendingUp, Sparkles, CalendarDays, Wallet } from "lucide-react";
import type { Insight } from "@/lib/insights";
import { DUR, EASE } from "@/lib/motion";
import { cn } from "@/lib/ui";

/**
 * Observations, not numbers. These sit under the hero and stagger in with the
 * rest of the dashboard entrance.
 */

const TONE_CLASS = {
  good: "text-income",
  warn: "text-warning",
  neutral: "text-text-secondary",
} as const;

function iconFor(id: string) {
  if (id.startsWith("cat-trend")) return TrendingUp;
  if (id === "month-streak") return TrendingDown;
  if (id === "spending-days") return CalendarDays;
  if (id === "method-concentration") return Wallet;
  return Sparkles;
}

export function InsightCards({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
      {insights.map((ins, i) => {
        const Icon = iconFor(ins.id);
        return (
          <motion.div
            key={ins.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.base, ease: EASE, delay: i * 0.04 }}
            className="bg-surface rounded-card p-[13px_14px] shadow-[var(--shadow-card)] hover-lift"
          >
            <Icon
              size={14}
              strokeWidth={1.75}
              className={cn("mb-2", TONE_CLASS[ins.tone])}
              aria-hidden
            />
            <div className="text-[12.5px] font-medium text-text-primary leading-snug">{ins.text}</div>
            {ins.detail && <div className="text-[11.5px] text-text-faint mt-0.5">{ins.detail}</div>}
          </motion.div>
        );
      })}
    </div>
  );
}
