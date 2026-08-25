import { describe, expect, it } from "vitest";
import { normalizeBusinessQuantIndicator, formatBusinessQuantValue, type BusinessQuantIndicator } from "./businessquant-normalize";

function makeIndicator(overrides: Partial<BusinessQuantIndicator>): BusinessQuantIndicator {
  return {
    indicator_id: 1,
    code: "E:USCPI",
    name: "Consumer Price Index",
    category: "Inflation",
    display_unit: "%YoY",
    decimals: 1,
    next_release: "2026-09-11",
    release_state: "scheduled",
    latest_value: 3.2,
    prior_value: 3.1,
    ...overrides,
  };
}

describe("normalizeBusinessQuantIndicator", () => {
  it("normalizes a curated indicator with an upcoming release", () => {
    const event = normalizeBusinessQuantIndicator(makeIndicator({}));
    expect(event).toMatchObject({
      region: "US",
      currency: "USD",
      title: "Consumer Price Index",
      importance: "high",
      scheduledAt: "2026-09-11",
      previous: "3.2 %YoY",
      provider: "businessquant",
      affectedMarkets: ["indices", "forex", "commodities"],
    });
  });

  it("returns null for a code outside the curated allowlist", () => {
    expect(normalizeBusinessQuantIndicator(makeIndicator({ code: "E:FXUSDCNY", name: "USD/CNY Exchange Rate" }))).toBeNull();
  });

  it("returns null when there is no upcoming release", () => {
    expect(normalizeBusinessQuantIndicator(makeIndicator({ next_release: null }))).toBeNull();
  });
});

describe("formatBusinessQuantValue", () => {
  it("formats a value with its unit and decimal precision", () => {
    expect(formatBusinessQuantValue(6.77188, "CNY per USD", 4)).toBe("6.7719 CNY per USD");
  });

  it("returns undefined for a missing value", () => {
    expect(formatBusinessQuantValue(null, "%YoY", 1)).toBeUndefined();
  });

  it("omits the unit suffix when unit is empty", () => {
    expect(formatBusinessQuantValue(3.2, "", 1)).toBe("3.2");
  });
});
