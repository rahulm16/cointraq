"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { format, parse } from "date-fns";
import { fadeTransition } from "@/lib/motion";
import { cn } from "@/lib/ui";
import {
  formatDayLabel,
  formatPeriodLabel,
  isFullMonthRange,
  monthKey,
  monthRange,
  periodPresets,
  shiftDate,
  shiftMonth,
  shiftRangeToAdjacentMonth,
  todayIST,
  type DateRange,
  type PeriodPresetId,
} from "@/lib/dates";
import { DatePicker, RangeDatePicker } from "@/components/date-picker";
import { Eyebrow } from "@/components/ui";

const PRESET_LABELS: { id: PeriodPresetId; label: string }[] = [
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "last_7", label: "Last 7 days" },
  { id: "last_30", label: "Last 30 days" },
];

function PickerSheetShell({
  open,
  onClose,
  children,
  footer,
  maxWidth = "sm:max-w-[440px]",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-0 sm:px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition()}
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={fadeTransition()}
            role="dialog"
            aria-modal="true"
            className={cn(
              "relative flex w-full max-h-[min(92dvh,640px)] flex-col overflow-hidden bg-surface-overlay shadow-[var(--shadow-overlay)]",
              "rounded-t-[24px] sm:rounded-card",
              maxWidth,
            )}
          >
            <div aria-hidden className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-text-faint/30 sm:hidden" />
            <div className="flex shrink-0 justify-end px-4 pt-2 sm:pt-3">
              <button
                type="button"
                onClick={onClose}
                className="icon-btn flex size-8 items-center justify-center rounded-full text-text-faint pressable"
                aria-label="Close"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
            {footer && (
              <div className="shrink-0 border-t border-border/60 px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function SelectionHero({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="rounded-inner bg-primary/10 px-4 py-3.5 text-center">
      {hint && <Eyebrow className="!text-primary/70">{hint}</Eyebrow>}
      <div className={cn("tnum text-[22px] font-semibold leading-tight text-text-primary", hint && "mt-1")}>
        {label}
      </div>
    </div>
  );
}

/**
 * Fixed period control: swipe months, tap to open a picker card with presets,
 * month grid, and custom date range.
 */
export function PeriodBar({
  from,
  to,
  maxMonth,
}: {
  from: string;
  to: string;
  maxMonth: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const range: DateRange = { from, to };
  const [open, setOpen] = useState(false);
  const dragX = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const label = formatPeriodLabel(range);
  const canGoNext = shiftMonth(monthKey(from), 1) <= maxMonth;

  function pushRange(next: DateRange) {
    const p = new URLSearchParams(params.toString());
    p.delete("m");
    p.set("from", next.from);
    p.set("to", next.to);
    router.push(`${pathname}?${p.toString()}`);
  }

  function swipe(by: number) {
    if (by > 0 && !canGoNext) return;
    pushRange(shiftRangeToAdjacentMonth(range, by));
  }

  function onPointerDown(e: React.PointerEvent) {
    dragX.current = e.clientX;
    didSwipe.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragX.current == null) return;
    const dx = e.clientX - dragX.current;
    dragX.current = null;
    if (Math.abs(dx) < 48) return;
    didSwipe.current = true;
    swipe(dx < 0 ? 1 : -1);
  }

  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 px-4 lg:-mx-8 lg:px-8 py-3 mb-1 bg-background/80 backdrop-blur-md">
        <button
          type="button"
          onClick={() => {
            if (didSwipe.current) {
              didSwipe.current = false;
              return;
            }
            setOpen(true);
          }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragX.current = null;
          }}
          aria-label={`Period ${label}. Tap to change, swipe to switch months.`}
          className="w-full h-10 flex items-center justify-center gap-2 pressable select-none touch-pan-y"
        >
          <CalendarDays size={16} strokeWidth={1.75} className="text-text-faint shrink-0" />
          <span className="text-[15px] font-semibold text-text-primary truncate">{label}</span>
        </button>
      </div>

      <PeriodPickerCard
        open={open}
        from={from}
        to={to}
        maxMonth={maxMonth}
        onClose={() => setOpen(false)}
        onApply={(next) => {
          pushRange(next);
          setOpen(false);
        }}
      />
    </>
  );
}

