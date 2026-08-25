"use client";

import { AICard, type AICardTone } from "./AICard";
import { useAppStore, useHasHydrated } from "@/lib/store";
import { useCalendarInsightSync } from "@/lib/use-calendar-insight-sync";
import { useWorkInsightSync } from "@/lib/use-work-insight-sync";
import { useFinanceInsightSync } from "@/lib/use-finance-insight-sync";
import { useGlobalInsightSync } from "@/lib/use-global-insight-sync";

const WARN_WORDS = ["перевищ", "ліміт", "заборг", "прострочен", "мінус", "втрат", "збиток", "просадк"];
const POSITIVE_WORDS = ["+", "прибут", "зеконом", "у плюс", "рекорд", "win rate", "виконав"];

/** Purely presentational — picks the AI-card tint from the already-generated
 *  insight text. No new store field: the insight objects don't carry a
 *  sentiment tag, and adding one would be a store-shape change this reskin
 *  is explicitly not supposed to make. */
function insightTone(text: string): AICardTone {
  const lower = text.toLowerCase();
  if (WARN_WORDS.some((w) => lower.includes(w))) return "warn";
  if (POSITIVE_WORDS.some((w) => lower.includes(w))) return "positive";
  return "neutral";
}

/**
 * Home's own cross-source insight (see buildGlobalContext + GLOBAL_ASSISTANT_PROMPT)
 * — not a pick among the three scoped assistants' insights anymore, a
 * genuinely separate one generated from all four sections at once.
 *
 * The three scoped sync hooks stay mounted here too, purely so Calendar/
 * Робота/Фінанси insights keep refreshing for someone who only ever opens
 * Home — their own bubbles/badges read the same cached values.
 */
export function HomeInsightCard() {
  const hydrated = useHasHydrated();
  const profile = useAppStore((s) => s.profile);

  useCalendarInsightSync();
  useWorkInsightSync(profile);
  useFinanceInsightSync();
  const { cached: global, isFetching, streamingText } = useGlobalInsightSync(profile);

  if (!hydrated) return <AICard text="Готую інсайт…" />;

  const displayText = streamingText || global?.text;
  if (!displayText) return <AICard text="Асистент ще збирає дані для інсайтів…" />;

  return (
    <AICard
      text={
        <>
          {displayText}
          {isFetching && (
            <span className="ai-thinking-dots ml-1 inline-flex items-center gap-[3px] align-middle" aria-label="Асистент передумує">
              <span className="ai-thinking-dot h-[4px] w-[4px] rounded-full bg-text-faint" />
              <span className="ai-thinking-dot h-[4px] w-[4px] rounded-full bg-text-faint" />
              <span className="ai-thinking-dot h-[4px] w-[4px] rounded-full bg-text-faint" />
            </span>
          )}
        </>
      }
      tone={insightTone(displayText)}
    />
  );
}
