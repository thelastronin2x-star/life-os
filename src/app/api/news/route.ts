import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { newsItems } from "@/lib/db/schema";
import { NEWS_MARKETS, type NewsItem, type NewsMarket } from "@/lib/news/types";

const RESULT_LIMIT = 100;

function isNewsMarket(value: string): value is NewsMarket {
  return (NEWS_MARKETS as string[]).includes(value);
}

/** Reads the cache /api/news/refresh already filled — never calls Alpha
 *  Vantage itself, so opening this on every screen visit is cheap. Filters
 *  in JS rather than a jsonb containment query: the cache is small (a
 *  personal feed, not a news aggregator), so fetching the most recent
 *  RESULT_LIMIT rows and filtering here is simpler than a raw `?|` operator
 *  for a dataset this size. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const marketsParam = searchParams.get("markets");
  const tickersParam = searchParams.get("tickers");

  const requestedMarkets = (marketsParam?.split(",").map((m) => m.trim()).filter(Boolean) ?? []).filter(isNewsMarket);
  const requestedTickers = tickersParam?.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean) ?? [];

  try {
    const rows = await db.select().from(newsItems).orderBy(desc(newsItems.publishedAt)).limit(RESULT_LIMIT);

    const filtered = rows.filter((row) => {
      if (requestedMarkets.length > 0 && row.markets.some((m) => requestedMarkets.includes(m as NewsMarket))) return true;
      if (requestedTickers.length > 0 && row.tickers.some((t) => requestedTickers.includes(t.toUpperCase()))) return true;
      return false;
    });

    const items: NewsItem[] = filtered.map((row) => ({
      id: row.id,
      headline: row.headline,
      source: row.source,
      url: row.url,
      publishedAt: row.publishedAt.toISOString(),
      summary: row.summary ?? undefined,
      sentiment: (row.sentiment as NewsItem["sentiment"]) ?? undefined,
      markets: row.markets as NewsMarket[],
      tickers: row.tickers,
    }));

    return NextResponse.json({ items });
  } catch (e) {
    console.error("news fetch failed", e);
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