function PeriodPickerCard({
  open,
  from,
  to,
  maxMonth,
  onClose,
  onApply,
}: {
  open: boolean;
  from: string;
  to: string;
  maxMonth: string;
  onClose: () => void;
  onApply: (range: DateRange) => void;
}) {
  const today = todayIST();
  const presets = periodPresets(today);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [year, setYear] = useState(() => Number(monthKey(from).slice(0, 4)));
  const [rangeSession, setRangeSession] = useState(0);

  useEffect(() => {
    if (!open) return;
    setDraftFrom(from);
    setDraftTo(to);
    setYear(Number(monthKey(from).slice(0, 4)));
    setRangeSession((n) => n + 1);
  }, [open, from, to]);

  const maxDate = monthRange(maxMonth).end;
  const draft: DateRange = {
    from: draftFrom <= draftTo ? draftFrom : draftTo,
    to: draftFrom <= draftTo ? draftTo : draftFrom,
  };
  const rangeDirty = draft.from !== from || draft.to !== to;

  function applyPreset(id: PeriodPresetId) {
    onApply(presets[id]);
  }

  function applyMonth(mk: string) {
    if (mk > maxMonth) return;
    const { start, end } = monthRange(mk);
    onApply({ from: start, to: end });
  }

  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

  return (
    <PickerSheetShell
      open={open}
      onClose={onClose}
      footer={
        rangeDirty ? (
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-control bg-primary text-[14px] font-semibold text-primary-contrast pressable shadow-[var(--shadow-hero)]"
          >
            <Check size={16} strokeWidth={2.25} />
            Apply {formatPeriodLabel(draft)}
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        <SelectionHero label={formatPeriodLabel(draft)} hint="Viewing" />

        <section>
          <Eyebrow className="mb-2.5">Quick pick</Eyebrow>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-none">
            {PRESET_LABELS.map(({ id, label }) => {
              const r = presets[id];
              const active = r.from === draft.from && r.to === draft.to;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyPreset(id)}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold pressable",
                    active
                      ? "bg-primary/12 text-primary ring-1 ring-primary/25"
                      : "bg-surface-raised text-text-secondary",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <Eyebrow>Pick a month</Eyebrow>
            <div className="flex items-center gap-1 rounded-full bg-surface-raised p-0.5">
              <button
                type="button"
                onClick={() => setYear((y) => y - 1)}
                className="icon-btn flex size-7 items-center justify-center rounded-full text-text-secondary pressable"
                aria-label={`Show ${year - 1}`}
              >
                <ChevronLeft size={15} strokeWidth={1.9} />
              </button>
              <span className="min-w-[3ch] px-1 text-center text-[13px] font-semibold text-text-primary tnum">
                {year}
              </span>
              <button
                type="button"
                onClick={() => setYear((y) => y + 1)}
                disabled={`${year + 1}-01` > maxMonth}
                className="icon-btn flex size-7 items-center justify-center rounded-full text-text-secondary pressable disabled:opacity-30"
                aria-label={`Show ${year + 1}`}
              >
                <ChevronRight size={15} strokeWidth={1.9} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {months.map((mk) => {
              const disabled = mk > maxMonth;
              const active =
                isFullMonthRange({ from: draftFrom, to: draftTo }) &&
                monthKey(draftFrom) === mk;
              const short = format(parse(mk + "-01", "yyyy-MM-dd", new Date()), "MMM");
              return (
                <button
                  key={mk}
                  type="button"
                  disabled={disabled}
                  onClick={() => applyMonth(mk)}
                  className={cn(
                    "h-8 rounded-inner px-1 text-[11.5px] font-semibold pressable",
                    active
                      ? "bg-primary text-primary-contrast shadow-[var(--shadow-hero)]"
                      : "bg-surface-raised text-text-secondary",
                    disabled && "opacity-30",
                  )}
                >
                  {short}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <Eyebrow className="mb-2.5">Custom range</Eyebrow>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-control bg-surface-raised px-3 py-2.5">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-text-faint">
                From
              </span>
              <span className="mt-0.5 block text-[13px] font-semibold text-text-primary tnum">
                {format(parse(draft.from, "yyyy-MM-dd", new Date()), "dd MMM yyyy")}
              </span>
            </div>
            <div className="rounded-control bg-surface-raised px-3 py-2.5">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-text-faint">
                To
              </span>
              <span className="mt-0.5 block text-[13px] font-semibold text-text-primary tnum">
                {format(parse(draft.to, "yyyy-MM-dd", new Date()), "dd MMM yyyy")}
              </span>
            </div>
          </div>
          <RangeDatePicker
            key={rangeSession}
            from={draftFrom}
            to={draftTo}
            max={maxDate}
            onChange={({ from: f, to: t }) => {
              setDraftFrom(f);
              setDraftTo(t);
            }}
          />
        </section>
      </div>
    </PickerSheetShell>
  );
}

/** Content transition keyed by period string. */
export function PeriodTransition({
  periodKey,
  children,
}: {
  periodKey: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      key={periodKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={fadeTransition()}
    >
      {children}
    </motion.div>
  );
}

/**
 * Sticky single-date control (reconcile “as of”). Same chrome as PeriodBar;
 * swipe shifts by day, tap opens Today / Yesterday + calendar.
 */
export function DateBar({
  date,
  max,
  param = "d",
}: {
  date: string;
  max: string;
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const dragX = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const label = formatDayLabel(date);
  const canGoNext = date < max;

  function pushDate(next: string) {
    if (next > max) return;
    const p = new URLSearchParams(params.toString());
    p.set(param, next);
    router.push(`${pathname}?${p.toString()}`);
  }

  function swipe(by: number) {
    const next = shiftDate(date, by);
    if (by > 0 && next > max) return;
    pushDate(next);
  }

  function onPointerDown(e: React.PointerEvent) {
    dragX.current = e.clientX;
    didSwipe.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragX.current == null) return;
    const dx = e.clientX - dragX.current;
    dragX.current = null;
    if (Math.abs(dx) < 48) return;
    didSwipe.current = true;
    swipe(dx < 0 ? 1 : -1);
  }

  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 px-4 lg:-mx-8 lg:px-8 py-3 mb-1 bg-background/80 backdrop-blur-md">
        <button
          type="button"
          onClick={() => {
            if (didSwipe.current) {
              didSwipe.current = false;
              return;
            }
            setOpen(true);
          }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragX.current = null;
          }}
          aria-label={`As of ${label}. Tap to change, swipe to shift days.`}
          className="w-full h-10 flex items-center justify-center gap-2 pressable select-none touch-pan-y"
        >
          <CalendarDays size={16} strokeWidth={1.75} className="text-text-faint shrink-0" />
          <span className="text-[15px] font-semibold text-text-primary truncate">{label}</span>
          {!canGoNext && (
            <span className="text-[11px] font-medium text-text-faint">Today</span>
          )}
        </button>
      </div>

      <SingleDatePickerCard
        open={open}
        date={date}
        max={max}
        onClose={() => setOpen(false)}
        onApply={(next) => {
          pushDate(next);
          setOpen(false);
        }}
      />
    </>
  );
}

function SingleDatePickerCard({
  open,
  date,
  max,
  onClose,
  onApply,
}: {
  open: boolean;
  date: string;
  max: string;
  onClose: () => void;
  onApply: (date: string) => void;
}) {
  const today = todayIST();
  const yesterday = shiftDate(today, -1);
  const [draft, setDraft] = useState(date);

  useEffect(() => {
    if (!open) return;
    setDraft(date);
  }, [open, date]);

  const anchor = parse(draft, "yyyy-MM-dd", new Date());
  const presets = [
    { label: "Today", value: today },
    { label: "Yesterday", value: yesterday },
  ];

  return (
    <PickerSheetShell open={open} onClose={onClose} maxWidth="sm:max-w-[380px]">
      <div className="flex flex-col gap-5">
        <div className="rounded-inner bg-primary/10 px-4 py-5 text-center">
          <div className="tnum text-[36px] font-semibold leading-none text-text-primary">
            {format(anchor, "dd")}
          </div>
          <div className="mt-1.5 text-[14px] font-medium text-text-secondary">
            {format(anchor, "EEEE, MMMM yyyy")}
          </div>
          <div className="mt-4 flex justify-center gap-2">
            {presets.map(({ label, value }) => {
              const active = draft === value;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onApply(value)}
                  className={cn(
                    "rounded-full px-4 py-2 text-[13px] font-semibold pressable",
                    active
                      ? "bg-primary text-primary-contrast shadow-[var(--shadow-hero)]"
                      : "bg-surface-raised text-text-secondary",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <DatePicker
          value={draft}
          max={max}
          onChange={(d) => {
            setDraft(d);
            onApply(d);
          }}
        />
      </div>
    </PickerSheetShell>
  );
}
