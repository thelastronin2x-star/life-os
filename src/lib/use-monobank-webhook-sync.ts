"use client";

import { useCallback, useEffect, useRef } from "react";
import { useFinanceStore } from "./finance-store";
import { useMonobankLinkStore } from "./monobank-store";
import { importMonobankTransactions } from "./monobank-import";
import type { BankTransaction } from "./bank-source";
import { waitForHydration } from "./store-hydration";

// This only ever hits OUR OWN Redis-backed queue (a cheap LRANGE peek), not
// any Monobank endpoint — there's no external rate limit to respect here,
// unlike client-info. A full SSE replacement was considered (see the
// balance-fix prompt this responds to) and deliberately not built: Vercel's
// serverless functions have a bounded execution duration, so a genuinely
// long-lived stream would need to be re-established periodically anyway
// (invisible reconnect logic, and a real risk of silent drops in
// production) while STILL polling Redis under the hood on the server side —
// it would trade a well-understood client-side poll for a more fragile
// server-side one, for a latency win this already gets for free by just
// polling more often, since nothing here is rate-limited.
const WEBHOOK_POLL_MS = 10_000;

/** Picks up transactions Monobank already pushed to our webhook, no matter
 *  which screen of the app is currently open. This used to live inside
 *  useMonobank(), which only mounts on the /balance/monobank settings page —
 *  meaning a real purchase would sit unclaimed server-side (never imported)
 *  until the user happened to open that exact page. Mounted once at the app
 *  root instead (see layout.tsx), like ServiceWorkerRegister.
 *
 *  Peek-then-ack: events stay queued server-side until AFTER they're
 *  persisted locally, so an interrupted client (page reload, lost network,
 *  iOS backgrounding the tab mid-request) can't lose a transaction that was
 *  already removed from the queue but never saved. */
export function useMonobankWebhookSync() {
  // Guards against two overlapping polls (setInterval firing at the same
  // moment as the visibilitychange handler — e.g. the tab regains focus
  // right on the 45s boundary). Without this, both calls peek the same
  // events and each acks with a plain `count`. Because ack is a blind
  // `lpop(count)` (see monobank-webhook-store.ts) rather than an ack of
  // specific event ids, if a genuinely new event is pushed to the queue in
  // the gap between the two acks, the second (stale) ack's lpop(count) pops
  // that new, never-processed event instead of the ones it actually peeked
  // — silently dropping a real transaction from the queue before the app
  // ever imports it. Serializing polls here removes that overlap window.
  const isPolling = useRef(false);

  const pollWebhookEvents = useCallback(async () => {
    // No tab showing this app is actually in front — skip the cycle rather
    // than polling into the void every 10s while backgrounded. Covers the
    // interval-triggered call; the visibilitychange-triggered call already
    // only fires when visible, so this is a no-op for that path.
    if (document.visibilityState !== "visible") return;
    // No Monobank account ever linked on this device — skip the network call
    // entirely rather than pinging this endpoint from every Life OS user.
    if (useMonobankLinkStore.getState().links.length === 0) return;
    if (isPolling.current) return;
    isPolling.current = true;

    try {
      const res = await fetch("/api/finance/monobank/webhook-events");
      if (!res.ok) return;
      const data: { events?: { accountId: string; transaction: BankTransaction }[] } = await res.json();
      if (!data.events?.length) return;

      const currentLinks = useMonobankLinkStore.getState().links;
      for (const event of data.events) {
        const matchingLink = currentLinks.find((l) => l.monobankAccountId === event.accountId);
        if (!matchingLink) continue;
        importMonobankTransactions([event.transaction], matchingLink.localAccountId);
        // Balance is deliberately NOT reconciled here from the event's own
        // `balance` field — that reflects whatever the account's available
        // balance happened to be at that exact moment, which can be skewed
        // by ANY hold active at the time, not just a hold on this specific
        // transaction. The periodic background sync (use-monobank-periodic-
        // sync.ts) reconciles against Monobank's live account balance every
        // ~90s instead, which is the authoritative, always-fresh number —
        // so the transaction shows up here instantly, and the balance
        // catches up shortly after via that separate, more reliable path.
        useMonobankLinkStore.getState().setLastSynced(event.accountId, new Date().toISOString());
      }

      // Only remove them from the server queue now that they're safely in
      // localStorage — if anything above throws, the fetch below never runs
      // and the events simply get re-peeked (harmlessly, dedup handles it) on
      // the next poll. Acked by transaction id (not a raw count) so an
      // overlapping poll's stale ack can never pop a genuinely new event
      // that was pushed in between — see ackWebhookEvents.
      await fetch("/api/finance/monobank/webhook-events/ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: data.events.map((e) => e.transaction.id) }),
      }).catch(() => undefined);
    } finally {
      isPolling.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    waitForHydration([useFinanceStore, useMonobankLinkStore]).then(() => {
      if (cancelled) return;
      pollWebhookEvents();
      interval = setInterval(pollWebhookEvents, WEBHOOK_POLL_MS);
    });

    // Standalone PWAs don't reliably keep timers running in the background —
    // force an immediate check whenever the app regains focus, same pattern
    // as the service-worker update check in ServiceWorkerRegister. By this
    // point hydration has always long since finished, so no gate needed here.
    function onVisible() {
      if (document.visibilityState === "visible") pollWebhookEvents();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollWebhookEvents]);
}
