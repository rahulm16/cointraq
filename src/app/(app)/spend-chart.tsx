"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { formatDayLabel, formatDayShort, formatMonthLabel, parseDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { DUR, EASE, SPRING, fadeTransition } from "@/lib/motion";
import { cn } from "@/lib/ui";
import { INRFlow } from "@/components/inr-flow";
import { Card, Eyebrow } from "@/components/ui";

/**
 * One spend chart, two zoom levels: the days of the viewed period, or the
 * trailing twelve months around it. Both are the same bar language, so the
 * toggle reads as a zoom rather than a different chart.
 *
 * Bar depth tracks value (like the year heatmap) so the shape of a month is
 * legible before any number is read; hovering or tapping a bar promotes it into
 * the readout above instead of floating a tooltip over the data.
 */

type Mode = "daily" | "monthly";

type SpendBar = {
  key: string;
  /** Full label shown in the readout when the bar is active. */
  label: string;
  /** Compact label for the peak chip ("14 Jul", "Mar"). */
  short: string;
  /** Label under the axis; empty means "no tick here". */
  tick: string;
  total: number;
  /** Weekends read one step back so week rhythm is visible. */
  muted: boolean;
  /** Today in daily mode, the current month in monthly mode. */
  marker: boolean;
  /** Hasn't happened yet — excluded from averages, drawn as an empty slot. */
  future: boolean;
};

const CHART_HEIGHT = 148;

