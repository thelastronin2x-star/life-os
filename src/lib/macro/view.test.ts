import { describe, expect, it } from "vitest";
import { filterByCurrency, formatUpcomingTime } from "./view";
import type { MacroEvent } from "./types";

function makeEvent(overrides: Partial<MacroEvent>): MacroEvent {
  return {
    id: crypto.randomUUID(),
    region: "US",
    currency: "USD",
    title: "Event",
    importance: "medium",
    scheduledAt: new Date().toISOString(),
    affectedMarkets: ["indices"],
    provider: "businessquant",
    ...overrides,
  };
}

describe("filterByCurrency", () => {
  const usd = makeEvent({ id: "u", currency: "USD" });
  const eur = makeEvent({ id: "e", currency: "EUR" });

  it("returns everything for 'all'", () => {
    expect(filterByCurrency([usd, eur], "all")).toHaveLength(2);
  });

  it("filters to the requested currency", () => {
    expect(filterByCurrency([usd, eur], "EUR").map((e) => e.id)).toEqual(["e"]);
  });
});

describe("formatUpcomingTime", () => {
  const now = new Date("2026-06-15T12:00:00.000Z").getTime();

  it("shows 'сьогодні' for later the same day", () => {
    expect(formatUpcomingTime("2026-06-15T18:00:00.000Z", now)).toBe("сьогодні");
  });

  it("shows 'завтра' for the next day", () => {
    expect(formatUpcomingTime("2026-06-16T09:00:00.000Z", now)).toBe("завтра");
  });

  it("shows 'за N дн.' within a week", () => {
    expect(formatUpcomingTime("2026-06-20T09:00:00.000Z", now)).toBe("за 5 дн.");
  });

  it("falls back to a plain date beyond a week", () => {
    expect(formatUpcomingTime("2026-07-01T09:00:00.000Z", now)).toBe("1 лип.");
  });

  it("shows 'минуло' for a date in the past", () => {
    expect(formatUpcomingTime("2026-06-10T09:00:00.000Z", now)).toBe("минуло");
  });
});
