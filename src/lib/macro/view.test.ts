import { describe, expect, it } from "vitest";
import { filterByCurrency, formatUpcomingTime, groupByWeek } from "./view";
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

describe("groupByWeek", () => {
  // 2026-06-15 is a Monday (Kyiv time, EEST/UTC+3 in June).
  const now = new Date("2026-06-15T09:00:00.000Z");

  it("labels today and tomorrow, and weekday names for the rest", () => {
    const today = makeEvent({ id: "today", scheduledAt: "2026-06-15T10:00:00.000Z" });
    const tomorrow = makeEvent({ id: "tomorrow", scheduledAt: "2026-06-16T10:00:00.000Z" });
    const wednesday = makeEvent({ id: "wed", scheduledAt: "2026-06-17T10:00:00.000Z" });

    const groups = groupByWeek([today, tomorrow, wednesday], now);
    expect(groups.map((g) => g.label)).toEqual(["Сьогодні", "Завтра", "Середа"]);
    expect(groups[0].events.map((e) => e.id)).toEqual(["today"]);
  });

  it("omits days with no events", () => {
    const monday = makeEvent({ id: "mon", scheduledAt: "2026-06-15T10:00:00.000Z" });
    const friday = makeEvent({ id: "fri", scheduledAt: "2026-06-19T10:00:00.000Z" });

    const groups = groupByWeek([monday, friday], now);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.dateKey)).toEqual(["2026-06-15", "2026-06-19"]);
  });

  it("drops events outside the requested day window", () => {
    const nextWeek = makeEvent({ id: "next-week", scheduledAt: "2026-06-25T10:00:00.000Z" });
    expect(groupByWeek([nextWeek], now)).toHaveLength(0);
  });

  it("groups multiple events on the same day together", () => {
    const a = makeEvent({ id: "a", scheduledAt: "2026-06-15T08:00:00.000Z" });
    const b = makeEvent({ id: "b", scheduledAt: "2026-06-15T20:00:00.000Z" });
    const groups = groupByWeek([a, b], now);
    expect(groups).toHaveLength(1);
    expect(groups[0].events.map((e) => e.id)).toEqual(["a", "b"]);
  });
});
