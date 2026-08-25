import { describe, expect, it } from "vitest";
import { periodForHour, parseEventText, formatDateKey } from "./calendar-utils";

describe("periodForHour", () => {
  it("buckets 5-11 as morning, 12-17 as day, 18-23 as evening", () => {
    expect(periodForHour(6).key).toBe("morning");
    expect(periodForHour(14).key).toBe("day");
    expect(periodForHour(20).key).toBe("evening");
  });

  it("falls back to evening for the 0-4 deep-night hours, not a fourth bucket", () => {
    expect(periodForHour(2).key).toBe("evening");
    expect(periodForHour(0).key).toBe("evening");
  });
});

describe("parseEventText", () => {
  // Wednesday, 2026-01-14, so weekday-name math has a known reference point.
  const now = new Date(2026, 0, 14, 9, 0, 0);

  it("recognizes 'завтра' and a clock time, stripping both from the title", () => {
    const result = parseEventText("Дзвінок з клієнтом завтра о 15:00", now);
    expect(result.date).toBe("2026-01-15");
    expect(result.time).toBe("15:00");
    expect(result.title).toBe("Дзвінок з клієнтом");
  });

  it("recognizes 'сьогодні'", () => {
    const result = parseEventText("Забрати посилку сьогодні", now);
    expect(result.date).toBe(formatDateKey(now));
    expect(result.title).toBe("Забрати посилку");
  });

  it("recognizes 'післязавтра'", () => {
    const result = parseEventText("Здати звіт післязавтра", now);
    expect(result.date).toBe("2026-01-16");
  });

  it("recognizes an hour-only time ('о 9')", () => {
    const result = parseEventText("Зустріч о 9", now);
    expect(result.time).toBe("09:00");
  });

  it("recognizes a bare HH:MM time with no leading 'о'", () => {
    const result = parseEventText("Зал 18:30", now);
    expect(result.time).toBe("18:30");
  });

  it("recognizes a weekday name in a common grammatical case, choosing the next occurrence", () => {
    // now is a Wednesday — "у п'ятницю" should land two days later.
    const result = parseEventText("Здати проєкт у п'ятницю", now);
    expect(result.date).toBe("2026-01-16");
  });

  it("resolves a weekday name matching today's own weekday to today, not next week", () => {
    // now is itself a Wednesday.
    const result = parseEventText("Здати проєкт у середу", now);
    expect(result.date).toBe(formatDateKey(now));
  });

  it("falls back to the full trimmed text as the title when nothing is recognized", () => {
    const result = parseEventText("Купити молоко", now);
    expect(result.date).toBeNull();
    expect(result.time).toBeNull();
    expect(result.title).toBe("Купити молоко");
  });
});
