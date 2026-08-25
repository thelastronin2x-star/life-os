import type { NewsItem, NewsMarket, NewsProvider, NewsProviderQuery } from "./types";
import { idFromUrl } from "./dedupe";

/** Static, realistic-shaped sample data — used for local dev (no
 *  ALPHA_VANTAGE_API_KEY set) and as the fallback when Alpha Vantage itself
 *  fails or rate-limits (see alpha-vantage-provider.ts). Timestamps are
 *  generated relative to "now" so the feed always looks freshly published
 *  instead of visibly stale sample data. */
const SAMPLE_HEADLINES: { headline: string; source: string; hoursAgo: number; summary: string; sentiment: NewsItem["sentiment"]; tickers: string[] }[] = [
  {
    headline: "Fed signals rates likely on hold through next quarter",
    source: "Reuters",
    hoursAgo: 1,
    summary: "Federal Reserve officials indicated no imminent rate change, citing steady inflation data.",
    sentiment: "neutral",
    tickers: ["DIA", "SPY"],
  },
  {
    headline: "Dollar slips as traders price in later ECB divergence",
    source: "Bloomberg",
    hoursAgo: 2,
    summary: "EUR/USD gained after weaker-than-expected US jobless claims data.",
    sentiment: "negative",
    tickers: ["EUR", "USD"],
  },
  {
    headline: "Bitcoin holds above key level after ETF inflow data",
    source: "CoinDesk",
    hoursAgo: 3,
    summary: "Spot Bitcoin ETFs recorded net inflows for a fifth consecutive session.",
    sentiment: "positive",
    tickers: ["BTC"],
  },
  {
    headline: "Oil climbs on tighter supply outlook ahead of OPEC+ meeting",
    source: "Reuters",
    hoursAgo: 4,
    summary: "Crude prices rose as traders anticipate a possible extension of output cuts.",
    sentiment: "positive",
    tickers: ["WTI", "BRENT"],
  },
  {
    headline: "Tech shares lead S&P 500 higher on chip demand optimism",
    source: "MarketWatch",
    hoursAgo: 5,
    summary: "Semiconductor stocks rallied after a bullish outlook from a major supplier.",
    sentiment: "positive",
    tickers: ["QQQ", "SPY"],
  },
  {
    headline: "Ethereum network upgrade discussion weighs on short-term sentiment",
    source: "CoinDesk",
    hoursAgo: 6,
    summary: "Developers debated timeline risk for the next scheduled protocol upgrade.",
    sentiment: "neutral",
    tickers: ["ETH"],
  },
  {
    headline: "Gold steadies as investors await US inflation print",
    source: "Bloomberg",
    hoursAgo: 7,
    summary: "Bullion held near recent highs ahead of Friday's CPI release.",
    sentiment: "neutral",
    tickers: ["GLD"],
  },
  {
    headline: "Yen weakens further as BOJ maintains ultra-loose stance",
    source: "Reuters",
    hoursAgo: 8,
    summary: "USD/JPY pushed toward multi-month highs after the central bank held policy steady.",
    sentiment: "negative",
    tickers: ["JPY", "USD"],
  },
];

const MARKET_TICKER_HINTS: Record<NewsMarket, string[]> = {
  indices: ["DIA", "SPY", "QQQ"],
  forex: ["EUR", "USD", "JPY"],
  crypto: ["BTC", "ETH"],
  commodities: ["WTI", "BRENT", "GLD"],
};

function marketsForTickers(tickers: string[]): NewsMarket[] {
  const matches = (Object.keys(MARKET_TICKER_HINTS) as NewsMarket[]).filter((market) =>
    MARKET_TICKER_HINTS[market].some((hint) => tickers.includes(hint))
  );
  return matches.length > 0 ? matches : ["indices"];
}

function buildMockItem(sample: (typeof SAMPLE_HEADLINES)[number], markets: NewsMarket[]): NewsItem {
  const publishedAt = new Date(Date.now() - sample.hoursAgo * 60 * 60 * 1000).toISOString();
  const url = `https://example.com/mock-news/${encodeURIComponent(sample.headline)}`;
  return {
    id: idFromUrl(url),
    headline: sample.headline,
    source: sample.source,
    url,
    publishedAt,
    summary: sample.summary,
    sentiment: sample.sentiment,
    markets,
    tickers: sample.tickers,
  };
}

export class MockNewsProvider implements NewsProvider {
  async fetchNews(query: NewsProviderQuery): Promise<NewsItem[]> {
    if (query.kind === "market") {
      return SAMPLE_HEADLINES.filter((s) => marketsForTickers(s.tickers).includes(query.market)).map((s) =>
        buildMockItem(s, [query.market])
      );
    }
    return SAMPLE_HEADLINES.filter((s) => s.tickers.some((t) => query.tickers.includes(t))).map((s) =>
      buildMockItem(s, marketsForTickers(s.tickers))
    );
  }
}
