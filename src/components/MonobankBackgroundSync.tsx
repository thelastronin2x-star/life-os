"use client";

import { useMonobankWebhookSync } from "@/lib/use-monobank-webhook-sync";
import { useMonobankPeriodicSync } from "@/lib/use-monobank-periodic-sync";
import { useLedgerSync } from "@/lib/use-ledger-sync";

/** Mounted once at the app root so Monobank stays in sync no matter which
 *  screen is open, with no manual "Синхронізувати" press required: webhook
 *  events for near-instant new purchases (use-monobank-webhook-sync.ts) plus
 *  a periodic statement refresh for the cases a webhook alone doesn't cover,
 *  like a hold quietly settling with no second webhook (use-monobank-periodic-sync.ts).
 *
 *  useLedgerSync reads the same underlying events from the server ledger via
 *  cursor instead of the Redis queue (see monobank-server-ledger-prompt.md,
 *  Stage 5) — runs alongside the webhook poll during this transition, not
 *  instead of it; both are deduped by externalId regardless of which
 *  delivers a given transaction first. The webhook poll (and the Redis
 *  queue it reads from) gets removed in Stage 7, once this has proven out. */
export function MonobankBackgroundSync() {
  useMonobankWebhookSync();
  useMonobankPeriodicSync();
  useLedgerSync();
  return null;
}
