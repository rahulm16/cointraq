import { describe, it, expect } from "vitest";
import { cycleContaining, previousCycle, inCycle } from "./cycle";

describe("cycleContaining — billing day 17 (seed)", () => {
  it("date on or before D lands in the cycle ending this month", () => {
    // 10 Jul, D=17 => 18 Jun – 17 Jul
    expect(cycleContaining("2026-07-10", 17)).toEqual({
      start: "2026-06-18",
      end: "2026-07-17",
    });
  });

  it("date after D lands in the cycle ending next month", () => {
    // 20 Jul, D=17 => 18 Jul – 17 Aug
    expect(cycleContaining("2026-07-20", 17)).toEqual({
      start: "2026-07-18",
      end: "2026-08-17",
    });
  });

  it("exactly on D is the last day of that cycle", () => {
    expect(cycleContaining("2026-07-17", 17)).toEqual({
      start: "2026-06-18",
      end: "2026-07-17",
    });
  });
});

describe("cycleContaining — clamping for short months", () => {
  it("D=31: February clamps end to 28 (non-leap 2026)", () => {
    // Date in Feb 2026, D=31 => cycle ends on Feb's last day (28). Previous
    // clamped day is Jan 31, so start = the day after = Feb 1.
    expect(cycleContaining("2026-02-10", 31)).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("D=31: leap February clamps to 29 (2028)", () => {
    expect(cycleContaining("2028-02-15", 31)).toEqual({
      start: "2028-02-01",
      end: "2028-02-29",
    });
  });

  it("D=31: a normal 31-day month keeps 31", () => {
    // 15 Jul 2026 (Jul has 31), D=31 => 01 Jul – 31 Jul
    expect(cycleContaining("2026-07-15", 31)).toEqual({
      start: "2026-07-01",
      end: "2026-07-31",
    });
  });

  it("D=31: date after clamped end rolls to next cycle", () => {
    // 30 Apr 2026 (Apr has 30, clamp=30), day 30 <= 30 so ends 30 Apr
    expect(cycleContaining("2026-04-30", 31)).toEqual({
      start: "2026-04-01",
      end: "2026-04-30",
    });
  });
});

describe("previousCycle", () => {
  it("returns the cycle immediately before the current one", () => {
    // current for 10 Jul, D=17 is 18 Jun–17 Jul; previous is 18 May–17 Jun
    expect(previousCycle("2026-07-10", 17)).toEqual({
      start: "2026-05-18",
      end: "2026-06-17",
    });
  });
});

describe("inCycle", () => {
  const c = { start: "2026-06-18", end: "2026-07-17" };
  it("includes boundaries", () => {
    expect(inCycle("2026-06-18", c)).toBe(true);
    expect(inCycle("2026-07-17", c)).toBe(true);
  });
  it("excludes outside", () => {
    expect(inCycle("2026-06-17", c)).toBe(false);
    expect(inCycle("2026-07-18", c)).toBe(false);
  });
});
