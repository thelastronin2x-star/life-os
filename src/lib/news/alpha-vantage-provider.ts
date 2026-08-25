import "server-only";
import type { NewsItem, NewsMarket, NewsProvider, NewsProviderQuery } from "./types";
import {
  normalizeAlphaVantageArticle,
  inferMarketsFromTickerSentiment,
  type AlphaVantageResponse,
} from "./alpha-vantage-normalize";

const ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query";

/** Alpha Vantage has no direct indices/forex/crypto/commodities taxonomy —
 *  NEWS_SENTIMENT's own `topics` vocabulary is sector/theme-based
 *  (blockchain, economy_macro, financial_markets, energy_transportation,
 *  ...), not asset-class-based. This is the best-effort mapping onto our
 *  four buckets; it's an approximation, not a guarantee every returned
 *  article is purely about that one asset class. */
const MARKET_TOPICS: Record<NewsMarket, string> = {
  indices: "financial_markets",
  forex: "economy_macro,economy_monetary",
  crypto: "blockchain",
  commodities: "energy_transportation",
};

export class AlphaVantageRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlphaVantageRateLimitError";
  }
}

export class AlphaVantageNewsProvider implements NewsProvider {
  constructor(private apiKey: string) {}

  async fetchNews(query: NewsProviderQuery): Promise<NewsItem[]> {
    const params = new URLSearchParams({ function: "NEWS_SENTIMENT", apikey: this.apiKey, limit: "20" });
    const markets: NewsMarket[] = query.kind === "market" ? [query.market] : [];
    if (query.kind === "market") {
      params.set("topics", MARKET_TOPICS[query.market]);
    } else {
      params.set("tickers", query.tickers.join(","));
    }

    const res = await fetch(`${ALPHA_VANTAGE_URL}?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`alpha_vantage_http_${res.status}`);
    }
    const data = (await res.json()) as AlphaVantageResponse;

    // The free tier reports rate-limiting as a 200 OK with a `Note`/
    // `Information` field instead of a real HTTP error — refresh.ts treats
    // this distinctly so it can fall back to the mock provider for this
    // run instead of caching an empty result as if it were a real "no
    // news" answer.
    if (!data.feed) {
      throw new AlphaVantageRateLimitError(data.Note ?? data.Information ?? "alpha_vantage_no_feed");
    }

    return data.feed.map((article) =>
      normalizeAlphaVantageArticle(
        article,
        query.kind === "market" ? markets : inferMarketsFromTickerSentiment(article.ticker_sentiment)
      )
    );
  }
}
