"use client";

import { useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/ui";
import { parseDate, toDateStr, monthKey, formatDayShort, shiftDate, type DateRange } from "@/lib/dates";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function CalendarShell({
  viewAnchor,
  atMinMonth,
  atMaxMonth,
  onPrev,
  onNext,
  children,
  className,
}: {
  viewAnchor: Date;
  atMinMonth: boolean;
  atMaxMonth: boolean;
  onPrev: () => void;
  onNext: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-inner bg-surface-raised p-3", className)}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          disabled={atMinMonth}
          onClick={onPrev}
          className="icon-btn flex size-8 items-center justify-center rounded-full text-text-secondary pressable disabled:opacity-30"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <div className="text-[13px] font-semibold text-text-primary">{format(viewAnchor, "MMMM yyyy")}</div>
        <button
          type="button"
          disabled={atMaxMonth}
          onClick={onNext}
          className="icon-btn flex size-8 items-center justify-center rounded-full text-text-secondary pressable disabled:opacity-30"
          aria-label="Next month"
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-medium text-text-faint">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">{children}</div>
    </div>
  );
}

/**
 * Compact calendar date picker. Writes a hidden input when `name` is set so
 * it works inside server-action forms.
 */
export function DatePicker({
  name,
  value,
  defaultValue,
  onChange,
  min,
  max,
  className,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (date: string) => void;
  min?: string;
  max?: string;
  className?: string;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const controlled = value !== undefined;
  const selected = controlled ? value! : uncontrolled;

  const [viewMk, setViewMk] = useState(() =>
    monthKey(selected || max || min || toDateStr(new Date())),
  );

  const viewAnchor = parseDate(viewMk + "-01");
  const days = useMemo(() => {
    const start = startOfMonth(viewAnchor);
    const end = endOfMonth(viewAnchor);
    return eachDayOfInterval({ start, end });
    // viewMk drives viewAnchor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMk]);

  const startPad = startOfMonth(viewAnchor).getDay();

  function pick(d: Date) {
    const s = toDateStr(d);
    if (min && s < min) return;
    if (max && s > max) return;
    if (!controlled) setUncontrolled(s);
    onChange?.(s);
  }

  const atMinMonth = min ? viewMk <= monthKey(min) : false;
  const atMaxMonth = max ? viewMk >= monthKey(max) : false;

  return (
    <div className={cn("rounded-inner bg-surface-raised p-3", className)}>
      {name != null && <input type="hidden" name={name} value={selected} />}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          disabled={atMinMonth}
          onClick={() => setViewMk(monthKey(toDateStr(subMonths(viewAnchor, 1))))}
          className="icon-btn flex size-8 items-center justify-center rounded-full text-text-secondary pressable disabled:opacity-30"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <div className="text-[13px] font-semibold text-text-primary">{format(viewAnchor, "MMMM yyyy")}</div>
        <button
          type="button"
          disabled={atMaxMonth}
          onClick={() => setViewMk(monthKey(toDateStr(addMonths(viewAnchor, 1))))}
          className="icon-btn flex size-8 items-center justify-center rounded-full text-text-secondary pressable disabled:opacity-30"
          aria-label="Next month"
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-medium text-text-faint">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
      {Array.from({ length: startPad }).map((_, i) => (
        <div key={`pad-${i}`} />
      ))}
      {days.map((d) => {
        const s = toDateStr(d);
        const disabled =
          (min != null && s < min) || (max != null && s > max) || !isSameMonth(d, viewAnchor);
        const isSel = Boolean(selected && isSameDay(d, parseDate(selected)));
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => pick(d)}
            className={cn(
              "h-9 rounded-full text-[12.5px] tnum pressable",
              isSel
                ? "bg-primary text-primary-contrast font-semibold shadow-[var(--shadow-hero)]"
                : "text-text-primary hover:bg-surface",
              disabled && "opacity-25 pointer-events-none",
            )}
          >
            {format(d, "d")}
          </button>
        );
      })}
      </div>
    </div>
  );
}

/** Calendar for picking a from/to range with in-between highlighting. */
export function RangeDatePicker({
  from,
  to,
  onChange,
  max,
  className,
}: {
  from: string;
  to: string;
  onChange: (range: DateRange) => void;
  max?: string;
  className?: string;
}) {
  const lo = from <= to ? from : to;
  const hi = from <= to ? to : from;
  const [viewMk, setViewMk] = useState(() => monthKey(from));
  const [pickingEnd, setPickingEnd] = useState(false);

  const viewAnchor = parseDate(viewMk + "-01");
  const days = useMemo(() => {
    const start = startOfMonth(viewAnchor);
    const end = endOfMonth(viewAnchor);
    return eachDayOfInterval({ start, end });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMk]);

  const startPad = startOfMonth(viewAnchor).getDay();
  const atMaxMonth = max ? viewMk >= monthKey(max) : false;

  function pick(d: Date) {
    const s = toDateStr(d);
    if (max && s > max) return;

    if (!pickingEnd) {
      onChange({ from: s, to: s });
      setPickingEnd(true);
      return;
    }

    const start = s < from ? s : from;
    const end = s < from ? from : s;
    onChange({ from: start, to: end });
    setPickingEnd(false);
  }

  return (
    <CalendarShell
      viewAnchor={viewAnchor}
      atMinMonth={false}
      atMaxMonth={atMaxMonth}
      onPrev={() => setViewMk(monthKey(toDateStr(subMonths(viewAnchor, 1))))}
      onNext={() => setViewMk(monthKey(toDateStr(addMonths(viewAnchor, 1))))}
      className={className}
    >
      {Array.from({ length: startPad }).map((_, i) => (
        <div key={`pad-${i}`} />
      ))}
      {days.map((d) => {
        const s = toDateStr(d);
        const disabled = (max != null && s > max) || !isSameMonth(d, viewAnchor);
        const inRange = s >= lo && s <= hi;
        const isStart = s === lo;
        const isEnd = s === hi;
        const isEndpoint = isStart || isEnd;
        const isSingle = lo === hi && inRange;

        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => pick(d)}
            className={cn(
              "flex h-9 items-center justify-center pressable",
              disabled && "pointer-events-none opacity-25",
            )}
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-[12.5px] tnum",
                (isSingle || isEndpoint) &&
                  "bg-primary font-semibold text-primary-contrast shadow-[var(--shadow-hero)]",
                inRange && !isEndpoint && "bg-primary/14 font-medium text-primary",
                !inRange && "text-text-primary hover:bg-surface",
              )}
            >
              {format(d, "d")}
            </span>
          </button>
        );
      })}
    </CalendarShell>
  );
}

