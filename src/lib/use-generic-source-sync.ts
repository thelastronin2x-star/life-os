"use client";

import { useCallback, useState } from "react";
import { useAssistantStore, type ContextInsight, type InsightSource } from "./assistant-store";
import { streamAssistantOnce } from "./assistant-client";
import { useDebouncedInsightTrigger } from "./use-debounced-insight-trigger";
import { useHasHydrated } from "./store";
import type { AssistantTaskType } from "./model-router";

export const INSIGHT_PROMPT =
  "Дай дуже короткий контекстний коментар (максимум 2-3 речення, розмовний тон, українською) на основі контексту нижче.";

export interface SourceInsightState {
  cached: ContextInsight | undefined;
  /** True once the signature no longer matches the cached insight. For
   *  finance/global this only arms the debounce timer — the actual API call
   *  still waits out any remaining cooldown once the timer fires (see `fire`
   *  below), so a stale signature doesn't necessarily mean a call is
   *  imminent. */
  isStale: boolean;
  /** True while a regeneration request is in flight — a bubble shows this as
   *  a small "передумує" indicator on the message itself, not a full-panel
   *  spinner. */
  isFetching: boolean;
  /** The response as it streams in, or null when nothing is streaming right
   *  now. Callers that want to repaint the message live read this; callers
   *  that only care about the final cached text can ignore it. */
  streamingText: string | null;
}

/** The shared plumbing every per-domain use-X-insight-sync.ts hook is built
 *  on — deliberately has no domain-store imports of its own (only the
 *  generic assistant-store + streamAssistantOnce), so it can be imported by
 *  every scope's sync hook without becoming a cross-scope leak itself.
 *
 *  `signature` must come from a *reactive* subscription in the caller
 *  (`useXStore(selector)`, not `.getState()`) — this hook only reacts to
 *  `signature` changing between renders, it has no way to detect a change
 *  that never triggered a re-render in the first place. `fastMs`, when
 *  passed, overrides `debounceMs` — the caller's way of saying "the panel
 *  showing this is open right now, use the ~2-3s live-update cadence
 *  instead of the slow background one." */
export function useGenericSourceSync(
  source: InsightSource,
  signature: string,
  buildContext: () => string,
  debounceMs: number,
  cooldownMs = 0,
  scope?: "global" | "calendar" | "health" | "work" | "student",
  fastMs?: number,
  /** Overrides the generic 2-3 sentence quick-comment prompt — for sources
   *  that need a longer, structured narrative (e.g. AI Analytics' three-part
   *  strongest-side/problem/estimate breakdown). Defaults to INSIGHT_PROMPT +
   *  the cheap "quick-insight" model, unchanged for every existing caller. */
  promptOverride?: { prompt: string; taskType: AssistantTaskType }
): SourceInsightState {
  const hydrated = useHasHydrated();
  const { contextInsights, setContextInsight } = useAssistantStore();
  const cached = contextInsights[source];
  const [isFetching, setIsFetching] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);

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
      setIsFetching(true);
      setStreamingText("");
      streamAssistantOnce(
        promptOverride?.prompt ?? INSIGHT_PROMPT,
        buildContext(),
        promptOverride?.taskType ?? "quick-insight",
        scope,
        setStreamingText
      )
        .then((text) => {
          setContextInsight(source, { text, signature, seen: false, generatedAt: new Date().toISOString() });
        })
        .catch(() => undefined)
        .finally(() => {
          setIsFetching(false);
          setStreamingText(null);
        });
    }
    attempt();
    // buildContext closes over whatever the caller already depends on (profile, etc.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, signature, setContextInsight]);

  useDebouncedInsightTrigger(signature, isStale, fire, fastMs ?? debounceMs);

  return { cached, isStale, isFetching, streamingText };
}
