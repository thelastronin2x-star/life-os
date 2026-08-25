import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { newsItems, newsTrackedTickers } from "@/lib/db/schema";
import { NEWS_MARKETS, type NewsItem } from "./types";
import { dedupeByUrl } from "./dedupe";
import { MockNewsProvider } from "./mock-provider";
import { AlphaVantageNewsProvider, AlphaVantageRateLimitError } from "./alpha-vantage-provider";
import { translateNewsItems } from "./translate";
import type { NewsProvider } from "./types";

const MAX_CUSTOM_TICKERS_PER_BATCH = 10;

export interface RefreshResult {
  provider: "alpha-vantage" | "mock";
  fetched: number;
  upserted: number;
  fellBackToMock: boolean;
}

function primaryProvider(): NewsProvider | null {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  return apiKey ? new AlphaVantageNewsProvider(apiKey) : null;
}

async function collectAllTrackedTickers(): Promise<string[]> {
  const rows = await db.select().from(newsTrackedTickers);
  const union = new Set<string>();
  for (const row of rows) {
    for (const ticker of row.tickers) union.add(ticker);
  }
  return Array.from(union).slice(0, MAX_CUSTOM_TICKERS_PER_BATCH);
}

/** Fetches every standard market plus the union of all devices' custom
 *  tracked tickers, normalizes, dedupes by URL, and upserts into the cache.
 *  Falls back to MockNewsProvider per-query when Alpha Vantage rate-limits
 *  or no key is configured — a partial real result plus mock filler is
 *  still better than an empty feed, and this is exactly the situation the
 *  prompt's own "fallback" requirement describes. */
export async function refreshNews(): Promise<RefreshResult> {
  const mock = new MockNewsProvider();
  const real = primaryProvider();
  let fellBackToMock = false;

  async function fetchWithFallback(query: Parameters<NewsProvider["fetchNews"]>[0]): Promise<NewsItem[]> {
    if (!real) {
      fellBackToMock = true;
      return mock.fetchNews(query);
    }
    try {
      return await real.fetchNews(query);
    } catch (e) {
      if (e instanceof AlphaVantageRateLimitError || e instanceof Error) {
        fellBackToMock = true;
        return mock.fetchNews(query);
      }
      throw e;
    }
  }

  const marketBatches = await Promise.all(NEWS_MARKETS.map((market) => fetchWithFallback({ kind: "market", market })));
  const trackedTickers = await collectAllTrackedTickers();
  const tickerBatch = trackedTickers.length > 0 ? await fetchWithFallback({ kind: "tickers", tickers: trackedTickers }) : [];

  const all = dedupeByUrl([...marketBatches.flat(), ...tickerBatch]);

  // Only translate+insert items this cache has never seen. Re-touching an
  // already-cached row would re-run translation (wasteful) and, worse,
  // overwrite its already-Ukrainian headline/summary with this run's fresh
  // English re-fetch — translation only ever needs to happen once per item.
  let newItems: NewsItem[] = [];
  if (all.length > 0) {
    const existingRows = await db
      .select({ id: newsItems.id })
      .from(newsItems)
      .where(inArray(newsItems.id, all.map((item) => item.id)));
    const existingIds = new Set(existingRows.map((row) => row.id));
    newItems = all.filter((item) => !existingIds.has(item.id));
  }

  const translated = await translateNewsItems(newItems);

  if (translated.length > 0) {
    await db
      .insert(newsItems)
      .values(
        translated.map((item) => ({
          id: item.id,
          headline: item.headline,
          source: item.source,
          url: item.url,
          publishedAt: new Date(item.publishedAt),
          summary: item.summary ?? null,
          sentiment: item.sentiment ?? null,
          markets: item.markets,
          tickers: item.tickers,
          fetchedAt: new Date(),
        }))
      )
      .onConflictDoNothing({ target: newsItems.id });
  }

  return {
    provider: real ? "alpha-vantage" : "mock",
    fetched: marketBatches.flat().length + tickerBatch.length,
    upserted: translated.length,
    fellBackToMock,
  };
}
