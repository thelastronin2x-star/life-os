import { describe, expect, it } from "vitest";
import { parseAlphaVantageTimestamp, mapSentimentLabel, normalizeAlphaVantageArticle } from "./alpha-vantage-normalize";

describe("parseAlphaVantageTimestamp", () => {
  it("converts Alpha Vantage's compact timestamp to ISO", () => {
    expect(parseAlphaVantageTimestamp("20260115T093000")).toBe("2026-01-15T09:30:00.000Z");
  });

  it("falls back to now for an unparseable timestamp rather than throwing", () => {
    expect(() => parseAlphaVantageTimestamp("garbage")).not.toThrow();
  });
});

describe("mapSentimentLabel", () => {
  it("maps bearish variants to negative", () => {
    expect(mapSentimentLabel("Bearish")).toBe("negative");
    expect(mapSentimentLabel("Somewhat-Bearish")).toBe("negative");
  });

  it("maps bullish variants to positive", () => {
    expect(mapSentimentLabel("Bullish")).toBe("positive");
    expect(mapSentimentLabel("Somewhat-Bullish")).toBe("positive");
  });

  it("maps Neutral to neutral", () => {
    expect(mapSentimentLabel("Neutral")).toBe("neutral");
  });

  it("returns undefined for missing or unrecognized labels", () => {
    expect(mapSentimentLabel(undefined)).toBeUndefined();
    expect(mapSentimentLabel("???")).toBeUndefined();
  });
});

describe("normalizeAlphaVantageArticle", () => {
  it("maps the Alpha Vantage article shape onto our NewsItem model", () => {
    const article = {
      title: "Fed holds rates steady",
      url: "https://example.com/fed-holds",
      time_published: "20260115T093000",
      summary: "The Fed kept rates unchanged.",
      source: "Reuters",
      overall_sentiment_label: "Neutral",
      ticker_sentiment: [
        { ticker: "SPY", relevance_score: "0.9" },
        { ticker: "DIA", relevance_score: "0.5" },
      ],
    };
    const item = normalizeAlphaVantageArticle(article, ["indices"]);
    expect(item.headline).toBe("Fed holds rates steady");
    expect(item.source).toBe("Reuters");
    expect(item.sentiment).toBe("neutral");
    expect(item.markets).toEqual(["indices"]);
    expect(item.tickers).toEqual(["SPY", "DIA"]);
    expect(item.publishedAt).toBe("2026-01-15T09:30:00.000Z");
  });

  it("never surfaces full article text — only headline and short summary", () => {
    const article = {
      title: "Headline",
      url: "https://example.com/x",
      time_published: "20260115T093000",
      summary: "Short summary only.",
      source: "Reuters",
    };
    const item = normalizeAlphaVantageArticle(article, ["forex"]);
    expect(item).not.toHaveProperty("body");
    expect(item).not.toHaveProperty("content");
    expect(item.summary).toBe("Short summary only.");
  });

  it("caps tickers at the 5 most relevant, sorted by relevance", () => {
    const article = {
      title: "Headline",
      url: "https://example.com/y",
      time_published: "20260115T093000",
      source: "Reuters",
      ticker_sentiment: Array.from({ length: 8 }, (_, i) => ({ ticker: `T${i}`, relevance_score: String(i / 10) })),
    };
    const item = normalizeAlphaVantageArticle(article, ["crypto"]);
    expect(item.tickers).toHaveLength(5);
    expect(item.tickers[0]).toBe("T7"); // highest relevance first
  });
});
