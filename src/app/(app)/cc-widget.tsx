import type { DashboardData } from "@/lib/dashboard";
import { Card, StatusBadge } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { formatDayShort, parseDate, todayIST } from "@/lib/dates";
import { categoryClasses } from "@/lib/ui";
import { CreditCard } from "lucide-react";
import { INRFlow } from "@/components/inr-flow";
import { CycleProgress } from "@/components/cycle-progress";
import { differenceInCalendarDays } from "date-fns";

export function CcWidget({ card }: { card: DashboardData["cards"][number] }) {
  const { account, statement, cycleBreakdown } = card;
  const badge =
    statement.paidStatus === "paid" ? (
      <StatusBadge tone="income">Paid</StatusBadge>
    ) : statement.paidStatus === "partial" ? (
      <StatusBadge tone="warning">Partial</StatusBadge>
    ) : (
      <StatusBadge tone="warning">Unpaid</StatusBadge>
    );

  // How far through the current cycle we are (drives the progress bar).
  const total = differenceInCalendarDays(
    parseDate(statement.currentCycle.end),
    parseDate(statement.currentCycle.start),
  );
  const elapsed = differenceInCalendarDays(parseDate(todayIST()), parseDate(statement.currentCycle.start));
  const fraction = total > 0 ? elapsed / total : 0;

  return (
    <Card lift>
      <div className="flex items-center gap-2 text-[14px] font-semibold text-text-primary">
        <CreditCard size={16} strokeWidth={1.5} className="text-text-secondary" aria-hidden />
        {account.name}
      </div>
      <div className="text-[12px] text-text-faint mt-1">
        <span className="tnum">
          {formatDayShort(statement.currentCycle.start)} – {formatDayShort(statement.currentCycle.end)}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mt-3">
        <span className="text-[28px] text-text-primary">
          <INRFlow value={statement.unbilled} />
        </span>
        <span className="text-[12px] text-text-secondary">unbilled</span>
      </div>

      <div className="mt-3.5">
        <CycleProgress fraction={fraction} />
      </div>

      <div className="flex items-center gap-2 mt-3.5 text-[13px] text-text-secondary flex-wrap">
        Last bill{" "}
        <span className="font-medium text-text-primary">
          <INRFlow value={statement.lastStatement} />
        </span>
        {badge}
        {statement.paidStatus === "partial" && (
          <span className="text-[12px] text-warning">{formatINR(statement.remaining)} left</span>
        )}
      </div>

      {cycleBreakdown.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-1.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-text-faint">
            This cycle
          </div>
          {cycleBreakdown.slice(0, 5).map((b) => (
            <div key={b.name} className="flex items-center gap-2 text-[12.5px]">
              <span className={`px-2 py-[2px] rounded-full text-[10.5px] font-medium ${categoryClasses(b.color).pill}`}>
                {b.name}
              </span>
              <span className="ml-auto tnum text-text-primary">{formatINR(b.total)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
