import { describe, expect, it } from "vitest";
import { migrateReminderFields } from "./calendar-store";
import type { CalendarItem } from "./calendar-store";

function legacyItem(overrides: Record<string, unknown>): Omit<CalendarItem, "reminder"> & Record<string, unknown> {
  return {
    id: "1",
    date: "2026-01-01",
    kind: "event",
    title: "Test",
    category: "personal",
    recurrence: null,
    ...overrides,
  } as Omit<CalendarItem, "reminder"> & Record<string, unknown>;
}

describe("migrateReminderFields", () => {
  it("maps a 5-minute-before event reminder to the closer new option (10хв)", () => {
    const [migrated] = migrateReminderFields([legacyItem({ reminder5: true, reminder30: false })]);
    expect(migrated.reminder).toBe("10min");
  });

  it("maps a 30-minute-before event reminder up to the next option (1год), not down", () => {
    const [migrated] = migrateReminderFields([legacyItem({ reminder5: false, reminder30: true })]);
    expect(migrated.reminder).toBe("1hour");
  });

  it("prefers the finer reminder when both were set", () => {
    const [migrated] = migrateReminderFields([legacyItem({ reminder5: true, reminder30: true })]);
    expect(migrated.reminder).toBe("10min");
  });

  it("maps a note's day-before flag straight across", () => {
    const [migrated] = migrateReminderFields([legacyItem({ kind: "note", reminderDayBefore: true })]);
    expect(migrated.reminder).toBe("day");
  });

  it("maps nothing set to none, not a guessed default", () => {
    const [migrated] = migrateReminderFields([legacyItem({ reminder5: false, reminder30: false })]);
    expect(migrated.reminder).toBe("none");
  });

  it("is idempotent — an item that already has `reminder` set passes through unchanged", () => {
    const already = { ...legacyItem({}), reminder: "day" };
    const [migrated] = migrateReminderFields([already as never]);
    expect(migrated.reminder).toBe("day");
  });
});
