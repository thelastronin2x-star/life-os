import type { NewsItem, NewsMarket } from "./news/types";

export const MARKET_FILTER_LABELS: Record<"all" | NewsMarket, string> = {
  all: "Усе",
  indices: "Індекси США",
  forex: "Forex",
  crypto: "Crypto",
  commodities: "Сировина",
};

/** The single most relevant signal for "Зараз у фокусі" — the most
 *  recently published item among whatever's already been filtered down to
 *  the trader's own markets. Not a sentiment/relevance model — a personal
 *  feed module has no ranking data worth building one on top of; recency
 *  is the one signal that's both real and honest about what it is. */
export function pickFocusItem(items: NewsItem[]): NewsItem | null {
  if (items.length === 0) return null;
  return [...items].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0];
}

export function filterByMarket(items: NewsItem[], filter: "all" | NewsMarket): NewsItem[] {
  if (filter === "all") return items;
  return items.filter((item) => item.markets.includes(filter));
}

/** Abbreviated Ukrainian relative time ("5 хв тому", "3 год тому") — short
 *  forms are number-invariant, so no pluralization table is needed the way
 *  a full word ("хвилин"/"хвилини") would require. */
export function formatRelativeTime(publishedAt: string, now: number = Date.now()): string {
  const diffMs = now - new Date(publishedAt).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "щойно";
  if (minutes < 60) return `${minutes} хв тому`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} год тому`;
  const days = Math.round(hours / 24);
  return `${days} дн тому`;
}
