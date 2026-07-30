import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { periodStartKey, startOfWeek } from "./finance-periods";

describe("startOfWeek", () => {
  it("returns the same date when given a Monday", () => {
    const monday = new Date(2026, 6, 27); // 2026-07-27 is a Monday
    expect(startOfWeek(monday).getDate()).toBe(27);
  });

  it("rolls back to Monday when given a Sunday", () => {
    const sunday = new Date(2026, 7, 2); // 2026-08-02 is a Sunday
    const result = startOfWeek(sunday);
    expect(result.getMonth()).toBe(6);
    expect(result.getDate()).toBe(27);
  });
});

describe("periodStartKey", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns Monday of the current week for Тиждень", () => {
    vi.setSystemTime(new Date(2026, 6, 29)); // Wednesday
    expect(periodStartKey("Тиждень")).toBe("2026-07-27");
  });

  it("returns the 1st of the current month for Місяць, not a trailing 30 days", () => {
    vi.setSystemTime(new Date(2026, 6, 29));
    expect(periodStartKey("Місяць")).toBe("2026-07-01");
  });

  it("returns exactly one year back for Рік", () => {
    vi.setSystemTime(new Date(2026, 6, 29));
    expect(periodStartKey("Рік")).toBe("2025-07-29");
  });
});