/** Date control for transaction forms: trigger + Today/Yesterday + calendar. */
export function DateFieldControl({
  name,
  defaultValue,
  today,
  max,
}: {
  name: string;
  defaultValue?: string;
  today: string;
  max?: string;
}) {
  const [date, setDate] = useState(defaultValue ?? today);
  const [open, setOpen] = useState(false);
  const yesterday = shiftDate(today, -1);
  const cap = max ?? today;

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={date} />
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="h-10 px-3 rounded-control bg-surface-raised border border-transparent outline-none text-[15px] tnum text-text-primary pressable"
        >
          {formatDayShort(date)}
        </button>
        <button
          type="button"
          onClick={() => setDate(today)}
          className={cn(
            "h-9 px-3 rounded-full text-[12.5px] font-medium pressable",
            date === today ? "bg-primary/15 text-primary" : "bg-surface-raised text-text-secondary",
          )}
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => setDate(yesterday)}
          className={cn(
            "h-9 px-3 rounded-full text-[12.5px] font-medium pressable",
            date === yesterday ? "bg-primary/15 text-primary" : "bg-surface-raised text-text-secondary",
          )}
        >
          Yesterday
        </button>
      </div>
      {open && (
        <DatePicker
          value={date}
          onChange={(d) => {
            setDate(d);
            setOpen(false);
          }}
          max={cap}
        />
      )}
    </div>
  );
}
