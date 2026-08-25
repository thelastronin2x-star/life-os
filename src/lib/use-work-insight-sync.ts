"use client";

import { useJournalStore } from "./journal-store";
import { useGenericSourceSync, type SourceInsightState } from "./use-generic-source-sync";
import { buildWorkContext, computeWorkSignature } from "./assistant-context-work";
import type { Profile } from "./store";

const WORK_DEBOUNCE_MS = 15 * 1000; // closing a trade is already a deliberate, singular action — no burst to wait out
const WORK_FAST_MS = 2500; // while the bubble panel is open

/** Fires almost immediately once a trade's status actually flips to
 *  "closed" — opening a new trade or editing an open one doesn't change the
 *  signature at all, so it can't trigger this. Reactively subscribed to
 *  `trades` (not `.getState()`) — see use-calendar-insight-sync.ts. */
export function useWorkInsightSync(profile: Profile, isPanelOpen = false): SourceInsightState {
  const trades = useJournalStore((s) => s.trades);
  const signature = computeWorkSignature(trades, profile);
  return useGenericSourceSync(
    "work",
    signature,
    () => buildWorkContext(profile),
    WORK_DEBOUNCE_MS,
    0,
    "work",
    isPanelOpen ? WORK_FAST_MS : undefined
  );
}
