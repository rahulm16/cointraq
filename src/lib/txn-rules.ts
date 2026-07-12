import type { AccountType, TransactionType } from "./types";

/**
 * On the Spend form the user never picks a type: choosing a credit-card method
 * yields `cc_spend`, any other method yields `expense`. Re-derived on edit if the
 * method crosses the CC boundary.  SPEC §4 rule 1.
 */
export function deriveSpendType(methodAccountType: AccountType): "expense" | "cc_spend" {
  return methodAccountType === "credit_card" ? "cc_spend" : "expense";
}

/** category_id is allowed only on expense and cc_spend.  SPEC §4 rule 3. */
export function categoryAllowed(type: TransactionType): boolean {
  return type === "expense" || type === "cc_spend";
}

/** A method is a credit-card method when its linked account is a credit_card. */
export function isCreditCardMethod(methodAccountType: AccountType): boolean {
  return methodAccountType === "credit_card";
}
