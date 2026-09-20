import type { RecurringTemplate } from "./types";
import { dateInIST, parseDate, toDateStr, monthRange, monthKey, shiftMonth, shiftDate } from "./dates";
import { addDays, getDay, lastDayOfMonth, setDate } from "date-fns";

/**
 * Recurring templates — pure scheduling math, framework-free.
 *
 * These NEVER auto-log. The app derives what is due and the user logs it in one
 * tap; `lastLoggedDate` on the template is what marks an occurrence done. That
 * keeps the ledger honest: nothing appears in history the user didn't confirm.
 */

/** How far ahead of the due date a template starts showing up. */
export const UPCOMING_WINDOW_DAYS = 3;

export type DueState = "overdue" | "due" | "upcoming" | "done" | "scheduled";

export interface DueItem {
  template: RecurringTemplate;
  /** The occurrence date this item refers to (yyyy-MM-dd). */
  dueDate: string;
  state: DueState;
  /** Negative = overdue by N days, 0 = today, positive = N days away. */
  daysUntil: number;
}

/**
 * Clamp a day-of-month to a real date in the given month.
 * Day 31 in February becomes the 28th/29th — the same clamping rule the credit
 * card cycle uses (SPEC §6).
 */
export function clampDayOfMonth(month: string, day: number): string {
  const { start } = monthRange(month);
  const anchor = parseDate(start);
  const last = lastDayOfMonth(anchor).getDate();
  return toDateStr(setDate(anchor, Math.min(Math.max(day, 1), last)));
}

/**
 * The occurrence of a template that falls inside `month`, or null if it has none
 * (a yearly template only occurs in its own month).
 */
export function occurrenceInMonth(t: RecurringTemplate, month: string): string | null {
  switch (t.recurrence) {
    case "monthly":
      return clampDayOfMonth(month, t.dayOfMonth ?? 1);

    case "yearly": {
      const m = Number(month.slice(5, 7));
      if (t.monthOfYear != null && t.monthOfYear !== m) return null;
      return clampDayOfMonth(month, t.dayOfMonth ?? 1);
    }

    case "weekly":
      // Weekly has many occurrences per month — `nextWeeklyOn` handles it relative
      // to a reference date instead.
      return null;
  }
}

/** The next date on or after `from` whose weekday matches `dayOfWeek` (0=Sun). */
export function nextWeeklyOn(from: string, dayOfWeek: number): string {
  const d = parseDate(from);
  const diff = (dayOfWeek - getDay(d) + 7) % 7;
  return toDateStr(addDays(d, diff));
}

/**
 * The first occurrence strictly after `date` — i.e. the oldest period a log on
 * `date` does not cover.
 */
export function firstOccurrenceAfter(t: RecurringTemplate, date: string): string | null {
  switch (t.recurrence) {
    case "weekly":
      return nextWeeklyOn(shiftDate(date, 1), t.dayOfWeek ?? 1);

    case "monthly": {
      const mk = monthKey(date);
      const occ = clampDayOfMonth(mk, t.dayOfMonth ?? 1);
      return occ > date ? occ : clampDayOfMonth(shiftMonth(mk, 1), t.dayOfMonth ?? 1);
    }

    case "yearly": {
      if (t.monthOfYear == null) return null;
      const m = String(t.monthOfYear).padStart(2, "0");
      const year = Number(date.slice(0, 4));
      const occ = clampDayOfMonth(`${year}-${m}`, t.dayOfMonth ?? 1);
      return occ > date ? occ : clampDayOfMonth(`${year + 1}-${m}`, t.dayOfMonth ?? 1);
    }
  }
}

/**
 * The occurrence a template is currently pointed at, relative to `today`.
 *
 * Normally this is the current period's occurrence — even once it has passed, so
 * a missed rent payment shows as overdue. Once logged, it advances to the next
 * period. A period that was never logged stays first in line across period
 * boundaries: if the first occurrence after the last log is older than the
 * current one, that older one is returned, so August's missed rent doesn't
 * vanish on 1 September.
 */
