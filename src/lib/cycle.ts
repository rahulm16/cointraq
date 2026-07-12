import { addMonths, subMonths, setDate, lastDayOfMonth, getDate } from "date-fns";
import { parseDate, toDateStr } from "./dates";

export interface Cycle {
  start: string; // inclusive, yyyy-MM-dd
  end: string; // inclusive, yyyy-MM-dd
}

/**
 * Set the billing day on a month, clamping to that month's last day when the
 * month is shorter than D (e.g. D=31 in Feb clamps to 28/29).
 */
function clampedBillingDay(anchor: Date, billingDay: number): Date {
  const last = getDate(lastDayOfMonth(anchor));
  return setDate(anchor, Math.min(billingDay, last));
}

/**
 * The billing cycle that CONTAINS date X for a card with billing day D.
 * Cycle runs from (D+1) of previous month through D of X's month if X.day <= D,
 * else from (D+1) of this month through D of next month. Ends are clamped for
 * short months.  SPEC §6.
 */
export function cycleContaining(dateStr: string, billingDay: number): Cycle {
  const x = parseDate(dateStr);
  const endThisMonth = clampedBillingDay(x, billingDay);

  let cycleEnd: Date;
  if (getDate(x) <= getDate(endThisMonth)) {
    cycleEnd = endThisMonth;
  } else {
    cycleEnd = clampedBillingDay(addMonths(x, 1), billingDay);
  }

  // Start = the day after the previous cycle's end (clamped billing day of the
  // month before cycleEnd's month).
  const prevEnd = clampedBillingDay(subMonths(cycleEnd, 1), billingDay);
  const start = addDaysStr(prevEnd, 1);

  return { start, end: toDateStr(cycleEnd) };
}

function addDaysStr(d: Date, days: number): string {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return toDateStr(copy);
}

/** The cycle immediately before the one containing `dateStr`. */
export function previousCycle(dateStr: string, billingDay: number): Cycle {
  const current = cycleContaining(dateStr, billingDay);
  // A day inside the previous cycle = the day before current.start.
  const beforeStart = parseDate(current.start);
  beforeStart.setDate(beforeStart.getDate() - 1);
  return cycleContaining(toDateStr(beforeStart), billingDay);
}

/** True when dateStr falls within [cycle.start, cycle.end] inclusive. */
export function inCycle(dateStr: string, cycle: Cycle): boolean {
  return dateStr >= cycle.start && dateStr <= cycle.end;
}