export function SpendChart({
  daily,
  monthly,
  periodLabel,
  today,
}: {
  daily: { date: string; total: number }[];
  monthly: { month: string; total: number }[];
  periodLabel: string;
  today: string;
}) {
  const [mode, setMode] = useState<Mode>("daily");
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const bars = useMemo(
    () => (mode === "daily" ? buildDailyBars(daily, today) : buildMonthlyBars(monthly, today)),
    [mode, daily, monthly, today],
  );

  const stats = useMemo(() => {
    const elapsed = bars.filter((b) => !b.future);
    const total = elapsed.reduce((sum, b) => sum + b.total, 0);
    const max = Math.max(...bars.map((b) => b.total), 0);
    const peak = elapsed.reduce<SpendBar | null>(
      (best, b) => (b.total > 0 && (!best || b.total > best.total) ? b : best),
      null,
    );
    return { total, max, peak, avg: elapsed.length > 0 ? total / elapsed.length : 0 };
  }, [bars]);

  const active = activeKey ? (bars.find((b) => b.key === activeKey) ?? null) : null;
  const unit = mode === "daily" ? "day" : "month";
  const gap = bars.length > 45 ? "gap-[2px]" : bars.length > 16 ? "gap-[3px]" : "gap-1.5";

  // One persistent readout, never remounted — the digits have to roll from the
  // previous value as you sweep across bars or flip modes, not restart.
  const caption = active
    ? active.future
      ? `${active.label} · upcoming`
      : active.label
    : mode === "daily"
      ? periodLabel
      : "Last 12 months";

  return (
    <Card className="!p-[18px_20px_14px] min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>Spend</Eyebrow>
          <div className="text-[27px] leading-[1.2] mt-1 text-text-primary">
            <INRFlow value={active ? active.total : stats.total} />
          </div>
          <div className="relative mt-0.5 h-[15px]">
            <motion.div
              key={caption}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={fadeTransition(DUR.fast)}
              className="absolute inset-0 text-[11.5px] text-text-secondary truncate"
            >
              {caption}
            </motion.div>
          </div>
        </div>

        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {stats.max > 0 ? (
        <>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <Stat label={`Avg / ${unit}`} value={formatINR(stats.avg)} />
            {stats.peak && (
              <Stat label="Peak" value={`${formatINR(stats.peak.total)} · ${stats.peak.short}`} />
            )}
          </div>

          <div
            className="relative mt-4"
            style={{ height: CHART_HEIGHT }}
            onPointerLeave={() => setActiveKey(null)}
          >
            {/* Average reference — the line a bar has to clear to be a heavy day. */}
            <div
              className="absolute inset-x-0 flex items-center pointer-events-none"
              style={{ bottom: `${(stats.avg / stats.max) * 100}%` }}
            >
              <div className="flex-1 border-t border-dashed border-text-faint/35" />
              <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-[0.07em] text-text-faint">
                avg
              </span>
            </div>

            <div key={mode} className={cn("flex items-end h-full", gap)}>
              {bars.map((bar, i) => (
                <Bar
                  key={bar.key}
                  bar={bar}
                  max={stats.max}
                  index={i}
                  isActive={bar.key === activeKey}
                  isPeak={stats.peak?.key === bar.key}
                  onActivate={() => setActiveKey(bar.key)}
                />
              ))}
            </div>
          </div>

          {/* Ticks are absolutely centred so a label can overflow a 5px column. */}
          <div className={cn("flex mt-2 h-3", gap)}>
            {bars.map((bar) => (
              <div key={bar.key} className="relative flex-1 basis-0">
                {bar.tick && (
                  <span
                    className={cn(
                      "absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[9.5px] leading-none tnum",
                      bar.marker ? "text-primary font-semibold" : "text-text-faint",
                    )}
                  >
                    {bar.tick}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-[13px] text-text-faint text-center py-12">
          No spend {mode === "daily" ? "in this period" : "in the last 12 months"}.
        </div>
      )}
    </Card>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex flex-none items-center rounded-full bg-surface-raised p-0.5">
      {(["daily", "monthly"] as const).map((m) => {
        const on = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={on}
            className={cn(
              "relative h-7 rounded-full px-3 text-[11.5px] font-semibold pressable",
              on ? "text-primary-contrast" : "text-text-secondary",
            )}
          >
            {on && (
              <motion.span
                layoutId="spend-mode-pill"
                transition={SPRING}
                className="absolute inset-0 rounded-full bg-primary"
                aria-hidden
              />
            )}
            <span className="relative">{m === "daily" ? "Daily" : "Monthly"}</span>
          </button>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full bg-surface-raised px-2.5 py-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-text-faint">
        {label}
      </span>
      <span className="text-[11.5px] tnum text-text-primary">{value}</span>
    </span>
  );
}

function Bar({
  bar,
  max,
  index,
  isActive,
  isPeak,
  onActivate,
}: {
  bar: SpendBar;
  max: number;
  index: number;
  isActive: boolean;
  isPeak: boolean;
  onActivate: () => void;
}) {
  // Depth carries value, so a tall bar is also a darker one. Zero and future
  // slots keep a 3px stub — a gap should read as "no spend", not "no data".
  const ratio = max > 0 ? bar.total / max : 0;
  const strength = isActive || isPeak ? 100 : Math.round((bar.muted ? 42 : 56) + ratio * 38);

  return (
    <button
      type="button"
      onPointerEnter={onActivate}
      onFocus={onActivate}
      onClick={onActivate}
      aria-label={`${bar.label}: ${bar.total > 0 ? formatINR(bar.total) : "no spend"}`}
      className="flex-1 min-w-0 h-full flex flex-col justify-end"
    >
      <motion.span
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: DUR.base, ease: EASE, delay: Math.min(index * 0.012, 0.35) }}
        className="block w-full rounded-t-[5px] origin-bottom"
        style={{
          height: `max(3px, ${ratio * 100}%)`,
          background: bar.future
            ? "color-mix(in srgb, var(--text-faint) 18%, transparent)"
            : bar.total > 0
              ? `color-mix(in srgb, var(--primary) ${strength}%, var(--surface-raised))`
              : "color-mix(in srgb, var(--text-faint) 28%, transparent)",
          outline: isActive ? "1.5px solid color-mix(in srgb, var(--primary) 45%, transparent)" : undefined,
          outlineOffset: 1.5,
        }}
      />
    </button>
  );
}

/** Every day of the viewed period, with a tick on roughly six of them. */
function buildDailyBars(daily: { date: string; total: number }[], today: string): SpendBar[] {
  const step = Math.max(1, Math.ceil(daily.length / 6));
  const last = daily.length - 1;
  return daily.map(({ date, total }, i) => {
    const dow = parseDate(date).getDay();
    const showTick = i === last || (i % step === 0 && last - i >= step / 2);
    return {
      key: date,
      label: formatDayLabel(date),
      short: formatDayShort(date),
      tick: showTick ? String(Number(date.slice(8, 10))) : "",
      total,
      muted: dow === 0 || dow === 6,
      marker: date === today,
      future: date > today,
    };
  });
}

/**
 * Trailing twelve months, every bar labelled. The window ends at the viewed
 * month, so marking the last bar is what ties this view back to the daily one.
 */
function buildMonthlyBars(monthly: { month: string; total: number }[], today: string): SpendBar[] {
  const nowMonth = today.slice(0, 7);
  const last = monthly.length - 1;
  return monthly.map(({ month, total }, i) => {
    const label = formatMonthLabel(month);
    return {
      key: month,
      label,
      short: label.slice(0, 3),
      tick: label.slice(0, 3),
      total,
      muted: false,
      marker: i === last,
      future: month > nowMonth,
    };
  });
}
