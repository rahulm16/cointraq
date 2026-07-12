import {
  format,
  parse,
  isValid,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
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

/** A month key "yyyy-MM" and its inclusive first/last date strings. */
export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function monthRange(monthKey: string): { start: string; end: string } {
  const anchor = parse(monthKey + "-01", "yyyy-MM-dd", new Date());
  return {
    start: toDateStr(startOfMonth(anchor)),
    end: toDateStr(endOfMonth(anchor)),
  };
}

export function shiftMonth(monthKey: string, by: number): string {
  const anchor = parse(monthKey + "-01", "yyyy-MM-dd", new Date());
  return toDateStr(startOfMonth(by >= 0 ? addMonths(anchor, by) : subMonths(anchor, -by))).slice(0, 7);
}

/** Human labels used across UI. */
export function formatMonthLabel(monthKey: string): string {
  const anchor = parse(monthKey + "-01", "yyyy-MM-dd", new Date());
  return format(anchor, "MMMM yyyy"); // "July 2026"
}

export function formatDayLabel(dateStr: string): string {
  return format(parseDate(dateStr), "dd MMM yyyy"); // "11 Jul 2026"
}

export function formatDayShort(dateStr: string): string {
  return format(parseDate(dateStr), "dd MMM"); // "18 Jun"
}
