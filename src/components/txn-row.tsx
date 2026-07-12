"use client";

import type { Account, Category, PaymentMethod, Transaction } from "@/lib/types";
import { Avatar } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { amountSign, TYPE_LABEL, INCOME_SOURCE_LABEL } from "@/lib/txn-display";
import { categoryClasses } from "@/lib/ui";
import { cn } from "@/lib/ui";

/** One transaction row. Tapping opens the edit sheet (via onClick). */
export function TxnRow({
  txn,
  accounts,
  methods,
  categories,
  onClick,
}: {
  txn: Transaction;
  accounts: Account[];
  methods: PaymentMethod[];
  categories: Category[];
  onClick?: () => void;
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
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3 text-left hover:bg-surface-raised/40 -mx-1 px-1 rounded-lg transition-colors"
    >
      <Avatar icon={method?.icon} name={method?.name ?? title} size={36} />
      <div className="min-w-0 flex-1">
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
          "tnum text-[15px] font-medium flex-none",
          sign === "plus" ? "text-income" : sign === "minus" ? "text-text-primary" : "text-text-faint",
        )}
      >
        {sign === "plus" ? "+" : sign === "minus" ? "−" : ""}
        {formatINR(txn.amount)}
      </div>
    </button>
  );
}
