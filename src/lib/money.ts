import { AMOUNT_MAX, AMOUNT_MIN } from "./constants";

const inr = new Intl.NumberFormat("en-IN");

/**
 * The only money formatter in the app. Whole rupees, Indian grouping.
 * formatINR(124560) => "₹1,24,560"
 */
export function formatINR(n: number): string {
  return "₹" + inr.format(Math.trunc(n));
}

/** Grouped digits without the rupee sign, e.g. "1,24,560". */
export function groupINR(n: number): string {
  return inr.format(Math.trunc(n));
}

/** True when a value is a valid stored amount: positive integer within bounds. */
export function isValidAmount(n: number): boolean {
  return Number.isInteger(n) && n >= AMOUNT_MIN && n <= AMOUNT_MAX;
}
