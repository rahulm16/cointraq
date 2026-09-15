"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatINR } from "@/lib/money";
import { formatDayLabel } from "@/lib/dates";
import { Eyebrow } from "@/components/ui";

/**
 * A year of spending as a calendar grid — one cell per day, opacity scaled to
 * that day's total. Shows seasonality and no-spend streaks the 6-month bar
 * trend can't: a run of blank cells is instantly legible as a quiet week.
 *
 * Solid fills only — intensity comes from opacity on one primary color, never a
 * gradient.
 */

const WEEKDAY_LABELS = ["", "M", "", "W", "", "F", ""];

export function YearHeatmap({
  days,
  today,
}: {
  /** Every day in the window with its hero total (zeros included). */
  days: { date: string; total: number }[];
  today: string;
}) {
  const [hover, setHover] = useState<{ date: string; total: number } | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { weeks, max, monthLabels } = useMemo(() => {
    if (days.length === 0) return { weeks: [], max: 0, monthLabels: [] };

    const max = Math.max(...days.map((d) => d.total));

    // Pad the first week so the grid starts on the correct weekday.
    const firstDow = new Date(days[0].date + "T00:00:00").getDay();
    const padded: ({ date: string; total: number } | null)[] = [
      ...Array<null>(firstDow).fill(null),
      ...days,
    ];

    const weeks: ({ date: string; total: number } | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

    // Label a column when its first real day starts a new month.
    const monthLabels: { col: number; label: string }[] = [];
    let lastMonth = "";
    weeks.forEach((w, col) => {
      const first = w.find((d) => d !== null);
      if (!first) return;
      const m = first.date.slice(0, 7);
      if (m !== lastMonth) {
        lastMonth = m;
        monthLabels.push({
          col,
          label: new Date(first.date + "T00:00:00").toLocaleString("en-IN", { month: "short" }),
        });
      }
    });

    return { weeks, max, monthLabels };
  }, [days]);

  // Pin the scroller to the latest week so today is in view without a left-to-right hunt.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [days]);

  if (days.length === 0) return null;

  // Square-root scaling: linear opacity lets a few big days flatten everything else.
  const intensity = (total: number) => (max <= 0 || total <= 0 ? 0 : Math.sqrt(total / max));

  return (
    <div className="min-w-0">
      <div className="relative mb-3">
        <Eyebrow>Year at a glance</Eyebrow>
        {/* Out of flow so "11 Jul 2026 · ₹1,24,560" vs empty never changes card size. */}
        <div className="absolute right-0 top-0 max-w-[55%] truncate text-right text-[11.5px] text-text-faint tnum pointer-events-none">
          {hover ? (
            <>
              {formatDayLabel(hover.date)} · {hover.total > 0 ? formatINR(hover.total) : "no spend"}
            </>
          ) : null}
        </div>
      </div>

      <div ref={scrollerRef} className="overflow-x-auto -mx-1 px-1 pb-1">
        <div className="inline-flex flex-col gap-1 min-w-max">
          {/* Month ruler */}
          <div className="flex gap-[3px] ml-[18px] h-3">
            {weeks.map((_, col) => {
              const label = monthLabels.find((m) => m.col === col);
              return (
                <div key={col} className="w-[11px] text-[9px] text-text-faint leading-none">
                  {label?.label}
                </div>
              );
            })}
          </div>

          <div className="flex gap-[3px]">
            {/* Weekday ruler stays put when the grid is pinned to the latest week. */}
            <div className="sticky left-0 z-10 flex flex-col gap-[3px] w-[15px] flex-none bg-surface">
              {WEEKDAY_LABELS.map((d, i) => (
                <div key={i} className="h-[11px] text-[9px] text-text-faint leading-[11px]">
                  {d}
                </div>
              ))}
            </div>

            {weeks.map((week, col) => (
              <div key={col} className="flex flex-col gap-[3px]">
                {week.map((day, row) => {
                  if (!day) return <div key={row} className="size-[11px]" />;
                  const a = intensity(day.total);
                  const isToday = day.date === today;
                  return (
                    <div
                      key={day.date}
                      onMouseEnter={() => setHover(day)}
                      onMouseLeave={() => setHover(null)}
                      title={`${day.date} · ${day.total > 0 ? formatINR(day.total) : "no spend"}`}
                      className="size-[11px] rounded-[3px]"
                      style={{
                        background:
                          a > 0
                            ? `color-mix(in srgb, var(--primary) ${Math.round(a * 100)}%, var(--surface-raised))`
                            : "var(--surface-raised)",
                        outline: isToday ? "1.5px solid var(--text-secondary)" : undefined,
                        outlineOffset: isToday ? "1px" : undefined,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-2.5 justify-end">
        <span className="text-[10px] text-text-faint">Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((a) => (
          <div
            key={a}
            className="size-[9px] rounded-[2px]"
            style={{
              background:
                a > 0
                  ? `color-mix(in srgb, var(--primary) ${Math.round(a * 100)}%, var(--surface-raised))`
                  : "var(--surface-raised)",
            }}
          />
        ))}
        <span className="text-[10px] text-text-faint">More</span>
      </div>
    </div>
  );
}
