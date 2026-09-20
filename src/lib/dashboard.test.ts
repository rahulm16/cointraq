import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDashboard } from "./dashboard";
import type { Account } from "./types";

const createdAt = new Date("2026-01-01T00:00:00Z");
const card = (id: number, openingBalance: number): Account => ({
  id,
  name: `Card ${id}`,
  type: "credit_card",
  openingBalance,
  billingDay: 17,
  icon: null,
  isArchived: true,
  sortOrder: id,
  createdAt,
});

afterEach(() => vi.useRealTimers());

describe("archived dashboard cards", () => {
  it("keeps an archived card visible until its complete outstanding is zero", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T06:00:00Z"));

    const result = buildDashboard({
      from: "2026-09-01",
      to: "2026-09-30",
      accounts: [card(1, 500), card(2, 0)],
      methods: [],
      categories: [],
      effects: [],
      snapshots: [],
      recent: [],
    });

    expect(result.cards.map((entry) => entry.account.id)).toEqual([1]);
  });
});
