import type { TransactionType } from "./types";

export const TYPE_LABEL: Record<TransactionType, string> = {
  expense: "Spend",
  cc_spend: "Card spend",
  bill_pay: "Bill payment",
  transfer: "Transfer",
  withdrawal: "Withdrawal",
  income: "Income",
};

export type FormKind = "spend" | "bill_pay" | "transfer" | "withdrawal" | "income";

export type TitlesByKind = Record<FormKind, string[]>;

/** Map a stored type back to the add/edit form kind (tab). */
export function formKindForType(type: TransactionType): FormKind {
  switch (type) {
    case "expense":
    case "cc_spend":
      return "spend";
    case "bill_pay":
      return "bill_pay";
    case "transfer":
      return "transfer";
    case "withdrawal":
      return "withdrawal";
    case "income":
      return "income";
  }
}

/** Sign shown next to an amount in the list (income is +, spends are −, moves are neutral). */
export function amountSign(type: TransactionType): "plus" | "minus" | "neutral" {
  if (type === "income") return "plus";
  if (type === "expense" || type === "bill_pay" || type === "cc_spend") return "minus";
  return "neutral"; // transfer, withdrawal move money without being a spend
}

export const INCOME_SOURCE_LABEL: Record<string, string> = {
  salary: "Salary",
  refund: "Refund",
  cashback: "Cashback",
  other: "Other",
};
