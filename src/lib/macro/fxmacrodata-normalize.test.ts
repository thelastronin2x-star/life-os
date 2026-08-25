import { describe, expect, it } from "vitest";
import { normalizeFxMacroDataEvent, mostRecentAnnouncementValue } from "./fxmacrodata-normalize";

describe("mostRecentAnnouncementValue", () => {
  const rows = [
    { announcement_datetime: 1000, val: 1.1 },
    { announcement_datetime: 3000, val: 1.3 },
    { announcement_datetime: 2000, val: 1.2 },
  ];

  it("finds the most recent value at or before the cutoff, regardless of array order", () => {
    expect(mostRecentAnnouncementValue(rows, 2500)).toBe(1.2);
  });

  it("includes a row exactly at the cutoff", () => {
    expect(mostRecentAnnouncementValue(rows, 2000)).toBe(1.2);
  });

  it("returns null when nothing is at or before the cutoff", () => {
    expect(mostRecentAnnouncementValue(rows, 500)).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(mostRecentAnnouncementValue([], 5000)).toBeNull();
  });
});

describe("normalizeFxMacroDataEvent", () => {
  const baseParams = {
    currency: "EUR" as const,
    region: "EU" as const,
    calendarRow: { announcement_datetime: 1798761600, release: "inflation" },
    catalogueEntry: { name: "Eurozone Inflation (HICP)", source_url: "https://fxmacrodata.com/eur/inflation" },
    previousValue: 2.4,
  };

  it("normalizes a curated indicator with a catalogue entry", () => {
    const event = normalizeFxMacroDataEvent(baseParams);
    expect(event).toMatchObject({
      region: "EU",
      currency: "EUR",
      title: "Eurozone Inflation (HICP)",
      importance: "high",
      previous: "2.4",
      sourceUrl: "https://fxmacrodata.com/eur/inflation",
      provider: "fxmacrodata",
    });
    expect(event?.scheduledAt).toBe(new Date(1798761600 * 1000).toISOString());
  });

  it("returns null for a slug outside the curated allowlist", () => {
    const event = normalizeFxMacroDataEvent({ ...baseParams, calendarRow: { ...baseParams.calendarRow, release: "obscure_slug" } });
    expect(event).toBeNull();
  });

  it("returns null when there is no matching catalogue entry", () => {
    const event = normalizeFxMacroDataEvent({ ...baseParams, catalogueEntry: undefined });
    expect(event).toBeNull();
  });

  it("omits `previous` when no prior value is available", () => {
    const event = normalizeFxMacroDataEvent({ ...baseParams, previousValue: null });
    expect(event?.previous).toBeUndefined();
  });
});
