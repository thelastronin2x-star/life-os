"use client";

import { useEffect, useState } from "react";
import { useNewsPreferencesStore } from "./news-preferences-store";
import type { NewsItem } from "./news/types";

export interface NewsFeedState {
  items: NewsItem[];
  loading: boolean;
  error: boolean;
}

/** Reads the server-side cache (never calls Alpha Vantage directly — see
 *  api/news/route.ts) filtered by the trader's own market/ticker
 *  preferences. Re-fetches whenever that selection changes, not on every
 *  render or screen focus — the underlying cache only changes once a day
 *  anyway (the cron in api/news/refresh/route.ts), so anything more
 *  frequent would just be extra requests for the same answer. */
export function useNewsFeed(): NewsFeedState {
  const markets = useNewsPreferencesStore((s) => s.markets);
  const tickers = useNewsPreferencesStore((s) => s.tickers);
  const [state, setState] = useState<NewsFeedState>({ items: [], loading: true, error: false });

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a genuine re-fetch is starting (markets/tickers changed), not a derivable render value
    setState((s) => ({ ...s, loading: true, error: false }));

    const params = new URLSearchParams();
    if (markets.length > 0) params.set("markets", markets.join(","));
    if (tickers.length > 0) params.set("tickers", tickers.join(","));

    fetch(`/api/news?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("fetch_failed");
        return res.json() as Promise<{ items: NewsItem[] }>;
      })
      .then((data) => {
        if (!cancelled) setState({ items: data.items, loading: false, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ items: [], loading: false, error: true });
      });

    return () => {
      cancelled = true;
    };
  }, [markets, tickers]);

  return state;
}
