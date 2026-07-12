"use client";

import NumberFlow from "@number-flow/react";
import { cn } from "@/lib/ui";

/**
 * Animated rupee amount (§5): digits roll when the value changes. Matches
 * formatINR exactly — en-IN lakh/crore grouping, whole rupees, ₹ prefix.
 */
export function INRFlow({ value, className }: { value: number; className?: string }) {
  return (
    <NumberFlow
      value={value}
      locales="en-IN"
      format={{ maximumFractionDigits: 0 }}
      prefix="₹"
      className={cn("tnum", className)}
    />
  );
}
