import { describe, it, expect } from "vitest";
import { formatINR, groupINR, isValidAmount } from "./money";

describe("formatINR — Indian grouping", () => {
  it("groups lakhs and crores", () => {
    expect(formatINR(124560)).toBe("₹1,24,560");
    expect(formatINR(0)).toBe("₹0");
    expect(formatINR(1000)).toBe("₹1,000");
    expect(formatINR(100000)).toBe("₹1,00,000");
    expect(formatINR(10000000)).toBe("₹1,00,00,000");
    expect(formatINR(9640)).toBe("₹9,640");
    expect(formatINR(42780)).toBe("₹42,780");
  });

  it("truncates any stray decimals (whole rupees only)", () => {
    expect(formatINR(1234.99)).toBe("₹1,234");
  });

  it("groupINR omits the symbol", () => {
    expect(groupINR(124560)).toBe("1,24,560");
  });
});

describe("isValidAmount", () => {
  it("accepts positive integers within bounds", () => {
    expect(isValidAmount(1)).toBe(true);
    expect(isValidAmount(100000000)).toBe(true);
  });
  it("rejects zero, negatives, decimals, and over-bound", () => {
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(-5)).toBe(false);
    expect(isValidAmount(10.5)).toBe(false);
    expect(isValidAmount(100000001)).toBe(false);
  });
});
