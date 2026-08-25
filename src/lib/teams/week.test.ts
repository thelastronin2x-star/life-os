import { describe, expect, it } from "vitest";
import { startOfWeekUtc } from "./week";

describe("startOfWeekUtc", () => {
  it("returns the same Monday for any day within that week", () => {
    // 2026-01-14 is a Wednesday (Kyiv); 2026-01-19 is the following Monday.
    const wednesday = new Date("2026-01-14T10:00:00Z");
    const saturday = new Date("2026-01-17T23:00:00Z");
    expect(startOfWeekUtc(wednesday).toISOString()).toBe(startOfWeekUtc(saturday).toISOString());
  });

  it("resolves to Monday 00:00 Kyiv time (UTC-2 in January, EET)", () => {
    const wednesday = new Date("2026-01-14T10:00:00Z");
    // Monday 2026-01-12 00:00 EET = 2026-01-11T22:00:00Z
    expect(startOfWeekUtc(wednesday).toISOString()).toBe("2026-01-11T22:00:00.000Z");
  });

  it("rolls back into the previous month/year when needed", () => {
    // 2026-01-01 is a Thursday — the Monday of that week is 2025-12-29.
    const thursday = new Date("2026-01-01T12:00:00Z");
    expect(startOfWeekUtc(thursday).toISOString()).toBe("2025-12-28T22:00:00.000Z");
  });

  it("treats Monday itself as the start of its own week", () => {
    const monday = new Date("2026-01-19T05:00:00Z");
    expect(startOfWeekUtc(monday).toISOString()).toBe("2026-01-18T22:00:00.000Z");
  });
});
