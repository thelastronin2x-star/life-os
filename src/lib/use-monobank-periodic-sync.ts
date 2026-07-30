"use client";

import { useCallback, useEffect, useRef } from "react";
import { useFinanceStore } from "./finance-store";
import { useMonobankLinkStore } from "./monobank-store";
import { waitForHydration } from "./store-hydration";
import { syncMonobankAccount, fetchLiveMonobankAccounts } from "./monobank-sync";

// Just above the shared live-balance cache's own TTL (see
// LIVE_ACCOUNTS_CACHE_TTL_MS in monobank-sync.ts) — safe to run this often
// now that every consumer of client-info shares one cached/in-flight
// request instead of each firing its own, which is what used to force this
// interval to sit well clear of Monobank's ~60s limit on its own.
const PERIODIC_SYNC_MS = 65_000;
const MAX_CONSECUTIVE_FAILURES = 3;

/** Keeps every linked Monobank account's transactions and balance fresh on a
 *  timer, with no manual "Синхронізувати" press required. The webhook-driven
 *  sync (use-monobank-webhook-sync.ts) covers new purchases almost
 *  instantly, but Monobank doesn't always send a second webhook when a
 *  pending hold quietly settles — without this, those only ever showed up
 *  after a manual sync. Mounted once at the app root (see layout.tsx),
 *  same as the webhook sync.
 *
 *  Backs off after repeated failures (bad/revoked token, sustained rate
 *  limiting) instead of hammering the API every cycle forever — this
 *  component lives for the whole session, so once it backs off it stays off
 *  until the next full reload, matching the same "don't tight-retry a real
 *  failure" convention used by the history-repair auto-trigger. */
export function useMonobankPeriodicSync() {
  const isSyncing = useRef(false);
  const failureCount = useRef(0);

  const syncAll = useCallback(async () => {
    // No tab showing this app is actually in front — skip the cycle rather
    // than syncing into the void. Covers the interval-triggered call; the
    // visibilitychange-triggered call already only fires when visible.
    if (document.visibilityState !== "visible") return;
    if (isSyncing.current || failureCount.current >= MAX_CONSECUTIVE_FAILURES) return;
    const links = useMonobankLinkStore.getState().links;
    if (links.length === 0) return;

    isSyncing.current = true;
    try {
      // Fetched once for the whole cycle — client-info returns every linked
      // account's balance together, so refetching it per link would just be
      // the same data requested redundantly.
      const liveAccounts = await fetchLiveMonobankAccounts();
      for (const link of links) {
        try {
          await syncMonobankAccount(link, liveAccounts);
          failureCount.current = 0;
        } catch {
          failureCount.current += 1;
          if (failureCount.current >= MAX_CONSECUTIVE_FAILURES) break;
        }
      }
    } finally {
      isSyncing.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    waitForHydration([useFinanceStore, useMonobankLinkStore]).then(() => {
      if (cancelled) return;
      syncAll();
      interval = setInterval(syncAll, PERIODIC_SYNC_MS);
    });

    function onVisible() {
      if (document.visibilityState === "visible") syncAll();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [syncAll]);
}
