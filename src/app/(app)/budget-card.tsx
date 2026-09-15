"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { MonthBudgets } from "@/lib/budgets";
import type { Category } from "@/lib/types";
import { formatINR } from "@/lib/money";
import { categoryClasses, cn } from "@/lib/ui";
import { Card, Eyebrow } from "@/components/ui";
import { BudgetRing, BudgetBar } from "@/components/budget-ring";
import { INRFlow } from "@/components/inr-flow";

/**
 * The budget widget. Its job is to answer "am I on track?" before the user has
 * to do any arithmetic — the pace sentence is the most important line here, more
 * than the totals, which the hero already shows.
 */
export function BudgetCard({
  budgets,
  categories,
  month,
}: {
  budgets: MonthBudgets;
  categories: Category[];
  month: string;
}) {
  const { overall, categories: rows } = budgets;

  if (!overall && rows.length === 0) {
    return (
      <Card>
        <Eyebrow>Budget</Eyebrow>
        <p className="text-[13px] text-text-secondary mt-2 leading-relaxed">
          Set a monthly cap and the dashboard starts telling you whether you&apos;re on pace.
        </p>
        <Link
          href={`/budgets?m=${month}`}
          className="inline-flex items-center gap-1 mt-3 text-[13px] font-semibold text-primary"
        >
          Set a budget <ArrowUpRight size={14} strokeWidth={2} />
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <Eyebrow>Budget</Eyebrow>
        <Link
          href={`/budgets?m=${month}`}
          className="text-[11px] font-semibold text-text-faint hover:text-text-primary"
        >
          Edit
        </Link>
      </div>

      {overall && (
        <div className="flex items-center gap-4 mt-3">
          <BudgetRing progress={overall}>
            <span className="text-[15px] font-semibold text-text-primary tnum">
              {Math.round(overall.ratio * 100)}%
            </span>
            <span className="text-[10px] text-text-faint">used</span>
          </BudgetRing>

          <div className="min-w-0 flex-1">
            <div className="text-[19px] text-text-primary">
              <INRFlow value={Math.max(overall.remaining, 0)} />
              <span className="text-[12px] text-text-faint font-medium ml-1.5">
                {overall.remaining >= 0 ? "left" : ""}
              </span>
            </div>
            {overall.remaining < 0 && (
              <div className="text-[12px] font-semibold text-alert mt-0.5">
                {formatINR(Math.abs(overall.remaining))} over
              </div>
            )}
            <PaceLine progress={overall} />
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className={cn("flex flex-col gap-2.5", overall ? "mt-4 pt-4 border-t border-hairline" : "mt-3")}>
          {rows.slice(0, 4).map((row) => {
            const cat = categories.find((c) => c.id === row.categoryId);
            const p = row.progress;
            return (
              <div key={row.categoryId}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span
                    className={cn(
                      "text-[12.5px] font-medium truncate",
                      cat ? categoryClasses(cat.color).text : "text-text-secondary",
                    )}
                  >
                    {cat?.name ?? "Uncategorized"}
                  </span>
                  <span className="text-[11.5px] tnum text-text-secondary flex-none">
                    {formatINR(p.spent)}
                    <span className="text-text-faint"> / {formatINR(p.budget)}</span>
                  </span>
                </div>
                <BudgetBar progress={p} />
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/** The sentence that turns numbers into a verdict. */
function PaceLine({ progress: p }: { progress: { paceDelta: number; status: string; safeDailyRemaining: number; daysTotal: number; daysElapsed: number } }) {
  const daysLeft = p.daysTotal - p.daysElapsed;

  if (p.status === "over") {
    return <div className="text-[12px] text-text-faint mt-1">Over budget for this month</div>;
  }

  // Ahead or behind by a trivial amount reads as "on track" — don't cry wolf.
  const TRIVIAL = 200;
  if (Math.abs(p.paceDelta) <= TRIVIAL) {
    return (
      <div className="text-[12px] text-text-secondary mt-1">
        Right on pace
        {daysLeft > 0 && <span className="text-text-faint"> · {formatINR(p.safeDailyRemaining)}/day left</span>}
      </div>
    );
  }

  const ahead = p.paceDelta < 0;
  return (
    <div className="text-[12px] mt-1">
      <span className={ahead ? "text-income font-medium" : "text-warning font-medium"}>
        {formatINR(Math.abs(p.paceDelta))} {ahead ? "ahead of" : "behind"} pace
      </span>
      {daysLeft > 0 && p.safeDailyRemaining > 0 && (
        <span className="text-text-faint"> · {formatINR(p.safeDailyRemaining)}/day left</span>
      )}
    </div>
  );
}
