import { describe, it, expect } from "vitest";
import { parseSearch, isEmptyQuery, matchesNames, describeQuery } from "./search";

describe("parseSearch", () => {
  it("treats plain text as a title match", () => {
    expect(parseSearch("chai")).toEqual({ text: "chai", amount: null, min: null, max: null });
  });

  it("matches a bare number as an amount and as text", () => {
    const p = parseSearch("240");
    expect(p.amount).toBe(240);
    expect(p.text).toBe("240"); // "2024" in a title should still be findable
  });

  it("parses greater-than comparisons exclusively", () => {
    expect(parseSearch(">1000")).toMatchObject({ min: 1001, max: null });
    expect(parseSearch(">=1000")).toMatchObject({ min: 1000 });
  });

  it("parses less-than comparisons exclusively", () => {
    expect(parseSearch("<500")).toMatchObject({ max: 499, min: null });
    expect(parseSearch("<=500")).toMatchObject({ max: 500 });
  });

  it("parses a range and normalises the order", () => {
    expect(parseSearch("100-500")).toMatchObject({ min: 100, max: 500 });
    expect(parseSearch("500-100")).toMatchObject({ min: 100, max: 500 });
  });

  it("ignores rupee signs and grouping commas", () => {
    expect(parseSearch("₹1,000")).toMatchObject({ amount: 1000 });
    expect(parseSearch(">₹1,500")).toMatchObject({ min: 1501 });
  });

  it("returns an empty query for blank input", () => {
    expect(isEmptyQuery(parseSearch(""))).toBe(true);
    expect(isEmptyQuery(parseSearch("   "))).toBe(true);
    expect(isEmptyQuery(parseSearch(undefined))).toBe(true);
  });

  it("does not treat a non-empty query as empty", () => {
    expect(isEmptyQuery(parseSearch("chai"))).toBe(false);
    expect(isEmptyQuery(parseSearch(">100"))).toBe(false);
  });

  it("falls back to text for mixed input", () => {
    expect(parseSearch("uber 240")).toMatchObject({ text: "uber 240", amount: null });
  });
});

describe("matchesNames", () => {
  it("matches a category or method name case-insensitively", () => {
    const p = parseSearch("gpay");
    expect(matchesNames(p, { method: "GPay" })).toBe(true);
    expect(matchesNames(p, { category: "Food" })).toBe(false);
  });

  it("never matches when the query has no text part", () => {
    expect(matchesNames(parseSearch(">100"), { method: "GPay" })).toBe(false);
  });
});

describe("describeQuery", () => {
  it("describes each query shape", () => {
    expect(describeQuery(parseSearch("chai"))).toBe('"chai"');
    expect(describeQuery(parseSearch(">1000"))).toBe("over ₹1000");
    expect(describeQuery(parseSearch("<500"))).toBe("under ₹500");
    expect(describeQuery(parseSearch("100-500"))).toBe("₹100–₹500");
    expect(describeQuery(parseSearch(""))).toBeNull();
  });
});
