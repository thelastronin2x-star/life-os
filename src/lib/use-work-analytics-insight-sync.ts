"use client";

import { useJournalStore } from "./journal-store";
import { useGenericSourceSync, type SourceInsightState } from "./use-generic-source-sync";
import {
  buildWorkAnalyticsContext,
  computeWorkAnalyticsSignature,
  type AnalyticsPeriod,
} from "./assistant-context-work-analytics";

const ANALYTICS_DEBOUNCE_MS = 2000; // switching the period tab is a deliberate pick, not a burst to wait out

const ANALYTICS_PROMPT =
  "Проаналізуй трейдинг-журнал за період нижче й дай структурований розбір за інструкцією в контексті.";

/** Own source (see assistant-store.ts's InsightSource) and own signature
 *  keyed by period — switching the Тиждень/Місяць/Квартал tab is a real
 *  context change, unlike the mini-bubble's `work` source which only cares
 *  about the trade list as a whole. Uses the "report" task type (the
 *  powerful model) rather than "quick-insight" — this is a 3-4 sentence
 *  structured analysis, not a 2-3 sentence aside. */
export function useWorkAnalyticsInsightSync(period: AnalyticsPeriod): SourceInsightState {
  const trades = useJournalStore((s) => s.trades);
  const signature = computeWorkAnalyticsSignature(trades, period);
  return useGenericSourceSync(
    "work-analytics",
    signature,
    () => buildWorkAnalyticsContext(period),
    ANALYTICS_DEBOUNCE_MS,
    0,
    "work",
    undefined,
    { prompt: ANALYTICS_PROMPT, taskType: "report" }
  );
}
