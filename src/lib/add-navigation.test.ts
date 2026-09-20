// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { consumeAddReturnPath, rememberAddReturnPath } from "./add-navigation";

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, "", "/transactions?type=expense");
});

describe("Add return navigation", () => {
  it("preserves the exact in-app page and consumes it once", () => {
    rememberAddReturnPath();
    expect(consumeAddReturnPath()).toBe("/transactions?type=expense");
    expect(consumeAddReturnPath()).toBe("/");
  });

  it("falls back to the dashboard for a direct Add visit", () => {
    window.history.replaceState({}, "", "/add");
    rememberAddReturnPath();
    expect(consumeAddReturnPath()).toBe("/");
  });
});
