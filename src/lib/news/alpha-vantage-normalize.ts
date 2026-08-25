import type { NewsItem, NewsMarket, NewsSentiment } from "./types";
import { idFromUrl } from "./dedupe";

/** Pure normalization logic, deliberately kept out of the `server-only`
 *  alpha-vantage-provider.ts (which does the actual `fetch()` call) — same
 *  split this codebase already uses elsewhere (e.g. monobank-sync.ts vs.
 *  monobank.ts) so the parsing/mapping logic stays unit-testable without
 *  `server-only` throwing when vitest imports it outside a real Next.js
 *  server bundle. */

export interface AlphaVantageTickerSentiment {
  ticker: string;
  relevance_score: string;
}

export interface AlphaVantageArticle {
  title: string;
  url: string;
  time_published: string; // "YYYYMMDDTHHMMSS"
  summary?: string;
  source: string;
  overall_sentiment_label?: string;
  ticker_sentiment?: AlphaVantageTickerSentiment[];
}

export interface AlphaVantageResponse {
  feed?: AlphaVantageArticle[];
  // Present instead of `feed` when the key is invalid or the request is
  // otherwise rejected outright (as opposed to rate-limited — that comes
  // back as `Note` or `Information` instead, same as the free-tier cap).
  Information?: string;
  Note?: string;
}

/** "20260115T093000" -> ISO 8601. Alpha Vantage documents this as US/Eastern
 *  wall-clock, but the feed only ever needs relative "N hours ago" display
 *  and same-day dedup — a timezone-naive parse (treated as if UTC) is
 *  within the same order-of-magnitude approximation MARKET_TOPICS already
 *  makes (see alpha-vantage-provider.ts), not a new inaccuracy. */
export function parseAlphaVantageTimestamp(raw: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(raw);
  if (!match) return new Date().toISOString();
  const [, y, mo, d, h, mi, s] = match;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).toISOString();
}

export function mapSentimentLabel(label: string | undefined): NewsSentiment | undefined {
  if (!label) return undefined;
  if (label.includes("Bearish")) return "negative";
  if (label.includes("Bullish")) return "positive";
  if (label === "Neutral") return "neutral";
  return undefined;
}

/** Pure normalization from Alpha Vantage's article shape to our own model —
 *  `markets` is what the CALLER asked for (one bucket per query), not
 *  re-derived from the article content. */
export function normalizeAlphaVantageArticle(article: AlphaVantageArticle, markets: NewsMarket[]): NewsItem {
  return {
    id: idFromUrl(article.url),
    headline: article.title,
    source: article.source,
    url: article.url,
    publishedAt: parseAlphaVantageTimestamp(article.time_published),
    summary: article.summary,
    sentiment: mapSentimentLabel(article.overall_sentiment_label),
    markets,
    tickers: (article.ticker_sentiment ?? [])
      .slice()
      .sort((a, b) => Number(b.relevance_score) - Number(a.relevance_score))
      .slice(0, 5)
      .map((t) => t.ticker),
  };
}

/** For a ticker-driven (custom-ticker) query, Alpha Vantage doesn't tell us
 *  which of our four buckets the article belongs to — best-effort infer it
 *  from which of ITS OWN reported tickers looks like a crypto/forex symbol,
 *  defaulting to "indices" (the most common bucket for arbitrary stock
 *  tickers) when nothing matches. An approximation, not a claim of
 *  certainty — same spirit as the market/topic mapping in
 *  alpha-vantage-provider.ts. */
export function inferMarketsFromTickerSentiment(tickerSentiment: AlphaVantageTickerSentiment[] | undefined): NewsMarket[] {
  const tickers = (tickerSentiment ?? []).map((t) => t.ticker);
  const isCrypto = tickers.some((t) => t.startsWith("CRYPTO:"));
  const isForex = tickers.some((t) => t.startsWith("FOREX:"));
  if (isCrypto) return ["crypto"];
  if (isForex) return ["forex"];
  return ["indices"];
}
