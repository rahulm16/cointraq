/**
 * Search query parsing for the transactions list.
 *
 * The box accepts more than a title substring: a bare number matches an exact
 * amount, and comparison syntax filters by range. Everything unrecognised falls
 * back to a title match, so plain text keeps working exactly as before.
 *
 *   chai          → title contains "chai"
 *   240           → amount = 240, or title contains "240"
 *   >1000         → amount > 1000
 *   <=500         → amount ≤ 500
 *   100-500       → amount between 100 and 500
 */

export interface ParsedQuery {
  /** Title substring to match (case-insensitive). */
  text: string | null;
  /** Exact amount — also matched loosely against the title. */
  amount: number | null;
  min: number | null;
  max: number | null;
}

const EMPTY: ParsedQuery = { text: null, amount: null, min: null, max: null };

export function parseSearch(raw: string | undefined | null): ParsedQuery {
  const q = (raw ?? "").trim();
  if (!q) return EMPTY;

  // Strip rupee signs and grouping commas before looking for numbers.
  const normalized = q.replace(/₹/g, "").replace(/,/g, "").trim();

  // Range: 100-500
  const range = /^(\d+)\s*-\s*(\d+)$/.exec(normalized);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return { ...EMPTY, min: Math.min(a, b), max: Math.max(a, b) };
  }

  // Comparison: >1000, >=1000, <500, <=500
  const cmp = /^(>=|<=|>|<)\s*(\d+)$/.exec(normalized);
  if (cmp) {
    const n = Number(cmp[2]);
    switch (cmp[1]) {
      case ">":
        return { ...EMPTY, min: n + 1 };
      case ">=":
        return { ...EMPTY, min: n };
      case "<":
        return { ...EMPTY, max: n - 1 };
      case "<=":
        return { ...EMPTY, max: n };
    }
  }

  // A bare number matches the amount, but keep the text match too — "2024" may
  // well be part of a title.
  if (/^\d+$/.test(normalized)) {
    return { ...EMPTY, amount: Number(normalized), text: q };
  }

  return { ...EMPTY, text: q };
}

/** True when the parsed query constrains nothing. */
export function isEmptyQuery(p: ParsedQuery): boolean {
  return p.text === null && p.amount === null && p.min === null && p.max === null;
}

/**
 * Client-side predicate used to widen results to category and method names,
 * which the SQL layer doesn't join against.
 */
export function matchesNames(
  p: ParsedQuery,
  names: { category?: string | null; method?: string | null },
): boolean {
  if (!p.text) return false;
  const q = p.text.toLowerCase();
  return (
    (names.category ?? "").toLowerCase().includes(q) ||
    (names.method ?? "").toLowerCase().includes(q)
  );
}

/** Human description of an active query, for the results summary line. */
export function describeQuery(p: ParsedQuery): string | null {
  if (p.min !== null && p.max !== null) return `₹${p.min}–₹${p.max}`;
  if (p.min !== null) return `over ₹${p.min - 1}`;
  if (p.max !== null) return `under ₹${p.max + 1}`;
  if (p.amount !== null) return `₹${p.amount} or "${p.text}"`;
  if (p.text) return `"${p.text}"`;
  return null;
}
