"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Zap, Check } from "lucide-react";
import type { QuickAddSuggestion } from "@/db/queries";
import type { Category } from "@/lib/types";
import { quickLog } from "@/actions/transactions";
import { formatINR } from "@/lib/money";
import { useToast } from "@/components/toast";
import { Eyebrow } from "@/components/ui";
import { SPRING } from "@/lib/motion";
import { categoryClasses, cn } from "@/lib/ui";

/**
 * One-tap chips for the spends the user repeats most. Each carries its own
 * title/amount/category/method, so logging "chai ₹40" is a single press instead
 * of a five-field form.
 *
 * The chip shows a check for a beat after saving rather than disappearing —
 * repeat spends genuinely happen twice in a day.
 */
export function QuickAdd({
  suggestions,
  categories,
  today,
}: {
  suggestions: QuickAddSuggestion[];
  categories: Category[];
  today: string;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Zap size={12} strokeWidth={2} className="text-text-faint" aria-hidden />
        <Eyebrow>Quick add</Eyebrow>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <Chip key={s.title} suggestion={s} categories={categories} today={today} />
        ))}
      </div>
    </div>
  );
}

function Chip({
  suggestion: s,
  categories,
  today,
}: {
  suggestion: QuickAddSuggestion;
  categories: Category[];
  today: string;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const { show } = useToast();

  const cat = categories.find((c) => c.id === s.categoryId);

  const onClick = () => {
    startTransition(async () => {
      const res = await quickLog({
        title: s.title,
        amount: s.amount,
        categoryId: s.categoryId,
        methodId: s.methodId,
        date: today,
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 900);
        show(`${s.title} · ${formatINR(s.amount)}`, { tone: "success" });
      } else {
        show(res.message ?? "Could not log", { tone: "error" });
      }
    });
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={pending}
      whileTap={{ scale: 0.96 }}
      transition={SPRING}
      aria-label={`Log ${s.title} for ${formatINR(s.amount)}`}
      className={cn(
        "h-9 pl-3 pr-3.5 rounded-full bg-surface shadow-[var(--shadow-card)] flex items-center gap-2",
        "text-[12.5px] font-medium disabled:opacity-50 hover-lift",
      )}
    >
      {saved ? (
        <Check size={14} strokeWidth={2.5} className="text-income" />
      ) : (
        cat && <span className={cn("size-2 rounded-full flex-none", categoryClasses(cat.color).pill)} aria-hidden />
      )}
      <span className="text-text-primary truncate max-w-[9rem]">{s.title}</span>
      <span className="tnum text-text-faint">{formatINR(s.amount)}</span>
    </motion.button>
  );
}
