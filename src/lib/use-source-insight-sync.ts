"use client";

import { useCallback } from "react";
import { useAssistantStore, type ContextInsight, type InsightSource } from "./assistant-store";
import {
  buildCalendarContext,
  buildFinanceContext,
  buildWorkContext,
  callAssistantOnce,
  computeCalendarSignature,
  computeFinanceSignature,
  computeWorkSignature,
} from "./assistant-context";
import { useDebouncedInsightTrigger } from "./use-debounced-insight-trigger";
import { useHasHydrated, type Profile } from "./store";

const INSIGHT_PROMPT =
  "Дай дуже короткий контекстний коментар (максимум 2-3 речення, розмовний тон, українською) на основі контексту нижче.";

// Each source has its own natural cadence — see claude_code_prompt_assistant_cadence.md.
const CALENDAR_DEBOUNCE_MS = 7 * 60 * 1000; // "session end" — a few minutes of quiet after the last edit
const WORK_DEBOUNCE_MS = 15 * 1000; // closing a trade is already a deliberate, singular action — no burst to wait out
const FINANCE_DEBOUNCE_MS = 2 * 60 * 1000; // just enough to coalesce a burst of same-minute transactions
const FINANCE_COOLDOWN_MS = 7 * 60 * 60 * 1000; // never regenerate more than ~once every 6-8h regardless of new triggers

export interface SourceInsightState {
  cached: ContextInsight | undefined;
  /** True once the signature no longer matches the cached insight. For
   *  finance this only arms the debounce timer — the actual API call still
   *  waits out any remaining cooldown once the timer fires (see `fire`
   *  below), so a stale signature doesn't necessarily mean a call is
   *  imminent. */
  isStale: boolean;
}

function useGenericSourceSync(
  source: InsightSource,
  signature: string,
  buildContext: () => string,
  debounceMs: number,
  cooldownMs = 0
): SourceInsightState {
  const hydrated = useHasHydrated();
  const { contextInsights, setContextInsight } = useAssistantStore();
  const cached = contextInsights[source];

  // Before the persisted stores rehydrate from localStorage, `cached` is
  // transiently undefined and every signature looks "new" — without this
  // gate that would queue a real regeneration on every cold start. Note:
  // this is purely a signature comparison, no clock read — the cooldown
  // floor (which does need the current time) is enforced later, inside the
  // fire callback rather than here, since reading the clock during render
  // would make render output depend on an impure value.
  const isStale = hydrated && (!cached || cached.signature !== signature);

  const fire = useCallback(() => {
    function attempt() {
      const latest = useAssistantStore.getState().contextInsights[source];
      if (cooldownMs > 0 && latest?.generatedAt) {
        const elapsed = Date.now() - new Date(latest.generatedAt).getTime();
        if (elapsed < cooldownMs) {
          // Still within the cooldown floor — don't call the API yet, just
          // re-check once the remaining cooldown has actually elapsed, so a
          // trigger that lands mid-cooldown isn't silently dropped forever.
          setTimeout(attempt, cooldownMs - elapsed);
          return;
        }
      }
      callAssistantOnce(INSIGHT_PROMPT, buildContext(), "quick-insight")
        .then((text) => {
          setContextInsight(source, { text, signature, seen: false, generatedAt: new Date().toISOString() });
        })
        .catch(() => undefined);
    }
    attempt();
    // buildContext closes over whatever the caller already depends on (profile, etc.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, signature, setContextInsight]);

  useDebouncedInsightTrigger(signature, isStale, fire, debounceMs);

  return { cached, isStale };
}

/** Fires ~7 minutes after the last calendar edit in the current month goes
 *  quiet — never on each individual add/edit. */
export function useCalendarInsightSync(): SourceInsightState {
  const signature = computeCalendarSignature();
  return useGenericSourceSync("calendar", signature, buildCalendarContext, CALENDAR_DEBOUNCE_MS);
}

/** Fires almost immediately once a trade's status actually flips to
 *  "closed" — opening a new trade or editing an open one doesn't change the
 *  signature at all, so it can't trigger this. */
export function useWorkInsightSync(profile: Profile): SourceInsightState {
  const signature = computeWorkSignature(profile);
  return useGenericSourceSync("work", signature, () => buildWorkContext(profile), WORK_DEBOUNCE_MS);
}

/** Fires on a category crossing its limit or an unusually large expense,
 *  but never more than once every ~7h even if more trigger-worthy events
 *  land in the meantime — finance data changes far too often to regenerate
 *  on every qualifying event. */
export function useFinanceInsightSync(): SourceInsightState {
  const signature = computeFinanceSignature();
  return useGenericSourceSync("finance", signature, buildFinanceContext, FINANCE_DEBOUNCE_MS, FINANCE_COOLDOWN_MS);
}
