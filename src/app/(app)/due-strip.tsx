"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, X, Clock, Repeat } from "lucide-react";
import type { DueItem } from "@/lib/recurring";
import type { Category, PaymentMethod } from "@/lib/types";
import { logFromTemplate, skipOccurrence } from "@/actions/recurring";
import { formatINR } from "@/lib/money";
import { formatDayShort } from "@/lib/dates";
import { useToast } from "@/components/toast";
import { Card, Eyebrow } from "@/components/ui";
import { DUR, EASE, SPRING } from "@/lib/motion";
import { categoryClasses, cn } from "@/lib/ui";

/**
 * "Due" strip — the nudge layer for recurring templates.
 *
 * Nothing here logs on its own: each row is a one-tap confirmation. Rows animate
 * out on action so the strip empties as the user works through it.
 */
export function DueStrip({
  items,
  categories,
  methods,
}: {
  items: DueItem[];
  categories: Category[];
  methods: PaymentMethod[];
}) {
  // Keyed by occurrence, not template: once one is handled, the same template's
  // next overdue occurrence (e.g. last month's missed rent) must still show.
  const [done, setDone] = useState<Set<string>>(new Set());
  const keyOf = (i: DueItem) => `${i.template.id}:${i.dueDate}`;
  const visible = items.filter((i) => !done.has(keyOf(i)));

  if (visible.length === 0) return null;

  return (
    <Card>
      <div className="flex items-center gap-1.5">
        <Repeat size={12} strokeWidth={2} className="text-text-faint" aria-hidden />
        <Eyebrow>Due</Eyebrow>
      </div>

      <div className="flex flex-col mt-2">
        <AnimatePresence initial={false}>
          {visible.map((item) => (
            <motion.div
              key={item.template.id}
              layout
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: DUR.base, ease: EASE }}
              className="overflow-hidden"
            >
              <DueRow
                item={item}
                categories={categories}
                methods={methods}
                onResolved={() => setDone((prev) => new Set(prev).add(keyOf(item)))}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}

function DueRow({
  item,
  categories,
  methods,
  onResolved,
}: {
  item: DueItem;
  categories: Category[];
  methods: PaymentMethod[];
  onResolved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const { show } = useToast();
  const t = item.template;

  const cat = categories.find((c) => c.id === t.categoryId);
  const method = methods.find((m) => m.id === t.methodId);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, fallback: string) => {
    startTransition(async () => {
      const res = await fn();
      show(res.message ?? fallback, { tone: res.ok ? "success" : "error" });
      if (res.ok) onResolved();
    });
  };

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13.5px] font-medium text-text-primary truncate">{t.title}</span>
          <span className="text-[13px] tnum text-text-secondary flex-none">{formatINR(t.amount)}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-[11.5px]">
          <DueBadge item={item} />
          {cat && <span className={categoryClasses(cat.color).text}>{cat.name}</span>}
          {method && <span className="text-text-faint">· {method.name}</span>}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-none">
        <button
          onClick={() => run(() => skipOccurrence(t.id), "Skipped")}
          disabled={pending}
          aria-label={`Skip ${t.title}`}
          className="icon-btn size-8 rounded-full flex items-center justify-center text-text-faint hover:text-text-primary disabled:opacity-40"
        >
          <X size={15} strokeWidth={2} />
        </button>
        <motion.button
          onClick={() => run(() => logFromTemplate(t.id), "Logged")}
          disabled={pending}
          whileTap={{ scale: 0.96 }}
          transition={SPRING}
          aria-label={`Log ${t.title}`}
          className="h-8 px-3 rounded-full bg-primary text-primary-contrast text-[12.5px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
        >
          <Check size={14} strokeWidth={2.5} />
          Log
        </motion.button>
      </div>
    </div>
  );
}

function DueBadge({ item }: { item: DueItem }) {
  if (item.state === "overdue") {
    const n = Math.abs(item.daysUntil);
    return (
      <span className="inline-flex items-center gap-1 text-alert font-semibold">
        <Clock size={11} strokeWidth={2} aria-hidden />
        {n}d overdue
      </span>
    );
  }
  if (item.state === "due") {
    return <span className="text-warning font-semibold">Due today</span>;
  }
  return (
    <span className={cn("text-text-faint")}>
      {formatDayShort(item.dueDate)}
    </span>
  );
}
