import { describe, it, expect } from "vitest";
import {
  clampDayOfMonth,
  occurrenceInMonth,
  nextWeeklyOn,
  currentOccurrence,
  dueItem,
  dueNow,
  describeSchedule,
} from "./recurring";
import type { RecurringTemplate } from "./types";

function tpl(p: Partial<RecurringTemplate> = {}): RecurringTemplate {
  return {
    id: 1,
    title: "Rent",
    type: "expense",
    amount: 25000,
    categoryId: null,
    methodId: null,
    fromAccountId: null,
    toAccountId: null,
    incomeSource: null,
    recurrence: "monthly",
    dayOfMonth: 5,
    dayOfWeek: null,
    monthOfYear: null,
    lastLoggedDate: null,
    isArchived: false,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...p,
  };
}

describe("clampDayOfMonth", () => {
  it("clamps day 31 into a short month", () => {
    expect(clampDayOfMonth("2026-02", 31)).toBe("2026-02-28");
    expect(clampDayOfMonth("2026-04", 31)).toBe("2026-04-30");
  });

  it("handles a leap February", () => {
    expect(clampDayOfMonth("2028-02", 31)).toBe("2028-02-29");
  });

  it("passes through a valid day", () => {
    expect(clampDayOfMonth("2026-07", 5)).toBe("2026-07-05");
  });

  it("floors out-of-range low days", () => {
    expect(clampDayOfMonth("2026-07", 0)).toBe("2026-07-01");
  });
});

describe("occurrenceInMonth", () => {
  it("returns the clamped day for monthly", () => {
    expect(occurrenceInMonth(tpl({ dayOfMonth: 15 }), "2026-07")).toBe("2026-07-15");
  });

  it("returns null for a yearly template outside its month", () => {
    const y = tpl({ recurrence: "yearly", monthOfYear: 4, dayOfMonth: 10 });
    expect(occurrenceInMonth(y, "2026-07")).toBeNull();
    expect(occurrenceInMonth(y, "2026-04")).toBe("2026-04-10");
  });
});

describe("nextWeeklyOn", () => {
  it("returns the same day when it already matches", () => {
    // 2026-07-06 is a Monday.
    expect(nextWeeklyOn("2026-07-06", 1)).toBe("2026-07-06");
  });

  it("advances to the next matching weekday", () => {
    expect(nextWeeklyOn("2026-07-06", 3)).toBe("2026-07-08"); // Wednesday
  });
});

describe("currentOccurrence", () => {
  it("points at this month's occurrence even after it has passed", () => {
    // Missed rent stays visible rather than rolling forward silently.
    expect(currentOccurrence(tpl({ dayOfMonth: 5 }), "2026-07-20")).toBe("2026-07-05");
  });

  it("advances to next month once logged", () => {
    const t = tpl({ dayOfMonth: 5, lastLoggedDate: "2026-07-05" });
    expect(currentOccurrence(t, "2026-07-20")).toBe("2026-08-05");
  });

  it("rolls a yearly template to next year once its date has passed", () => {
    const y = tpl({ recurrence: "yearly", monthOfYear: 4, dayOfMonth: 10 });
    expect(currentOccurrence(y, "2026-07-01")).toBe("2027-04-10");
  });

  it("points at this year's yearly occurrence when still ahead", () => {
    const y = tpl({ recurrence: "yearly", monthOfYear: 11, dayOfMonth: 10 });
    expect(currentOccurrence(y, "2026-07-01")).toBe("2026-11-10");
  });

  it("points weekly at this week's occurrence, then next week once logged", () => {
    const w = tpl({ recurrence: "weekly", dayOfWeek: 1, dayOfMonth: null });
    expect(currentOccurrence(w, "2026-07-08")).toBe("2026-07-06"); // Monday of that week
    const logged = { ...w, lastLoggedDate: "2026-07-06" };
    expect(currentOccurrence(logged, "2026-07-08")).toBe("2026-07-13");
  });
});

describe("dueItem", () => {
  it("marks an unlogged past occurrence overdue", () => {
    const d = dueItem(tpl({ dayOfMonth: 5 }), "2026-07-09")!;
    expect(d.state).toBe("overdue");
    expect(d.daysUntil).toBe(-4);
  });

  it("marks the occurrence date itself due", () => {
    expect(dueItem(tpl({ dayOfMonth: 5 }), "2026-07-05")!.state).toBe("due");
  });

  it("marks a near-future occurrence upcoming", () => {
    expect(dueItem(tpl({ dayOfMonth: 5 }), "2026-07-03")!.state).toBe("upcoming");
  });

  it("marks a far-future occurrence scheduled", () => {
    expect(dueItem(tpl({ dayOfMonth: 25 }), "2026-07-03")!.state).toBe("scheduled");
  });

  it("advances past a logged occurrence instead of re-offering it", () => {
    // Once this month is logged, the pointer moves to next month's occurrence —
    // which is far enough out to read as `scheduled`, so the row leaves the strip.
    const t = tpl({ dayOfMonth: 5, lastLoggedDate: "2026-08-05" });
    const d = dueItem(t, "2026-08-06")!;
    expect(d.dueDate).toBe("2026-09-05");
    expect(d.state).toBe("scheduled");
  });

  it("marks the next occurrence done when it too is already logged", () => {
    // Logging ahead (paying September's rent in August) shows as done, not due.
    const t = tpl({ dayOfMonth: 5, lastLoggedDate: "2026-09-05" });
    expect(dueItem(t, "2026-08-06")!.state).toBe("done");
  });
});

describe("dueNow", () => {
  it("surfaces only actionable items, most urgent first", () => {
    const items = dueNow(
      [
        tpl({ id: 1, title: "Far off", dayOfMonth: 28 }), // scheduled → dropped
        tpl({ id: 2, title: "Due today", dayOfMonth: 9 }),
        tpl({ id: 3, title: "Overdue", dayOfMonth: 2 }),
        tpl({ id: 4, title: "Archived", dayOfMonth: 2, isArchived: true }), // dropped
        tpl({ id: 5, title: "Upcoming", dayOfMonth: 11 }),
      ],
      "2026-07-09",
    );
    expect(items.map((i) => i.template.title)).toEqual(["Overdue", "Due today", "Upcoming"]);
  });

  it("drops templates already logged this period", () => {
    const t = tpl({ dayOfMonth: 5, lastLoggedDate: "2026-07-05" });
    expect(dueNow([t], "2026-07-09")).toHaveLength(0);
  });
});

describe("describeSchedule", () => {
  it("labels each recurrence kind", () => {
    expect(describeSchedule(tpl({ dayOfMonth: 1 }))).toBe("Monthly on the 1st");
    expect(describeSchedule(tpl({ dayOfMonth: 22 }))).toBe("Monthly on the 22nd");
    expect(describeSchedule(tpl({ recurrence: "weekly", dayOfWeek: 5 }))).toBe("Weekly on Friday");
    expect(describeSchedule(tpl({ recurrence: "yearly", dayOfMonth: 3, monthOfYear: 4 }))).toBe(
      "Yearly on 3rd April",
    );
  });
});
