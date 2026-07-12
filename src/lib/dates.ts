import {
  format,
  parse,
  isValid,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  addDays,
  subDays,
  differenceInCalendarDays,
} from "date-fns";
import { APP_TZ } from "./constants";

/**
 * Plain calendar dates are strings (yyyy-MM-dd) end to end. We never build them
 * through `new Date(string)` timezone paths. The only place a real clock is read
 * is `todayIST()`, which asks Intl for the current date *in Asia/Kolkata*.
 */

const istFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Current calendar date in IST as "yyyy-MM-dd" (en-CA gives ISO order). */
export function todayIST(): string {
  return istFmt.format(new Date());
}

/** Parse a plain "yyyy-MM-dd" into a local Date at midnight (for date-fns math only). */
export function parseDate(s: string): Date {
  return parse(s, "yyyy-MM-dd", new Date());
}

/** Serialize a Date back to "yyyy-MM-dd". */
export function toDateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Validate a "yyyy-MM-dd" string is a real calendar date. */
export function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseDate(s);
  return isValid(d) && toDateStr(d) === s;
}

/** String comparison works for ISO dates: a <= b. */
export function dateLte(a: string, b: string): boolean {
  return a <= b;
}
export function dateLt(a: string, b: string): boolean {
  return a < b;
}
export function dateGt(a: string, b: string): boolean {
  return a > b;
}

export function inDateRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

/** Inclusive calendar-day span. */
export function daysInRange(from: string, to: string): number {
  return differenceInCalendarDays(parseDate(to), parseDate(from)) + 1;
}

export function shiftDate(dateStr: string, byDays: number): string {
  return toDateStr(addDays(parseDate(dateStr), byDays));
}

/** A month key "yyyy-MM" and its inclusive first/last date strings. */
export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function monthRange(mk: string): { start: string; end: string } {
  const anchor = parse(mk + "-01", "yyyy-MM-dd", new Date());
  return {
    start: toDateStr(startOfMonth(anchor)),
    end: toDateStr(endOfMonth(anchor)),
  };
}

export type DateRange = { from: string; to: string };

/** Full calendar month containing `dateStr` (or today). */
export function fullMonthRange(dateStr?: string): DateRange {
  const { start, end } = monthRange(monthKey(dateStr ?? todayIST()));
  return { from: start, to: end };
}

/** True when the range is exactly one calendar month. */
export function isFullMonthRange(range: DateRange): boolean {
  const { start, end } = monthRange(monthKey(range.from));
  return range.from === start && range.to === end && monthKey(range.from) === monthKey(range.to);
}

/** Swipe: jump to previous/next calendar month (full bounds). */
export function shiftRangeToAdjacentMonth(range: DateRange, by: number): DateRange {
  const mk = shiftMonth(monthKey(range.from), by);
  const { start, end } = monthRange(mk);
  return { from: start, to: end };
}

/** Equal-length window ending the day before `from` (for delta comparisons). */
export function previousEqualRange(range: DateRange): DateRange {
  const len = daysInRange(range.from, range.to);
  const to = shiftDate(range.from, -1);
  const from = shiftDate(to, -(len - 1));
  return { from, to };
}

export function shiftMonth(mk: string, by: number): string {
  const anchor = parse(mk + "-01", "yyyy-MM-dd", new Date());
  return toDateStr(startOfMonth(by >= 0 ? addMonths(anchor, by) : subMonths(anchor, -by))).slice(0, 7);
}

/** Human labels used across UI. */
export function formatMonthLabel(mk: string): string {
  const anchor = parse(mk + "-01", "yyyy-MM-dd", new Date());
  return format(anchor, "MMMM yyyy"); // "July 2026"
}

export function formatDayLabel(dateStr: string): string {
  return format(parseDate(dateStr), "dd MMM yyyy"); // "11 Jul 2026"
}

export function formatDayShort(dateStr: string): string {
  return format(parseDate(dateStr), "dd MMM"); // "18 Jun"
}

/** Label for the period bar / hero. */
export function formatPeriodLabel(range: DateRange): string {
  if (isFullMonthRange(range)) return formatMonthLabel(monthKey(range.from));
  if (range.from === range.to) return formatDayLabel(range.from);
  const sameMonth = monthKey(range.from) === monthKey(range.to);
  if (sameMonth) {
    return `${format(parseDate(range.from), "d")}–${format(parseDate(range.to), "d MMM yyyy")}`;
  }
  return `${formatDayShort(range.from)} – ${formatDayShort(range.to)} ${format(parseDate(range.to), "yyyy")}`;
}

export type PeriodPresetId = "this_month" | "last_month" | "last_7" | "last_30";

export function periodPresets(today = todayIST()): Record<PeriodPresetId, DateRange> {
  const thisMk = monthKey(today);
  return {
    this_month: fullMonthRange(today),
    last_month: (() => {
      const { start, end } = monthRange(shiftMonth(thisMk, -1));
      return { from: start, to: end };
    })(),
    last_7: { from: toDateStr(subDays(parseDate(today), 6)), to: today },
    last_30: { from: toDateStr(subDays(parseDate(today), 29)), to: today },
  };
}

/**
 * Resolve `from`/`to` (preferred) or legacy `m=yyyy-MM` from search params.
 * Defaults to the full current IST month.
 */
export function resolvePeriod(
  sp: Record<string, string | string[] | undefined>,
  today = todayIST(),
): DateRange {
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const to = typeof sp.to === "string" ? sp.to : undefined;
  if (from && to && isValidDateStr(from) && isValidDateStr(to) && from <= to) {
    return { from, to };
  }
  if (typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m)) {
    const { start, end } = monthRange(sp.m);
    return { from: start, to: end };
  }
  return fullMonthRange(today);
}
