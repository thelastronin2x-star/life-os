import { describe, expect, it } from "vitest";
import { pickFocusItem, filterByMarket, formatRelativeTime } from "./news-view";
import type { NewsItem } from "./news/types";

function makeItem(overrides: Partial<NewsItem>): NewsItem {
  return {
    id: crypto.randomUUID(),
    headline: "Headline",
    source: "Reuters",
    url: "https://example.com",
    publishedAt: new Date().toISOString(),
    markets: ["indices"],
    tickers: [],
    ...overrides,
  };
}

describe("pickFocusItem", () => {
  it("returns null for an empty list", () => {
    expect(pickFocusItem([])).toBeNull();
  });

  it("picks the most recently published item", () => {
    const older = makeItem({ id: "a", publishedAt: "2026-01-01T00:00:00.000Z" });
    const newer = makeItem({ id: "b", publishedAt: "2026-01-02T00:00:00.000Z" });
    expect(pickFocusItem([older, newer])?.id).toBe("b");
  });
});

describe("filterByMarket", () => {
  const forex = makeItem({ id: "f", markets: ["forex"] });
  const crypto_ = makeItem({ id: "c", markets: ["crypto"] });

  it("returns everything for 'all'", () => {
    expect(filterByMarket([forex, crypto_], "all")).toHaveLength(2);
  });

  it("filters to just the requested market", () => {
    expect(filterByMarket([forex, crypto_], "forex").map((i) => i.id)).toEqual(["f"]);
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-01-15T12:00:00.000Z").getTime();

  it("shows 'щойно' for under a minute", () => {
    expect(formatRelativeTime(new Date(now - 10_000).toISOString(), now)).toBe("щойно");
  });

  it("shows minutes for under an hour", () => {
    expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5 хв тому");
  });

  it("shows hours for under a day", () => {
    expect(formatRelativeTime(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("3 год тому");
  });

  it("shows days beyond that", () => {
    expect(formatRelativeTime(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe("2 дн тому");
  });
});
