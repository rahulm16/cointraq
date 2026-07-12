"use client";

import type { Account, Category, PaymentMethod, Transaction } from "@/lib/types";
import { Avatar } from "@/components/ui";
import { SwipeRow } from "@/components/swipe-row";
import { formatINR } from "@/lib/money";
import { amountSign, INCOME_SOURCE_LABEL } from "@/lib/txn-display";
import { categoryClasses, cn } from "@/lib/ui";
import { Pencil, Trash2 } from "lucide-react";

/**
 * One transaction row. Tap opens the edit sheet. Desktop hover reveals edit /
 * delete icons; on touch, swipe right for edit and left for delete.
 */
export function TxnRow({
  txn,
  methods,
  categories,
  onClick,
  onDelete,
  className,
}: {
  txn: Transaction;
  accounts: Account[];
  methods: PaymentMethod[];
  categories: Category[];
  onClick?: () => void;
  onDelete?: () => void;
  className?: string;
}) {
  const method = methods.find((m) => m.id === txn.methodId);
  const category = categories.find((c) => c.id === txn.categoryId);
  const sign = amountSign(txn.type);

  const title = txn.title;

  const subtitleParts: string[] = [];
  if (method) subtitleParts.push(method.name);
  if (txn.type === "cc_spend") subtitleParts.push("card ledger");
  if (txn.type === "income" && txn.incomeSource) subtitleParts.push(INCOME_SOURCE_LABEL[txn.incomeSource]);

  const row = (
    <div className="group relative flex items-center gap-3 px-4 py-3 transition-colors can-hover:hover:bg-surface-raised/50">
      {/* Full-row click target sits behind the hover actions. */}
      {onClick && <button type="button" onClick={onClick} aria-label={`Edit ${title}`} className="absolute inset-0" />}

      <Avatar icon={method?.icon} name={method?.name ?? title} size={36} />
      <div className="min-w-0 flex-1 pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-text-primary truncate">{title}</span>
          {category && (
            <span className={cn("text-[10.5px] font-medium px-2 py-[2px] rounded-full", categoryClasses(category.color).pill)}>
              {category.name}
            </span>
          )}
        </div>
        {subtitleParts.length > 0 && (
          <div className="text-[12px] text-text-secondary truncate">{subtitleParts.join(" · ")}</div>
        )}
      </div>

      <div
        className={cn(
          "tnum text-[15px] font-medium flex-none pointer-events-none transition-transform",
          sign === "plus" ? "text-income" : sign === "minus" ? "text-text-primary" : "text-text-faint",
          // Slide the amount left on hover to make room for the actions (desktop).
          onDelete && "can-hover:group-hover:-translate-x-16",
        )}
      >
        {sign === "plus" ? "+" : sign === "minus" ? "−" : ""}
        {formatINR(txn.amount)}
      </div>

      {onDelete && (
        <div className="hidden can-hover:flex absolute right-1 items-center gap-1 opacity-0 translate-x-2 pointer-events-none transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto">
          <button
            type="button"
            onClick={onClick}
            aria-label="Edit"
            className="icon-btn w-8 h-8 rounded-full flex items-center justify-center text-text-secondary"
          >
            <Pencil size={15} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete"
            className="icon-btn w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:!text-alert"
          >
            <Trash2 size={15} strokeWidth={1.75} />
          </button>
        </div>
      )}
    </div>
  );

  if (!onClick && !onDelete) {
    return <div className={cn("border-b border-border", className)}>{row}</div>;
  }

  return (
    <SwipeRow
      className={cn("border-b border-border", className)}
      leftAction={
        onClick
          ? {
              label: "Edit",
              onClick,
              className: "bg-primary",
              icon: <Pencil size={16} strokeWidth={1.75} />,
            }
          : undefined
      }
      rightAction={
        onDelete
          ? {
              label: "Delete",
              onClick: onDelete,
              className: "bg-alert",
              icon: <Trash2 size={16} strokeWidth={1.75} />,
            }
          : undefined
      }
    >
      {row}
    </SwipeRow>
  );
}