export function currentOccurrence(t: RecurringTemplate, today: string): string | null {
  const pointer = periodOccurrence(t, today);
  // Older rows may predate lastLoggedDate initialisation. Creation is their
  // floor: preserve occurrences since the template existed, but never invent
  // overdue occurrences from before it was created.
  const createdDate = dateInIST(t.createdAt);
  const floor = t.lastLoggedDate ?? shiftDate(createdDate, -1);
  const oldestUnlogged = firstOccurrenceAfter(t, floor);
  if (oldestUnlogged !== null) {
    if (pointer === null || oldestUnlogged < pointer) return oldestUnlogged;
    if (t.lastLoggedDate == null && pointer < createdDate) return oldestUnlogged;
  }
  return pointer;
}

/** The current period's occurrence, or the next period's once this one is logged. */
function periodOccurrence(t: RecurringTemplate, today: string): string | null {
  if (t.recurrence === "weekly") {
    const dow = t.dayOfWeek ?? 1;
    // The most recent matching weekday on or before today.
    const d = parseDate(today);
    const back = (getDay(d) - dow + 7) % 7;
    const thisWeek = toDateStr(addDays(d, -back));
    // If it's already logged, point at next week's.
    if (t.lastLoggedDate && t.lastLoggedDate >= thisWeek) return nextWeeklyOn(toDateStr(addDays(parseDate(thisWeek), 7)), dow);
    return thisWeek;
  }

  const thisMonth = monthKey(today);
  const here = occurrenceInMonth(t, thisMonth);

  // Yearly templates outside their month: point at the next year's occurrence.
  if (here === null) {
    if (t.recurrence !== "yearly" || t.monthOfYear == null) return null;
    const year = Number(thisMonth.slice(0, 4));
    const m = String(t.monthOfYear).padStart(2, "0");
    const candidate = clampDayOfMonth(`${year}-${m}`, t.dayOfMonth ?? 1);
    return candidate >= today ? candidate : clampDayOfMonth(`${year + 1}-${m}`, t.dayOfMonth ?? 1);
  }

  // Already logged for this occurrence → show the next period's.
  if (t.lastLoggedDate && t.lastLoggedDate >= here) {
    const next = occurrenceInMonth(t, shiftMonth(thisMonth, t.recurrence === "yearly" ? 12 : 1));
    return next;
  }

  return here;
}

/** Whole days from `today` to `date` (negative = in the past). */
function dayGap(today: string, date: string): number {
  const a = parseDate(today).getTime();
  const b = parseDate(date).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Classify one template against today. `done` means this period's occurrence has
 * already been logged; `scheduled` means it's further out than the reveal window.
 */
export function dueItem(t: RecurringTemplate, today: string): DueItem | null {
  const dueDate = currentOccurrence(t, today);
  if (dueDate === null) return null;

  const daysUntil = dayGap(today, dueDate);
  const logged = t.lastLoggedDate != null && t.lastLoggedDate >= dueDate;

  let state: DueState;
  if (logged) state = "done";
  else if (daysUntil < 0) state = "overdue";
  else if (daysUntil === 0) state = "due";
  else if (daysUntil <= UPCOMING_WINDOW_DAYS) state = "upcoming";
  else state = "scheduled";

  return { template: t, dueDate, state, daysUntil };
}

/**
 * Everything worth surfacing on the dashboard, most urgent first.
 * Archived templates and anything beyond the reveal window are dropped.
 */
export function dueNow(templates: RecurringTemplate[], today: string): DueItem[] {
  const ORDER: Record<DueState, number> = { overdue: 0, due: 1, upcoming: 2, done: 3, scheduled: 4 };
  return templates
    .filter((t) => !t.isArchived)
    .map((t) => dueItem(t, today))
    .filter((d): d is DueItem => d !== null && d.state !== "scheduled" && d.state !== "done")
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.dueDate.localeCompare(b.dueDate));
}

/** All templates with their state — for the Settings management list. */
export function allWithState(templates: RecurringTemplate[], today: string): DueItem[] {
  return templates
    .map((t) => dueItem(t, today))
    .filter((d): d is DueItem => d !== null)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Human label for a template's schedule, e.g. "Monthly on the 5th". */
export function describeSchedule(t: RecurringTemplate): string {
  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  switch (t.recurrence) {
    case "weekly":
      return `Weekly on ${WEEKDAYS[t.dayOfWeek ?? 1]}`;
    case "monthly":
      return `Monthly on the ${ordinal(t.dayOfMonth ?? 1)}`;
    case "yearly":
      return `Yearly on ${ordinal(t.dayOfMonth ?? 1)} ${MONTHS[(t.monthOfYear ?? 1) - 1]}`;
  }
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
