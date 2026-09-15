"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";
import type { Budget, Category } from "@/lib/types";
import type { MonthBudgets } from "@/lib/budgets";
import { setBudget, copyBudgetsFromMonth } from "@/actions/budgets";
import { formatINR, groupINR } from "@/lib/money";
import { formatMonthLabel, shiftMonth } from "@/lib/dates";
import { useToast } from "@/components/toast";
import { Card, Eyebrow } from "@/components/ui";
import { BudgetBar, BudgetRing } from "@/components/budget-ring";
import { TextInput } from "@/components/form";
import { categoryClasses, cn } from "@/lib/ui";

/**
 * Budget editor. One row per category plus an overall cap, each editable in
 * place — a full form for a single number would be friction for something the
 * user tweaks monthly.
 */
export function BudgetsClient({
  month,
  prevMonth,
  nowMonth,
  categories,
  budgets,
  progress,
  spendByCategory,
  canCopyPrevious,
}: {
  month: string;
  prevMonth: string;
  nowMonth: string;
  categories: Category[];
  budgets: Budget[];
  progress: MonthBudgets;
  spendByCategory: Record<number, number>;
  canCopyPrevious: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { show } = useToast();

  const amountFor = (categoryId: number | null) =>
    budgets.find((b) => b.categoryId === categoryId)?.amount ?? 0;

  const go = (by: number) => router.push(`/budgets?m=${shiftMonth(month, by)}`);

  const copyPrevious = () => {
    startTransition(async () => {
      const res = await copyBudgetsFromMonth(prevMonth, month);
      show(res.message ?? (res.ok ? "Copied" : "Could not copy"), { tone: res.ok ? "success" : "error" });
      if (res.ok) router.refresh();
    });
  };

  return (
    <main className="max-w-[720px] mx-auto p-4 lg:p-8">
      {/* Month switcher */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => go(-1)}
          aria-label="Previous month"
          className="icon-btn size-9 rounded-full flex items-center justify-center text-text-secondary"
        >
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
        <div className="text-[15px] font-semibold text-text-primary">{formatMonthLabel(month)}</div>
        <button
          onClick={() => go(1)}
          disabled={month >= nowMonth}
          aria-label="Next month"
          className="icon-btn size-9 rounded-full flex items-center justify-center text-text-secondary disabled:opacity-30"
        >
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
      </div>

      {canCopyPrevious && (
        <button
          onClick={copyPrevious}
          disabled={pending}
          className="w-full mb-4 h-11 rounded-control bg-surface-raised text-[13px] font-medium text-text-secondary flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Copy size={14} strokeWidth={1.75} />
          Copy budgets from {formatMonthLabel(prevMonth)}
        </button>
      )}

      {/* Overall cap */}
      <Card className="mb-4">
        <Eyebrow>Monthly cap</Eyebrow>
        <div className="flex items-center gap-4 mt-3">
          {progress.overall ? (
            <BudgetRing progress={progress.overall} size={72} stroke={7}>
              <span className="text-[13px] font-semibold text-text-primary tnum">
                {Math.round(progress.overall.ratio * 100)}%
              </span>
            </BudgetRing>
          ) : null}
          <div className="flex-1 min-w-0">
            <AmountRow
              label="All spending"
              value={amountFor(null)}
              spent={progress.overall?.spent ?? 0}
              categoryId={null}
              month={month}
            />
          </div>
        </div>
      </Card>

      {/* Per-category caps */}
      <Card>
        <Eyebrow>By category</Eyebrow>
        <div className="flex flex-col divide-y divide-hairline mt-1">
          {categories.map((c) => {
            const row = progress.categories.find((r) => r.categoryId === c.id);
            return (
              <div key={c.id} className="py-3">
                <AmountRow
                  label={c.name}
                  labelClass={categoryClasses(c.color).text}
                  value={amountFor(c.id)}
                  spent={spendByCategory[c.id] ?? 0}
                  categoryId={c.id}
                  month={month}
                />
                {row && <BudgetBar progress={row.progress} className="mt-2" />}
              </div>
            );
          })}
        </div>
      </Card>

      {progress.uncappedSpend > 0 && (
        <p className="text-[12px] text-text-faint mt-4 px-1">
          {formatINR(progress.uncappedSpend)} this month is in categories with no cap set.
        </p>
      )}

      <Link
        href="/"
        className="inline-block mt-6 text-[13px] font-medium text-text-secondary hover:text-text-primary"
      >
        ← Back to dashboard
      </Link>
    </main>
  );
}

/** One editable cap. Saves on blur — no explicit save button for a single number. */
function AmountRow({
  label,
  labelClass,
  value,
  spent,
  categoryId,
  month,
}: {
  label: string;
  labelClass?: string;
  value: number;
  spent: number;
  categoryId: number | null;
  month: string;
}) {
  const [draft, setDraft] = useState(value ? String(value) : "");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const { show } = useToast();

  const commit = () => {
    const next = draft.trim() === "" ? 0 : Number(draft.replace(/[^\d]/g, ""));
    if (!Number.isFinite(next) || next === value) return;

    startTransition(async () => {
      const res = await setBudget(categoryId, month, next);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
      } else {
        show(res.message ?? "Could not save", { tone: "error" });
        setDraft(value ? String(value) : "");
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className={cn("text-[13.5px] font-medium truncate", labelClass ?? "text-text-primary")}>
          {label}
        </div>
        <div className="text-[11.5px] text-text-faint tnum mt-0.5">
          {formatINR(spent)} spent
          {value > 0 && <> · {formatINR(Math.max(value - spent, 0))} left</>}
        </div>
      </div>

      <div className="relative flex-none">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-text-faint pointer-events-none">
          ₹
        </span>
        <TextInput
          numeric
          inputMode="numeric"
          aria-label={`Budget for ${label}`}
          value={draft}
          placeholder="—"
          disabled={pending}
          onChange={(e) => setDraft(e.currentTarget.value.replace(/[^\d]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="w-28 !pl-6 !pr-7 text-right"
        />
        {saved && (
          <Check
            size={14}
            strokeWidth={2.5}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-income"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

/** Unused here but kept alongside for symmetry with other screens. */
export function formatCap(n: number): string {
  return n > 0 ? groupINR(n) : "—";
}
