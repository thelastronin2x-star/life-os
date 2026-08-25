import { describe, expect, it } from "vitest";
import { expandRecurringEvents, describeRecurrence, describeRecurrenceShort } from "./recurrence";
import type { CalendarItem, EventRecurrence } from "./calendar-store";

function makeItem(date: string, recurrence: EventRecurrence | null): CalendarItem {
  return {
    id: "1",
    date,
    kind: "event",
    title: "Test",
    time: "10:00",
    category: "personal",
    reminder: "none",
    recurrence,
  };
}

function monthly(overrides: Partial<EventRecurrence> = {}): EventRecurrence {
  return { type: "monthly", daysOfWeek: [], endCondition: { type: "never" }, excludedDates: [], ...overrides };
}

describe("expandRecurringEvents — monthly", () => {
  it("repeats on the same day of month, within range", () => {
    const item = makeItem("2026-01-15", monthly());
    const occurrences = expandRecurringEvents(item, new Date(2026, 0, 1), new Date(2026, 3, 30));
    expect(occurrences.map((o) => o.date)).toEqual(["2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15"]);
  });

  it("clamps to the last day of a shorter month for a 31st anchor", () => {
    const item = makeItem("2026-01-31", monthly());
    const occurrences = expandRecurringEvents(item, new Date(2026, 0, 1), new Date(2026, 1, 28));
    // February 2026 has 28 days — the 31st clamps down, doesn't skip or overflow.
    expect(occurrences.map((o) => o.date)).toEqual(["2026-01-31", "2026-02-28"]);
  });

  it("stops at an 'until' end date", () => {
    const item = makeItem("2026-01-15", monthly({ endCondition: { type: "until", value: "2026-02-20" } }));
    const occurrences = expandRecurringEvents(item, new Date(2026, 0, 1), new Date(2026, 3, 30));
    expect(occurrences.map((o) => o.date)).toEqual(["2026-01-15", "2026-02-15"]);
  });

  it("stops after a fixed occurrence count", () => {
    const item = makeItem("2026-01-15", monthly({ endCondition: { type: "count", value: 2 } }));
    const occurrences = expandRecurringEvents(item, new Date(2026, 0, 1), new Date(2026, 11, 31));
    expect(occurrences.map((o) => o.date)).toEqual(["2026-01-15", "2026-02-15"]);
  });

  it("skips an excluded occurrence date", () => {
    const item = makeItem("2026-01-15", monthly({ excludedDates: ["2026-02-15"] }));
    const occurrences = expandRecurringEvents(item, new Date(2026, 0, 1), new Date(2026, 2, 31));
    expect(occurrences.map((o) => o.date)).toEqual(["2026-01-15", "2026-03-15"]);
  });
});

describe("describeRecurrence / describeRecurrenceShort — monthly", () => {
  it("describes a monthly recurrence", () => {
    expect(describeRecurrence(monthly())).toBe("Щомісяця в це число");
    expect(describeRecurrenceShort(monthly())).toBe("Щомісяця");
  });
});
