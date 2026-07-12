"use client";

import type { Account, Category, PaymentMethod, Transaction } from "@/lib/types";
import { Avatar } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { amountSign, TYPE_LABEL, INCOME_SOURCE_LABEL } from "@/lib/txn-display";
import { categoryClasses, cn } from "@/lib/ui";
import { Pencil, Trash2 } from "lucide-react";

/**
 * One transaction row. Tap opens the edit sheet. On desktop hover, quick edit /
 * delete icon buttons fade-slide in from the right (§6); they're absent on touch.
 */
export function TxnRow({
  txn,
  accounts,
  methods,
  categories,
  onClick,
  onDelete,
}: {
  txn: Transaction;
  accounts: Account[];
  methods: PaymentMethod[];
  categories: Category[];
  onClick?: () => void;
  onDelete?: () => void;
}) {
  const method = methods.find((m) => m.id === txn.methodId);
  const category = categories.find((c) => c.id === txn.categoryId);
  const from = accounts.find((a) => a.id === txn.fromAccountId);
  const to = accounts.find((a) => a.id === txn.toAccountId);
  const sign = amountSign(txn.type);

  const title =
    txn.note ||
    (txn.type === "transfer"
      ? `${from?.name ?? "?"} → ${to?.name ?? "?"}`
      : txn.type === "withdrawal"
        ? `Withdrawal → ${to?.name ?? "Cash"}`
        : txn.type === "income"
          ? INCOME_SOURCE_LABEL[txn.incomeSource ?? "other"] ?? "Income"
          : txn.type === "bill_pay"
            ? `Bill · ${to?.name ?? "card"}`
            : method?.name ?? TYPE_LABEL[txn.type]);

  const subtitleParts: string[] = [];
  if (method) subtitleParts.push(method.name);
  if (txn.type === "cc_spend") subtitleParts.push("card ledger");
  if (txn.type === "income" && txn.incomeSource) subtitleParts.push(INCOME_SOURCE_LABEL[txn.incomeSource]);

  return (
    <div className="group relative flex items-center gap-3 py-3 -mx-1 px-1 rounded-inner transition-colors hover:bg-surface-raised/50">
      {/* Full-row click target sits behind the hover actions. */}
      <button onClick={onClick} aria-label={`Edit ${title}`} className="absolute inset-0 rounded-inner" />

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
            onClick={onClick}
            aria-label="Edit"
            className="icon-btn w-8 h-8 rounded-full flex items-center justify-center text-text-secondary"
          >
            <Pencil size={15} strokeWidth={1.75} />
          </button>
          <button
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
}
