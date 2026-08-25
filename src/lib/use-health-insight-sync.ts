"use client";

import { useHealthStore } from "./health-store";
import { useGenericSourceSync, type SourceInsightState } from "./use-generic-source-sync";
import { buildHealthContext, computeHealthSignature } from "./assistant-context-health";

const HEALTH_DEBOUNCE_MS = 5 * 60 * 1000; // a few minutes of quiet after the last tracker update, while nobody's watching
const HEALTH_FAST_MS = 2500; // while the bubble panel is open

/** Whole-store reactive subscription (same pattern health/page.tsx already
 *  uses) rather than `.getState()` — see use-calendar-insight-sync.ts for
 *  why that's the actual fix for "doesn't update on its own." */
export function useHealthInsightSync(isPanelOpen = false): SourceInsightState {
  const health = useHealthStore();
  const signature = computeHealthSignature(health);
  return useGenericSourceSync(
    "health",
    signature,
    buildHealthContext,
    HEALTH_DEBOUNCE_MS,
    0,
    "health",
    isPanelOpen ? HEALTH_FAST_MS : undefined
  );
}
