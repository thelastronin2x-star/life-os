"use client";

import { useCalendarStore } from "./calendar-store";
import { useGenericSourceSync, type SourceInsightState } from "./use-generic-source-sync";
import { buildCalendarContext, computeCalendarSignature } from "./assistant-context-calendar";

const CALENDAR_DEBOUNCE_MS = 7 * 60 * 1000; // "session end" — a few minutes of quiet after the last edit, while nobody's watching
const CALENDAR_FAST_MS = 2500; // while the bubble panel is open — "тиша ~2-3с" from the reactive-update prompt

/** Reactively subscribed to `items` (not `.getState()`) — this is what
 *  actually makes the insight regenerate on its own when an event is
 *  added/edited/deleted, instead of only by coincidence when some ancestor
 *  re-renders for an unrelated reason. `isPanelOpen` switches the debounce
 *  from the slow background cadence to the fast one used while the user is
 *  actually looking at the bubble. */
export function useCalendarInsightSync(isPanelOpen = false): SourceInsightState {
  const items = useCalendarStore((s) => s.items);
  const signature = computeCalendarSignature(items);
  return useGenericSourceSync(
    "calendar",
    signature,
    buildCalendarContext,
    CALENDAR_DEBOUNCE_MS,
    0,
    "calendar",
    isPanelOpen ? CALENDAR_FAST_MS : undefined
  );
}
