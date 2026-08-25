"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NewsMarket } from "./news/types";

const MAX_TICKERS = 10;
const DEFAULT_MARKETS: NewsMarket[] = ["indices", "forex", "crypto"];

function syncTickers(tickers: string[]) {
  fetch("/api/news/tickers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers }),
  }).catch(() => undefined);
}

interface NewsPreferencesState {
  markets: NewsMarket[];
  tickers: string[];
  toggleMarket: (market: NewsMarket) => void;
  addTicker: (ticker: string) => void;
  removeTicker: (ticker: string) => void;
}

/** Which markets/tickers the trader cares about — read by MarketNewsModule
 *  to filter /api/news, and synced to newsTrackedTickers (see
 *  api/news/tickers/route.ts) so the hourly refresh cron — which has no
 *  access to this localStorage — knows which extra tickers to fetch. */
export const useNewsPreferencesStore = create<NewsPreferencesState>()(
  persist(
    (set) => ({
      markets: DEFAULT_MARKETS,
      tickers: [],
      toggleMarket: (market) =>
        set((s) => ({
          markets: s.markets.includes(market) ? s.markets.filter((m) => m !== market) : [...s.markets, market],
        })),
      addTicker: (ticker) =>
        set((s) => {
          const clean = ticker.trim().toUpperCase();
          if (!clean || s.tickers.includes(clean) || s.tickers.length >= MAX_TICKERS) return s;
          const tickers = [...s.tickers, clean];
          syncTickers(tickers);
          return { tickers };
        }),
      removeTicker: (ticker) =>
        set((s) => {
          const tickers = s.tickers.filter((t) => t !== ticker);
          syncTickers(tickers);
          return { tickers };
        }),
    }),
    { name: "life-os-news-preferences" }
  )
);

export { MAX_TICKERS };
