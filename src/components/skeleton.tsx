import { cn } from "@/lib/ui";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-inner bg-surface-raised", className)} />;
}
