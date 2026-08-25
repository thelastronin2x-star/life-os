export type NewsMarket = "indices" | "forex" | "crypto" | "commodities";

export const NEWS_MARKETS: NewsMarket[] = ["indices", "forex", "crypto", "commodities"];

export type NewsSentiment = "positive" | "neutral" | "negative";

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  url: string;
  publishedAt: string; // ISO
  summary?: string;
  sentiment?: NewsSentiment;
  markets: NewsMarket[];
  tickers: string[];
}

/** Adapter boundary — the module only ever talks to this interface, never
 *  to Alpha Vantage's response shape directly, so swapping providers later
 *  (a different news API, or several merged) is a new file implementing
 *  this, not a rewrite of refresh.ts or the API routes. */
export interface NewsProvider {
  /** One provider call per (market OR custom-ticker-batch) request — the
   *  caller (refresh.ts) decides how to slice the work; the provider just
   *  answers "give me news matching this query" and tags results with
   *  whichever `markets` the caller says this query was for. */
  fetchNews(query: NewsProviderQuery): Promise<NewsItem[]>;
}

export type NewsProviderQuery =
  | { kind: "market"; market: NewsMarket }
  | { kind: "tickers"; tickers: string[] };
