import { describe, expect, it } from "vitest";
import { accountInputSchema } from "./validation";

const input = { name: "Account", billingDay: null, icon: null };

describe("account balance validation", () => {
  it("allows an overdrawn bank", () => {
    expect(accountInputSchema.safeParse({ ...input, type: "bank", openingBalance: -500 }).success).toBe(true);
  });

  it("allows a credit card in credit", () => {
    expect(accountInputSchema.safeParse({ ...input, type: "credit_card", openingBalance: -500 }).success).toBe(true);
  });

  it("rejects negative physical cash", () => {
    const result = accountInputSchema.safeParse({ ...input, type: "cash", openingBalance: -500 });
    expect(result.success).toBe(false);
  });
});
