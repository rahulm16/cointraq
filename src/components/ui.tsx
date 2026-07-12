import { cn, avatarColor, withAlpha } from "@/lib/ui";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-card p-[18px_20px]",
        "shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("text-[11px] font-semibold uppercase tracking-[0.07em] text-text-faint", className)}>
      {children}
    </div>
  );
}

export function Amount({ value, className }: { value: string; className?: string }) {
  return <span className={cn("tnum", className)}>{value}</span>;
}

/** Circular avatar: renders an uploaded icon, else a tinted monogram. SPEC §9. */
export function Avatar({
  icon,
  name,
  size = 30,
  className,
}: {
  icon?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  const hue = avatarColor(name || "?");
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full overflow-hidden flex-none font-semibold",
        className,
      )}
      style={
        icon
          ? { width: size, height: size, fontSize: Math.round(size * 0.4) }
          : {
              width: size,
              height: size,
              fontSize: Math.round(size * 0.42),
              background: withAlpha(hue, 0.16),
              color: hue,
              border: `1px solid ${withAlpha(hue, 0.28)}`,
            }
      }
    >
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" width={size} height={size} className="w-full h-full object-cover" />
      ) : (
        letter
      )}
    </span>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "income" | "warning" | "alert" | "faint";
  children: ReactNode;
}) {
  const tones = {
    income: "text-income bg-income/12",
    warning: "text-warning bg-warning/12",
    alert: "text-alert bg-alert/12",
    faint: "text-text-faint bg-text-faint/12",
  } as const;
  return (
    <span
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-[3px] rounded-full",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-16 px-6">
      <div className="w-12 h-12 rounded-full bg-surface-raised border border-border flex items-center justify-center text-text-faint">
        <Plus size={22} strokeWidth={1.5} />
      </div>
      <div className="text-[15px] font-semibold text-text-primary">{title}</div>
      {body && <div className="text-[13px] text-text-secondary max-w-xs">{body}</div>}
      {action}
    </div>
  );
}
