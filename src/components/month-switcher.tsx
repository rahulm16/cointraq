"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { formatMonthLabel, shiftMonth } from "@/lib/dates";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Chevron month switcher. Bounds the "next" chevron at `maxMonth` (usually the
 * current IST month). Writes the month to the `m` search param.
 */
export function MonthSwitcher({ month, maxMonth }: { month: string; maxMonth: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(to: string) {
    const p = new URLSearchParams(params.toString());
    p.set("m", to);
    router.push(`${pathname}?${p.toString()}`);
  }

  const atMax = month >= maxMonth;

  return (
    <div className="flex items-center justify-between">
      <button
        onClick={() => go(shiftMonth(month, -1))}
        aria-label="Previous month"
        className="w-8 h-8 rounded-[10px] bg-surface border border-border text-text-secondary flex items-center justify-center"
      >
        <ChevronLeft size={16} strokeWidth={1.75} />
      </button>
      <div className="text-[16px] font-semibold text-text-primary">{formatMonthLabel(month)}</div>
      <button
        onClick={() => !atMax && go(shiftMonth(month, 1))}
        aria-label="Next month"
        disabled={atMax}
        className="w-8 h-8 rounded-[10px] bg-surface border border-border text-text-secondary flex items-center justify-center disabled:opacity-40"
      >
        <ChevronRight size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}
